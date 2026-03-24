/**
 * GET /api/macro
 * Fetches live macro data from Supabase and returns a validated, structured context block.
 *
 * GUARDRAILS:
 * - Rule 2: Only reads from Supabase macro_indicators (approved persistence layer)
 * - Rule 4: No external API calls — Supabase only
 * - Rule 5: No secrets in code — env vars only
 * - Business Rule: If data is unavailable or stale, flag it explicitly — never estimate
 */

import { getMacroContext, MacroContext, IndicatorSummary } from '@/lib/getMacroContext'
import { buildMacroContextBlock } from '@/lib/context-builder'

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return Response.json(
      { error: 'Supabase not configured — macro data unavailable.' },
      { status: 503 }
    )
  }

  let context: MacroContext
  try {
    context = await getMacroContext()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json(
      { error: `Macro data fetch failed: ${message}` },
      { status: 502 }
    )
  }

  // Validate: flag stale or missing indicators
  const warnings: string[] = []
  const now = Date.now()

  function checkGroup(groupName: string, group: Record<string, IndicatorSummary>) {
    for (const [slug, row] of Object.entries(group)) {
      if (row.value === null) {
        warnings.push(`${slug}: no value`)
      } else if (row.last_updated) {
        const age = now - new Date(row.last_updated).getTime()
        if (age > STALE_THRESHOLD_MS) {
          const hoursAgo = Math.round(age / 3_600_000)
          warnings.push(`${slug}: stale (${hoursAgo}h ago)`)
        }
      }
    }
    return groupName
  }

  checkGroup('energy', context.energy)
  checkGroup('metals', context.metals)
  checkGroup('fixed_income', context.fixed_income)
  checkGroup('currencies', context.currencies)
  checkGroup('volatility', context.volatility)

  const contextBlock = buildMacroContextBlock(context, warnings)

  return Response.json({ contextBlock, warnings, asOf: context.asOf })
}
