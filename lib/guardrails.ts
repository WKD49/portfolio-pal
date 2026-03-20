import { LogEntry } from '@/lib/types'

// ─── LogEntry validator (Rule 11) ────────────────────────────────────────────
// Used server-side before any persistence. Returns true only if all required
// fields are present, non-empty strings, and no unexpected fields are present.

const REQUIRED_LOG_FIELDS: (keyof LogEntry)[] = [
  'id',
  'date',
  'marketContext',
  'baseCurrency',
  'fxConditions',
  'rotationSuggested',
  'reasoning',
]

const OPTIONAL_LOG_FIELDS: (keyof LogEntry)[] = [
  'accountStructure',
  'outcome',
  'verdict',
]

const ALL_LOG_FIELDS = new Set<string>([...REQUIRED_LOG_FIELDS, ...OPTIONAL_LOG_FIELDS])

export function validateLogEntry(body: unknown): body is LogEntry {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false

  const obj = body as Record<string, unknown>

  // Reject unknown fields
  for (const key of Object.keys(obj)) {
    if (!ALL_LOG_FIELDS.has(key)) return false
  }

  // Required fields must be non-empty strings
  for (const field of REQUIRED_LOG_FIELDS) {
    if (typeof obj[field] !== 'string' || (obj[field] as string).trim() === '') return false
  }

  // Optional fields must be strings if present
  for (const field of OPTIONAL_LOG_FIELDS) {
    if (field in obj && typeof obj[field] !== 'string') return false
  }

  return true
}

// ─── Token estimation (Rules 16, 17) ─────────────────────────────────────────
// Approximation: gpt-4o uses roughly 1 token per 4 characters.
// Not exact — tiktoken would be more precise but requires an npm package.
// This is conservative enough for budget enforcement purposes.

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function estimateMessagesTokens(messages: { role: string; content: string }[]): number {
  // ~4 tokens overhead per message for role wrapping
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0)
}

// ─── Budget constants (Rules 16, 17) ─────────────────────────────────────────
// Update these if OpenAI reprices or the model changes.
// gpt-4o pricing as of early 2026: $2.50/1M input tokens, $10.00/1M output tokens.

export const MAX_INPUT_TOKENS = 6000       // ~24,000 chars total prompt
export const MAX_OUTPUT_TOKENS = 1500      // enforced via max_tokens in OpenAI request
export const MAX_USER_MSG_CHARS = 12_000   // Rule 17 — per-message truncation threshold

export const GPT4O_INPUT_COST_PER_TOKEN = 0.0000025   // $2.50 / 1,000,000
export const GPT4O_OUTPUT_COST_PER_TOKEN = 0.00001    // $10.00 / 1,000,000
export const MAX_COST_PER_REQUEST_USD = 0.10
