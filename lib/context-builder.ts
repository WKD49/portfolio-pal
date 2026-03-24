/**
 * context-builder.ts
 * Pre-computes structured context from the user's profile and live macro data.
 *
 * GUARDRAILS Section 3 — Deterministic Context Layer:
 * "The LLM is the analyst, not the calculator."
 * All portfolio maths happens here. The AI reasons over the results.
 *
 * GUARDRAILS Rule 15 — origin metadata:
 * Macro data is labelled [MACRO-DATA] so the AI knows it is structured data.
 *
 * GUARDRAILS Rules 18 & 19 — privacy:
 * Actual £ values are used only to calculate relative account weights.
 * They are NOT included in the output sent to OpenAI.
 */

import { MacroContext, IndicatorSummary } from './getMacroContext'
import { UserProfile } from './types'

// ─── Sub-asset class mapping ─────────────────────────────────────────────────
// Maps keywords found in fund composition text to canonical sub-asset class labels.
const SUBCLASS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /u\.?s\.?\s*equity|s&p\s*500|us\s*stock|u\.s\.\s*stock|united states.*equity/i, label: 'US equity' },
  // Negative lookbehind prevents "ex-U.K. Equity" (in fund names like "World ex-U.K. Equity") matching as UK equity
  { pattern: /(?<!ex[-\s])u\.?k\.?\s*(all\s*share|equity|stock)|\bftse\s*(all\s*share|100|250)\b|\buk\s*equity\b/i, label: 'UK equity' },
  // Only map to ex-UK when "ex-UK/ex-U.K." is explicit, or when Eurozone/Continental is named
  // (Eurozone = euro currency area, which by definition excludes the UK)
  // Generic "European equity / tracker" without "ex-UK" is caught by KNOWN_INDEX_COMPOSITIONS above
  { pattern: /europe[an]*\s+ex[-.\s]?u\.?k|eurozone|continental\s+europe/i, label: 'European equity (ex-UK)' },
  { pattern: /emerging\s*market|em\s*equity|em\s*stock/i, label: 'Emerging markets equity' },
  { pattern: /japan(ese)?\s*(equity|stock|index)|japan\s*stock/i, label: 'Japanese equity' },
  { pattern: /pacific\s*ex.japan|asia\s*pacific\s*ex|asia.*equity/i, label: 'Asia Pacific equity (ex-Japan)' },
  { pattern: /global.*equity|world.*equity|developed\s*world|msci\s*world|ftse\s*developed\s*world/i, label: 'Global equity (developed)' },
  { pattern: /u\.?k\.?\s*(government|gilt|treasury)\s*bond|uk.*gilt/i, label: 'UK government bonds (gilts)' },
  { pattern: /u\.?s\.?\s*(government|treasury)\s*bond|us.*treasury/i, label: 'US government bonds' },
  { pattern: /german|bund|euro.*government\s*bond|european\s*government/i, label: 'European government bonds' },
  { pattern: /japan.*government\s*bond|jgb/i, label: 'Japanese government bonds' },
  { pattern: /global.*government\s*bond|world.*government\s*bond/i, label: 'Global government bonds' },
  { pattern: /u\.?k\.?\s*(investment\s*grade|corporate|ig)\s*bond|uk.*credit/i, label: 'UK investment grade bonds' },
  { pattern: /u\.?s\.?\s*(investment\s*grade|corporate|ig)\s*credit|us.*corporate/i, label: 'US investment grade bonds' },
  { pattern: /euro.*investment\s*grade|euro.*corporate|european.*credit/i, label: 'European investment grade bonds' },
  { pattern: /global.*bond|global.*aggregate|global.*fixed\s*income/i, label: 'Other bonds (hedged)' },
  { pattern: /mortgage.backed|mbs|asset.backed\s*securit|securitized\s*bond|securitised\s*bond/i, label: 'US securitized bonds (MBS/ABS)' },
  { pattern: /inflation.linked|index.linked|tips|ilg/i, label: 'Inflation-linked bonds' },
  { pattern: /high\s*yield|junk\s*bond/i, label: 'High yield bonds' },
  { pattern: /gold/i, label: 'Gold' },
  { pattern: /copper/i, label: 'Copper' },
  { pattern: /silver/i, label: 'Silver' },
  { pattern: /oil|crude|energy\s*(etf|fund)/i, label: 'Energy commodities' },
  { pattern: /commodity|commodities|natural\s*resource/i, label: 'Broad commodities' },
  { pattern: /real\s*estate|reit|property/i, label: 'Real estate' },
  { pattern: /cash|money\s*market|short.term/i, label: 'Cash / money market' },
  // "GBP Cash" / "GBP Money Market" entries in factsheet tables → cash.
  // Note: "GBP Acc", "GBP Hedged" etc. in fund names are already handled by
  // earlier patterns; this only catches bare cash-like entries.
  { pattern: /^gbp\s*(cash|money\s*market)?$/i, label: 'Cash / money market' },
]

