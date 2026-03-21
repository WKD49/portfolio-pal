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
  accountStructure?: string
  rotationSuggested: string
  reasoning: string
  outcome?: string
  verdict?: string
}

export type LogStatus = 'pending' | 'acted' | 'passed'

export interface PortfolioAccount {
  description: string
  taxWrapper: string
  approxValue: string
  allocation: string
  primaryGoal?: string
}

export interface UserProfile {
  sessionDate: string
  marketNotes: string
  baseCurrency: string
  riskTolerance: number
  timeHorizon: string
  goals: string[]
  goalsOther?: string
  drawsIncome: boolean
  incomeStartDate: string
  accounts: PortfolioAccount[]
  fxExposures: string
}
