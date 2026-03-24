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

export interface AllocationItem {
  name: string
  percentage: string
  // Optional: raw fund composition data pasted/extracted from a product page.
  // Stored as plain text; the context builder parses it into sub-asset class weights.
  compositionData?: string
}

export interface PortfolioAccount {
  description: string
  taxWrapper: string
  approxValue: string
  allocation: AllocationItem[]
}

export interface UserProfile {
  sessionDate: string
  baseCurrency: string
  age: string
  riskTolerance: number
  timeHorizon: string
  goals: string[]
  goalsOther?: string
  drawsIncome: boolean
  incomeStartDate: string
  accounts: PortfolioAccount[]
  // Optional small pot for individual/concentrated positions (% of total portfolio)
  individualPositionsPct?: string
  // Optional supplementary market notes (alongside automatic macro data)
  marketNotes?: string
}