interface ParsedHolding {
  name: string
  pct: number
}

/**
 * Parses raw fund composition text pasted from a product page.
 * Handles tab-separated, pipe-separated, and free-form percentage patterns.
 */
function parseCompositionText(raw: string): ParsedHolding[] {
  const results: ParsedHolding[] = []
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    // Match a percentage value anywhere in the line
    const pctMatch = line.match(/(\d+(?:\.\d+)?)\s*%/)
    if (!pctMatch) continue

    const pct = parseFloat(pctMatch[1])
    if (isNaN(pct) || pct <= 0) continue

    // The name is everything before the percentage (strip tabs, pipes, trailing spaces)
    const name = line.slice(0, line.lastIndexOf(pctMatch[0])).replace(/[\t|]+/g, ' ').trim()
    if (name) results.push({ name, pct })
  }

  return results
}

// ─── Country-name lookup (for factsheet geographic breakdowns) ───────────────
// When a factsheet lists holdings by country (e.g. FTSE All-World), the
// composition text contains bare country names + percentages. These are all
// equity — just geographically segmented. This lookup maps country name → sub-asset class.

const COUNTRY_MAP: Record<string, string> = {
  // US / North America (note: "North America" includes ~3% Canada in most indices — acceptable approximation)
  'USA': 'US equity', 'United States': 'US equity', 'United States of America': 'US equity',
  'North America': 'US equity', 'Americas': 'US equity',
  // UK
  'UK': 'UK equity', 'United Kingdom': 'UK equity', 'Great Britain': 'UK equity',
  // Japan
  'Japan': 'Japanese equity',
  // Asia Pacific developed
  'Australia': 'Asia Pacific equity (ex-Japan)', 'New Zealand': 'Asia Pacific equity (ex-Japan)',
  'Hong Kong': 'Asia Pacific equity (ex-Japan)', 'Singapore': 'Asia Pacific equity (ex-Japan)',
  // European developed (ex-UK)
  'France': 'European equity (ex-UK)', 'Germany': 'European equity (ex-UK)',
  'Switzerland': 'European equity (ex-UK)', 'Netherlands': 'European equity (ex-UK)',
  'Sweden': 'European equity (ex-UK)', 'Spain': 'European equity (ex-UK)',
  'Denmark': 'European equity (ex-UK)', 'Italy': 'European equity (ex-UK)',
  'Norway': 'European equity (ex-UK)', 'Belgium': 'European equity (ex-UK)',
  'Finland': 'European equity (ex-UK)', 'Austria': 'European equity (ex-UK)',
  'Portugal': 'European equity (ex-UK)', 'Greece': 'European equity (ex-UK)',
  'Poland': 'European equity (ex-UK)', 'Hungary': 'European equity (ex-UK)',
  'Czech Rep.': 'European equity (ex-UK)', 'Czech Republic': 'European equity (ex-UK)',
  'Romania': 'European equity (ex-UK)', 'Iceland': 'European equity (ex-UK)',
  'Luxembourg': 'European equity (ex-UK)', 'Ireland': 'European equity (ex-UK)',
  // Other developed
  'Canada': 'Global equity (developed)', 'Israel': 'Global equity (developed)',
  // Emerging markets
  'China': 'Emerging markets equity', 'India': 'Emerging markets equity',
  'Korea': 'Emerging markets equity', 'South Korea': 'Emerging markets equity',
  'Taiwan': 'Emerging markets equity', 'Brazil': 'Emerging markets equity',
  'South Africa': 'Emerging markets equity', 'Saudi Arabia': 'Emerging markets equity',
  'Mexico': 'Emerging markets equity', 'Indonesia': 'Emerging markets equity',
  'Malaysia': 'Emerging markets equity', 'Thailand': 'Emerging markets equity',
  'UAE': 'Emerging markets equity', 'Qatar': 'Emerging markets equity',
  'Kuwait': 'Emerging markets equity', 'Turkiye': 'Emerging markets equity',
  'Turkey': 'Emerging markets equity', 'Colombia': 'Emerging markets equity',
  'Chile': 'Emerging markets equity', 'Egypt': 'Emerging markets equity',
  'Philippines': 'Emerging markets equity', 'Pakistan': 'Emerging markets equity',
  'Vietnam': 'Emerging markets equity', 'Nigeria': 'Emerging markets equity',
}

