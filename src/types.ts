export type Direction = 'long' | 'short'
export type TradeResult = 'win' | 'loss' | 'be'
export type TradeStatus = 'open' | 'closed' | 'archived'

export interface ChecklistItem {
  id: string
  label: string
  checked: boolean
}

export interface PartialClose {
  id: string
  sizeUsd: number
  exit: number
  closedAt: string
  rMultiple: number | null
  pnlPercent: number | null
  pnlUsd: number | null
}

export interface Trade {
  id: string
  status: TradeStatus
  openedAt: string
  closedAt?: string
  updatedAt: string
  // ── before entry ──
  symbol?: string
  direction?: Direction
  session?: string
  setup?: string
  timeframe?: string
  entry?: number
  stopLoss?: number
  takeProfit?: number
  riskPercent?: number
  positionUsd?: number
  riskUsd?: number
  leverage?: number
  plannedRR?: number | null
  confidence: number
  moodBefore?: string
  checklist: ChecklistItem[]
  // ── after close ──
  exit?: number
  closes?: PartialClose[]
  result?: TradeResult | null
  rMultiple?: number | null
  pnlPercent?: number | null
  pnlUsd?: number | null
  followedPlan?: boolean
  mistakes: string[]
  didWell: string[]
  moodAfter?: string
  lesson?: string
  screenshot?: string
  // ── review ──
  grade?: 'A' | 'B' | 'C'
  reviewed?: boolean
  reviewNote?: string
}
