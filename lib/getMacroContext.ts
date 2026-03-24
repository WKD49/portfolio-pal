/**
 * getMacroContext()
 * Fetches current macro indicators from Supabase and returns them grouped by category.
 * Adapted from the Macro Dashboard repo (src/lib/macro/getMacroContext.ts).
 *
 * GUARDRAILS: Only reads macro_indicators — no writes, no service role key.
 * GUARDRAILS: If this throws, the caller must handle it explicitly and tell the user
 * that macro data is unavailable. Never estimate or hallucinate macro values.
 */

import { getAnonClient } from './supabase-server'

export type IndicatorSummary = {
  value: number | null
  change_pct: number | null
  currency: string | null
  last_updated: string | null
}

export type MacroContext = {
  asOf: string
  energy: Record<string, IndicatorSummary>
  metals: Record<string, IndicatorSummary>
  fixed_income: Record<string, IndicatorSummary>
  currencies: Record<string, IndicatorSummary>
  volatility: Record<string, IndicatorSummary>
}

const CATEGORY_SLUGS: Record<string, string[]> = {
  energy: ['brent_crude_usd', 'wti_crude_usd', 'natural_gas_usd'],
  metals: ['gold_usd', 'gold_gbp', 'silver_usd', 'copper_usd', 'copper_gbp'],
  fixed_income: ['us_10yr_yield', 'uk_10yr_yield', 'de_10yr_yield', 'us_2yr_yield', 'us_yield_spread', 'uk_yield_curve'],
  currencies: ['dxy', 'gbp_usd', 'eur_usd', 'gbp_eur', 'usd_jpy'],
  volatility: ['vix'],
}

export async function getMacroContext(): Promise<MacroContext> {
  const supabase = getAnonClient()

  const { data, error } = await supabase
    .from('macro_indicators')
    .select('indicator, value, change_pct, currency, last_updated')

  if (error) throw new Error(`getMacroContext: ${error.message}`)

  const rows = data ?? []
  const bySlug = new Map(rows.map((r) => [r.indicator, r]))

  function buildGroup(slugs: string[]): Record<string, IndicatorSummary> {
    const group: Record<string, IndicatorSummary> = {}
    for (const slug of slugs) {
      const row = bySlug.get(slug)
      group[slug] = {
        value: row?.value ?? null,
        change_pct: row?.change_pct ?? null,
        currency: row?.currency ?? null,
        last_updated: row?.last_updated ?? null,
      }
    }
    return group
  }

  return {
    asOf: new Date().toISOString(),
    energy: buildGroup(CATEGORY_SLUGS.energy),
    metals: buildGroup(CATEGORY_SLUGS.metals),
    fixed_income: buildGroup(CATEGORY_SLUGS.fixed_income),
    currencies: buildGroup(CATEGORY_SLUGS.currencies),
    volatility: buildGroup(CATEGORY_SLUGS.volatility),
  }
}