// ─── Known index compositions ────────────────────────────────────────────────
// Geographic sub-asset class breakdowns for widely-held index funds.
// These allow look-through of funds listed in composition data (e.g. the
// "FTSE Developed World ex-U.K." sub-fund inside a LifeStrategy) without
// requiring the user to paste a second level of composition data.
//
// Data sources and dates:
//   FTSE All-World:          FTSE Russell factsheet, 27 Feb 2026 (exact)
//   FTSE Developed World ex-UK: derived from above by removing UK (3.5%) and
//                            EM (13%), renormalised — approximate
//   MSCI World:              derived from above (developed only, UK included),
//                            renormalised — approximate
//   All others:              trivially 100% of their stated asset class
//
// IMPORTANT: US equity dominates all global developed indices (~60-72%).
// Without this table, "FTSE Developed World ex-U.K." collapses to a single
// "Global equity (developed)" label, dramatically understating US exposure.

interface SubClassAllocation { subClass: string; pct: number }

const KNOWN_INDEX_COMPOSITIONS: Array<{
  pattern: RegExp
  breakdown: SubClassAllocation[]
}> = [
  // ── FTSE All-World / MSCI ACWI — global all-cap including EM ────────────
  // Source: FTSE Russell factsheet, 27 Feb 2026 (exact country data).
  // Note: FTSE classifies Korea and Taiwan as emerging; weights reflect this.
  {
    pattern: /ftse\s*all.world|msci\s*acwi|all\s*country\s*world/i,
    breakdown: [
      { subClass: 'US equity',                      pct: 59.8 },
      { subClass: 'Emerging markets equity',         pct: 13   },
      { subClass: 'European equity (ex-UK)',         pct: 11   },
      { subClass: 'Japanese equity',                 pct: 6.3  },
      { subClass: 'Asia Pacific equity (ex-Japan)',  pct: 2.7  }, // Australia, HK, Singapore, NZ
      { subClass: 'UK equity',                       pct: 3.5  },
      { subClass: 'Global equity (developed)',       pct: 3.7  }, // Canada, Israel, other
    ],
  },

  // ── FTSE Developed Index / FTSE Developed World (includes UK) ───────────
  // Source: FTSE Russell factsheet, 27 Feb 2026 (exact).
  // FTSE treats Korea (2.5%) as developed — included in Asia Pacific bucket.
  {
    pattern: /\bftse\s*developed\b(?!\s*world\s*ex|\s*europe|\s*asia)|\bftse\s*developed\s*world\b(?!\s*ex)/i,
    breakdown: [
      { subClass: 'US equity',                      pct: 66.8 },
      { subClass: 'European equity (ex-UK)',         pct: 13   },
      { subClass: 'Japanese equity',                 pct: 7    },
      { subClass: 'Asia Pacific equity (ex-Japan)',  pct: 5.5  }, // Australia, HK, Singapore, NZ, Korea
      { subClass: 'UK equity',                       pct: 4    },
      { subClass: 'Global equity (developed)',       pct: 3.7  }, // Canada, Israel
    ],
  },

  // ── FTSE Developed World ex-UK ───────────────────────────────────────────
  // Derived from FTSE Developed factsheet (27 Feb 2026) by removing UK (3.96%)
  // and renormalising. Pool = 96.04% → US = 66.81/96.04 = 69.6%.
  {
    pattern: /ftse\s*developed\s*(world\s*)?ex.u?\.?k?\.?|developed\s*world\s*ex.u?\.?k?\.?/i,
    breakdown: [
      { subClass: 'US equity',                      pct: 70   },
      { subClass: 'European equity (ex-UK)',         pct: 13   },
      { subClass: 'Japanese equity',                 pct: 7    },
      { subClass: 'Asia Pacific equity (ex-Japan)',  pct: 6    }, // incl. Korea (FTSE developed)
      { subClass: 'Global equity (developed)',       pct: 4    }, // Canada, Israel
    ],
  },

  // ── MSCI World — developed markets only, UK included ────────────────────
  // Derived from FTSE Developed factsheet. Key difference from FTSE Developed:
  // MSCI classifies Korea as emerging (not developed), so Korea (2.5%) is removed
  // and the remaining pool renormalised. US = 66.81/97.5 ≈ 68.5%.
  {
    pattern: /\bmsci\s*world\b/i,
    breakdown: [
      { subClass: 'US equity',                      pct: 69   },
      { subClass: 'European equity (ex-UK)',         pct: 13   },
      { subClass: 'Japanese equity',                 pct: 7    },
      { subClass: 'UK equity',                       pct: 4    },
      { subClass: 'Global equity (developed)',       pct: 4    }, // Canada, Israel
      { subClass: 'Asia Pacific equity (ex-Japan)',  pct: 3    }, // excl. Korea
    ],
  },

  // ── Bloomberg Global Aggregate Bond Index (GBP Hedged) ───────────────────
  // Source: Vanguard Global Bond Index Fund (Institutional Plus GBP Hedged Acc),
  //   factsheet 28 Feb 2026. Fund column (near-identical to benchmark).
  //
  // Geographic (fund): USA 46%, France 6.2%, Japan 5.7%, Germany 5.6%, UK 4.4%,
  //   Canada 4.1%, Italy 3.8%, Supranational 3.1%, Spain 2.9%, Australia 2.0%
  // Issuer type (fund): Treasury/Federal 52.4%, Corp-industrials 11.4%,
  //   MBS pass-through 8.9%, Corp-financial 8.5%, Gov-agencies 4.2%,
  //   Gov-local 3.5%, Gov-supranationals 3.1%, Securitised 2.7%,
  //   Corp-utilities 2.2%, Gov-sovereign 1.6%
  //
  // Decomposition:
  //   Securitized (MBS 8.9% + other securitised 2.7% = 11.6%) → virtually all US
  //   Remaining US (~34.4%): ~65% Treasury/agencies → ~22% US govt, ~12% US IG
  //   Europe (~20%): France, Germany, Italy, Spain + small unlisted → ~63% govt, ~37% corp
  //   Japan (5.7%): ~95% JGBs
  //   UK (4.4%): ~65% gilts, ~35% corporate
  //   Other (~24%): Canada, Supranational, Australia, unlisted — labelled "Other bonds (hedged)"
  //   (NOT "global" — these are specific country bonds, just not decomposed individually)
  {
    pattern: /global\s*bond\s*index|global\s*aggregate\s*bond|bloomberg.*global.*agg|barclays.*global.*agg/i,
    breakdown: [
      { subClass: 'US government bonds',             pct: 22   }, // ~65% of non-securitized US (34.4%)
      { subClass: 'US investment grade bonds',       pct: 12   }, // ~35% of non-securitized US (34.4%)
      { subClass: 'US securitized bonds (MBS/ABS)',  pct: 12   }, // MBS + other securitised, virtually all US
      { subClass: 'European government bonds',       pct: 13   }, // ~63% of ~20% Europe
      { subClass: 'European investment grade bonds', pct: 7    }, // ~37% of ~20% Europe
      { subClass: 'Japanese government bonds',       pct: 5.5  }, // Japan 5.7% (~95% JGBs)
      { subClass: 'UK government bonds (gilts)',     pct: 3    }, // ~65% of UK 4.4%
      { subClass: 'UK investment grade bonds',       pct: 1.5  }, // ~35% of UK 4.4%
      { subClass: 'Other bonds (hedged)',            pct: 24   }, // Canada 4.1%, Supranational 3.1%, Australia 2.0%, unlisted ~10%
    ],
  },

  // ── Vanguard Target Retirement 2030 Fund (VAR30GA) ───────────────────────
  // Source: Vanguard product page, Portfolio Data tab, 28 Feb 2026 (86.9% of fund visible).
  // Sub-fund breakdown looked through using patterns above; remaining ~13% scaled proportionally.
  // NOTE: TRF glides toward bonds over time — re-verify composition annually.
  // Sub-funds in the factsheet: Global Bond Index (19.2%), FTSE Dev World ex-UK (18.8%),
  // FTSE UK All Share (11.4%), US Equity Index (11.1%), Global Agg Bond ETF (9.4%),
  // UK Govt Bond (8.2%), EM Stock Index (5.0%), FTSE 100 ETF (3.8%), other (~13.1%).
  {
    pattern: /vanguard.*target\s*retirement|target\s*retirement.*2030|target\s*retirement\s*2030|\bvar30g/i,
    breakdown: [
      { subClass: 'US equity',                             pct: 28   }, // US Equity Fund 11.1% + FTSE Dev ex-UK 18.8%×70%
      { subClass: 'UK equity',                             pct: 17.4 }, // UK All Share 11.4% + FTSE 100 3.8%
      { subClass: 'UK government bonds (gilts)',           pct: 10.4 }, // UK Govt Bond 8.2% + slice from both bond funds
      { subClass: 'Other bonds (hedged)',                  pct: 7.5  }, // Canada/Supranational/Australia/unlisted slice of both bond funds
      { subClass: 'US government bonds',                   pct: 7.2  }, // ~22% of bond fund + agg ETF × US weight
      { subClass: 'Emerging markets equity',               pct: 5.8  }, // EM Stock Index Fund 5.0%
      { subClass: 'US investment grade bonds',             pct: 4    }, // ~12% of both bond funds × US weight
      { subClass: 'US securitized bonds (MBS/ABS)',        pct: 4    }, // ~12% securitized tranche (both bond funds)
      { subClass: 'European government bonds',             pct: 4.3  }, // ~13% of both bond funds × European weight
      { subClass: 'European equity (ex-UK)',               pct: 2.8  }, // FTSE Dev ex-UK 18.8%×13%
      { subClass: 'European investment grade bonds',       pct: 2.6  }, // ~8% of both bond funds × European weight
      { subClass: 'Japanese equity',                       pct: 1.5  }, // FTSE Dev ex-UK 18.8%×7%
      { subClass: 'Japanese government bonds',             pct: 1.8  }, // ~5.5% of both bond funds × Japan weight
      { subClass: 'Asia Pacific equity (ex-Japan)',        pct: 1.3  }, // FTSE Dev ex-UK 18.8%×6%
      { subClass: 'UK investment grade bonds',             pct: 0.5  }, // ~1.5% of both bond funds × UK weight
      { subClass: 'Global equity (developed)',             pct: 0.9  }, // FTSE Dev ex-UK 18.8%×4% (Canada, Israel)
    ],
  },

  // ── Generic global / world tracker funds ─────────────────────────────────
  // "Global Shares Tracker", "World Index Fund" etc. — assumed to track a
  // broad global index; FTSE All-World used as the approximation.
  // More specific names (FTSE All-World, MSCI ACWI, FTSE Developed) are caught
  // by earlier patterns before reaching this one.
  {
    pattern: /global\s*(shares|equity|stock|index)?\s*tracker|world\s*(shares|equity|stock|index)?\s*tracker/i,
    breakdown: [
      { subClass: 'US equity',                      pct: 59.8 },
      { subClass: 'Emerging markets equity',         pct: 13   },
      { subClass: 'European equity (ex-UK)',         pct: 11   },
      { subClass: 'Japanese equity',                 pct: 6.3  },
      { subClass: 'Asia Pacific equity (ex-Japan)',  pct: 2.7  },
      { subClass: 'UK equity',                       pct: 3.5  },
      { subClass: 'Global equity (developed)',       pct: 3.7  },
    ],
  },

  // ── FTSE Developed Europe Index (includes UK) / VEUR ────────────────────
  // Source: Vanguard FTSE Developed Europe UCITS ETF (VEUR) factsheet, Feb 2026.
  // UK 23.4%, Switzerland 14.8%, France 14.5%, Germany 13.8%, Netherlands 7.6%,
  // Spain 5.7%, Sweden 5.4%, Italy 5.2%, Denmark 2.3%, Belgium 1.7%, Finland 1.7%,
  // Norway 0.9%, Poland 0.7%, Austria 0.5%, Ireland 0.5%, Portugal 0.3%, Other 0.9%.
  // NOTE: This index INCLUDES the UK. Only use ex-UK patterns when "ex-UK" is explicit.
  {
    pattern: /\bveur\b|(?:vanguard\s+)?ftse\s+developed\s+europe(?!.*ex)|european?\s+(?:equity|shares|index|stock)\s*tracker(?!.*ex[-.\s]?u\.?k)|european?\s+tracker(?!.*ex[-.\s]?u\.?k)/i,
    breakdown: [
      { subClass: 'UK equity',               pct: 23.4 },
      { subClass: 'European equity (ex-UK)', pct: 76.5 }, // Switzerland, France, Germany, Netherlands, Spain, Sweden, Italy, Denmark, Belgium, Finland, Norway, Poland, Austria, Ireland, Portugal, Other
    ],
  },

  // ── Single-asset-class indices (trivially 100%) ──────────────────────────
  {
    pattern: /s&p\s*500/i,
    breakdown: [{ subClass: 'US equity', pct: 100 }],
  },
  {
    pattern: /\bftse\s*100\b/i,
    breakdown: [{ subClass: 'UK equity', pct: 100 }],
  },
  {
    pattern: /msci\s*emerging|ftse\s*emerging|emerging\s*markets?\s*index/i,
    breakdown: [{ subClass: 'Emerging markets equity', pct: 100 }],
  },
]

