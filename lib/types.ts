export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LogEntry {
  id: string
  date: string
  marketContext: string
  baseCurrency: string
  fxConditions: string
  rotationSuggested: string
  reasoning: string
  outcome?: string
  verdict?: string
}

export type LogStatus = 'pending' | 'acted' | 'passed'
