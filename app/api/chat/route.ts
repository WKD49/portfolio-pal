import { NextRequest } from 'next/server'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { Message, LogEntry } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { messages, logContext }: { messages: Message[]; logContext: LogEntry[] } = await req.json()

  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not set' }), { status: 500 })
  }

  // Build system message — inject log context if available
  let systemContent = SYSTEM_PROMPT
  if (logContext && logContext.length > 0) {
    const logSummary = logContext
      .map((entry, i) => {
        const lines = [
          `Recommendation ${i + 1} (${entry.date}):`,
          `  Currency: ${entry.baseCurrency} | FX: ${entry.fxConditions}`,
          `  Market context: ${entry.marketContext}`,
          `  Rotation: ${entry.rotationSuggested}`,
          `  Reasoning: ${entry.reasoning}`,
        ]
        if (entry.outcome) lines.push(`  Outcome: ${entry.outcome}`)
        if (entry.verdict) lines.push(`  Verdict: ${entry.verdict}`)
        return lines.join('\n')
      })
      .join('\n\n')

    systemContent += `\n\nPREVIOUS RECOMMENDATION LOG:\n${logSummary}`
  }

  const openaiMessages = [
    { role: 'system', content: systemContent },
    ...messages.filter((m) => m.role !== 'system'),
  ]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: openaiMessages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    return new Response(JSON.stringify({ error }), { status: response.status })
  }

  // Stream the response directly back to the client
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