/**
 * Maps a fund holding name to one or more sub-asset class allocations.
 * Returns a multi-item array for known indices (so US equity, Japan equity etc.
 * are each attributed correctly rather than collapsed to one label).
 * Exported for use in the onboarding form to identify truly unclassifiable holdings.
 */
export function classifyHolding(name: string): SubClassAllocation[] {
  // Known index compositions take priority — they give geographic detail
  for (const { pattern, breakdown } of KNOWN_INDEX_COMPOSITIONS) {
    if (pattern.test(name)) return breakdown
  }
  // Single-class pattern matching
  for (const { pattern, label } of SUBCLASS_PATTERNS) {
    if (pattern.test(name)) return [{ subClass: label, pct: 100 }]
  }
  // Country-name fallback: exact match on trimmed name
  const countryClass = COUNTRY_MAP[name.trim()]
  if (countryClass) return [{ subClass: countryClass, pct: 100 }]
  return [{ subClass: 'Other / unclassified', pct: 100 }]
}

/**
 * Returns the classification source for a holding name.
 * Used by the onboarding form to colour-code the breakdown button.
 */
export function classifyHoldingSource(name: string): 'known-index' | 'pattern' | 'unclassified' {
  for (const { pattern } of KNOWN_INDEX_COMPOSITIONS) {
    if (pattern.test(name)) return 'known-index'
  }
  for (const { pattern } of SUBCLASS_PATTERNS) {
    if (pattern.test(name)) return 'pattern'
  }
  if (COUNTRY_MAP[name.trim()]) return 'pattern'
  return 'unclassified'
}

interface SubAssetBreakdown {
  [subClass: string]: number // percentage of the fund
}

/**
 * Derives sub-asset class breakdown from raw composition text.
 * Returns percentages that sum to (approximately) 100% of the fund.
 */
function buildSubAssetBreakdown(compositionData: string): SubAssetBreakdown {
  const holdings = parseCompositionText(compositionData)
  const breakdown: SubAssetBreakdown = {}

  for (const { name, pct } of holdings) {
    for (const { subClass, pct: subPct } of classifyHolding(name)) {
      breakdown[subClass] = (breakdown[subClass] ?? 0) + (subPct / 100) * pct
    }
  }

  return breakdown
}

// ─── Portfolio structure builder ─────────────────────────────────────────────

interface AccountWeight {
  description: string
  taxWrapper: string
  weightPct: number // % of total portfolio value
}

/**
 * Calculates relative account weights from approximate values.
 * Values are parsed from strings like "£45,000" or "45000".
 * Returns weights as percentages of total — the actual £ figures are discarded.
 */
function calculateAccountWeights(accounts: UserProfile['accounts']): AccountWeight[] {
  const parsed = accounts.map(a => {
    const cleaned = (a.approxValue ?? '').replace(/[£$,\s]/g, '')
    const value = parseFloat(cleaned) || 0
    return { description: a.description, taxWrapper: a.taxWrapper, value }
  })

  const total = parsed.reduce((sum, a) => sum + a.value, 0)
  if (total === 0) {
    // No values provided — treat all accounts as equal weight
    return parsed.map(a => ({ description: a.description, taxWrapper: a.taxWrapper, weightPct: 100 / parsed.length }))
  }

  return parsed.map(a => ({
    description: a.description,
    taxWrapper: a.taxWrapper,
    weightPct: Math.round((a.value / total) * 1000) / 10,
  }))
}

/**
 * Builds the full portfolio sub-asset class breakdown via look-through.
 * Each fund's composition is weighted by: fund % within account × account % of total portfolio.
 */
function buildPortfolioBreakdown(profile: UserProfile): {
  breakdown: SubAssetBreakdown
  accountWeights: AccountWeight[]
  missingComposition: string[]
} {
  const accountWeights = calculateAccountWeights(profile.accounts)
  const portfolioBreakdown: SubAssetBreakdown = {}
  const missingComposition: string[] = []

  for (let ai = 0; ai < profile.accounts.length; ai++) {
    const account = profile.accounts[ai]
    const accountWeight = accountWeights[ai].weightPct / 100

    for (const holding of account.allocation) {
      const fundPct = parseFloat(holding.percentage) / 100
      if (isNaN(fundPct) || fundPct <= 0) continue

      const contributionFactor = fundPct * accountWeight

      if (holding.compositionData?.trim()) {
        // Look-through: calculate sub-asset class contribution from composition data
        const fundBreakdown = buildSubAssetBreakdown(holding.compositionData)
        for (const [subClass, subPct] of Object.entries(fundBreakdown)) {
          const contribution = (subPct / 100) * contributionFactor * 100
          portfolioBreakdown[subClass] = (portfolioBreakdown[subClass] ?? 0) + contribution
        }
      } else {
        // No composition data — classify by fund name (handles single-asset
        // holdings like "Copper ETC" and known indices like "FTSE All-World ETF")
        const allocations = classifyHolding(holding.name)
        const isUnclassified = allocations.length === 1 && allocations[0].subClass === 'Other / unclassified'
        if (isUnclassified) {
          portfolioBreakdown['Other / unclassified'] = (portfolioBreakdown['Other / unclassified'] ?? 0) + contributionFactor * 100
          if (holding.name.trim()) missingComposition.push(`${holding.name} (${account.description})`)
        } else {
          for (const { subClass, pct } of allocations) {
            portfolioBreakdown[subClass] = (portfolioBreakdown[subClass] ?? 0) + (pct / 100) * contributionFactor * 100
          }
        }
      }
    }
  }

  // Round to 1 decimal place
  for (const key of Object.keys(portfolioBreakdown)) {
    portfolioBreakdown[key] = Math.round(portfolioBreakdown[key] * 10) / 10
  }

  return { breakdown: portfolioBreakdown, accountWeights, missingComposition }
}

/**
 * Formats the portfolio structure block for injection into the AI system message.
 * Contains no £ figures — only percentages and relative weights.
 */
export function buildPortfolioContextBlock(profile: UserProfile): string {
  const { breakdown, accountWeights, missingComposition } = buildPortfolioBreakdown(profile)

  // Sort by size descending
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1])

  const breakdownLines = sorted.map(([subClass, pct]) => `  ${subClass}: ${pct.toFixed(1)}%`)

  const accountLines = accountWeights.map(a =>
    `  ${a.description?.trim() ? `${a.description} (${a.taxWrapper})` : a.taxWrapper}: ~${a.weightPct}% of portfolio`
  )

  const missingNote = missingComposition.length > 0
    ? `\nNo composition data provided for: ${missingComposition.join(', ')}. These holdings are shown as unclassified — analysis of their sub-asset class exposure will be limited.`
    : ''

  const indivNote = profile.individualPositionsPct && parseFloat(profile.individualPositionsPct) > 0
    ? `\nIndividual positions pot: ~${profile.individualPositionsPct}% of total portfolio (concentrated/opportunistic allocation — assess separately).`
    : ''

  return [
    '[PORTFOLIO STRUCTURE — calculated look-through, as declared by user]',
    '',
    'Sub-asset class breakdown (whole portfolio):',
    ...breakdownLines,
    '',
    'Account weights (relative, not £ values):',
    ...accountLines,
    missingNote,
    indivNote,
  ].filter(s => s !== null && s !== undefined).join('\n')
}

// ─── Portfolio Calculation Trace ─────────────────────────────────────────────

export interface SubItemTrace {
  name: string          // sub-fund name (from composition data lines)
  pct: number           // % within the parent fund
  classifiedBy: string  // 'known-index' | 'pattern' | 'country-map' | 'unclassified'
  allocations: Array<{ subClass: string; portfolioPct: number }>
}

export interface HoldingTrace {
  name: string
  holdingPct: number    // % within account
  portfolioPct: number  // % of whole portfolio
  classifiedBy: 'composition-data' | 'known-index' | 'pattern' | 'unclassified'
  allocations: Array<{ subClass: string; portfolioPct: number }>
  subItems?: SubItemTrace[]  // populated when classifiedBy === 'composition-data'
}

export interface AccountTrace {
  label: string         // taxWrapper, fallback to description
  weightPct: number     // % of total portfolio
  holdings: HoldingTrace[]
}

export function buildPortfolioTrace(profile: UserProfile): AccountTrace[] {
  const accountWeights = calculateAccountWeights(profile.accounts)
  const traces: AccountTrace[] = []

  for (let ai = 0; ai < profile.accounts.length; ai++) {
    const account = profile.accounts[ai]
    const accountWeight = accountWeights[ai].weightPct / 100
    const accountLabel = account.taxWrapper || account.description || `Account ${ai + 1}`
    const holdingTraces: HoldingTrace[] = []

    for (const holding of account.allocation) {
      const fundPct = parseFloat(holding.percentage) / 100
      if (isNaN(fundPct) || fundPct <= 0 || !holding.name.trim()) continue

      const portfolioPct = fundPct * accountWeight * 100

      if (holding.compositionData?.trim()) {
        // Look-through: parse composition and classify each line
        const lines = parseCompositionText(holding.compositionData)
        const subItems: SubItemTrace[] = []
        const allocationMap: Record<string, number> = {}

        for (const line of lines) {
          const result = classifyHolding(line.name)
          const isUnclassified = result.length === 1 && result[0].subClass === 'Other / unclassified'
          // Determine classification source
          let classifiedBy = 'unclassified'
          if (!isUnclassified) {
            for (const { pattern } of KNOWN_INDEX_COMPOSITIONS) {
              if (pattern.test(line.name)) { classifiedBy = 'known-index'; break }
            }
            if (classifiedBy === 'unclassified') {
              for (const { pattern } of SUBCLASS_PATTERNS) {
                if (pattern.test(line.name)) { classifiedBy = 'pattern'; break }
              }
            }
            if (classifiedBy === 'unclassified' && COUNTRY_MAP[line.name.trim()]) {
              classifiedBy = 'country-map'
            }
          }

          const subAllocs: Array<{ subClass: string; portfolioPct: number }> = []
          for (const { subClass, pct } of result) {
            const contrib = (pct / 100) * (line.pct / 100) * portfolioPct
            allocationMap[subClass] = (allocationMap[subClass] ?? 0) + contrib
            subAllocs.push({ subClass, portfolioPct: Math.round(contrib * 100) / 100 })
          }

          subItems.push({ name: line.name, pct: line.pct, classifiedBy, allocations: subAllocs })
        }

        const allocations = Object.entries(allocationMap)
          .map(([subClass, pct]) => ({ subClass, portfolioPct: Math.round(pct * 100) / 100 }))
          .sort((a, b) => b.portfolioPct - a.portfolioPct)

        holdingTraces.push({
          name: holding.name,
          holdingPct: fundPct * 100,
          portfolioPct: Math.round(portfolioPct * 100) / 100,
          classifiedBy: 'composition-data',
          allocations,
          subItems,
        })
      } else {
        // Direct classification by fund name
        const result = classifyHolding(holding.name)
        const isUnclassified = result.length === 1 && result[0].subClass === 'Other / unclassified'

        let classifiedBy: HoldingTrace['classifiedBy'] = 'unclassified'
        if (!isUnclassified) {
          for (const { pattern } of KNOWN_INDEX_COMPOSITIONS) {
            if (pattern.test(holding.name)) { classifiedBy = 'known-index'; break }
          }
          if (classifiedBy === 'unclassified') {
            for (const { pattern } of SUBCLASS_PATTERNS) {
              if (pattern.test(holding.name)) { classifiedBy = 'pattern'; break }
            }
          }
        }

        const allocations = result.map(({ subClass, pct }) => ({
          subClass,
          portfolioPct: Math.round((pct / 100) * portfolioPct * 100) / 100,
        })).sort((a, b) => b.portfolioPct - a.portfolioPct)

        holdingTraces.push({
          name: holding.name,
          holdingPct: fundPct * 100,
          portfolioPct: Math.round(portfolioPct * 100) / 100,
          classifiedBy,
          allocations,
        })
      }
    }

    traces.push({
      label: accountLabel,
      weightPct: Math.round(accountWeights[ai].weightPct * 10) / 10,
      holdings: holdingTraces,
    })
  }

  return traces
}

// ─── Macro context formatter ─────────────────────────────────────────────────

const INDICATOR_LABELS: Record<string, string> = {
  brent_crude_usd:  'Brent Crude',
  wti_crude_usd:    'WTI Crude',
  natural_gas_usd:  'Natural Gas',
  gold_usd:         'Gold (USD)',
  gold_gbp:         'Gold (GBP)',
  silver_usd:       'Silver (USD)',
  copper_usd:       'Copper (USD)',
  copper_gbp:       'Copper (GBP)',
  us_10yr_yield:    'US 10yr',
  uk_10yr_yield:    'UK 10yr Gilt',
  de_10yr_yield:    'German 10yr Bund',
  us_2yr_yield:     'US 2yr',
  us_yield_spread:  'US Curve (10yr−2yr)',
  uk_yield_curve:   'UK Curve',
  dxy:              'DXY',
  gbp_usd:          'GBP/USD',
  eur_usd:          'EUR/USD',
  gbp_eur:          'GBP/EUR',
  usd_jpy:          'USD/JPY',
  vix:              'VIX',
}

function fmt(row: IndicatorSummary, slug: string): string {
  const label = INDICATOR_LABELS[slug] ?? slug
  if (row.value === null) return `${label}: unavailable`

  const val = row.value % 1 === 0 ? row.value.toFixed(0) : row.value.toFixed(2)
  const currency = row.currency ?? ''
  const chg = row.change_pct !== null
    ? ` (${row.change_pct >= 0 ? '+' : ''}${row.change_pct.toFixed(2)}%)`
    : ''

  return `${label}: ${currency}${val}${chg}`
}

function buildSection(title: string, group: Record<string, IndicatorSummary>): string {
  const lines = Object.entries(group).map(([slug, row]) => `  ${fmt(row, slug)}`)
  return `${title}:\n${lines.join('\n')}`
}

export function buildMacroContextBlock(context: MacroContext, warnings: string[]): string {
  const sections = [
    buildSection('Energy', context.energy),
    buildSection('Metals', context.metals),
    buildSection('Fixed Income', context.fixed_income),
    buildSection('Currencies', context.currencies),
    buildSection('Volatility', context.volatility),
  ]

  const warningBlock = warnings.length > 0
    ? `\nData quality warnings: ${warnings.join('; ')}`
    : ''

  return [
    `[MACRO-DATA — source: macro_indicators, as_of: ${context.asOf}]`,
    ...sections,
    warningBlock,
  ].filter(Boolean).join('\n\n')
}
