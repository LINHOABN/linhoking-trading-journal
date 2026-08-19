export type Direction = 'BUY' | 'SELL'

export type Emotion = 'confiant' | 'neutre' | 'stressé' | 'impatient' | 'discipliné'

export interface Trade {
  id: string
  date: string // ISO date
  openTime: string // HH:mm
  closeTime: string // HH:mm
  symbol: string
  direction: Direction
  volume: number
  entryPrice: number
  exitPrice: number
  stopLoss: number
  takeProfit: number
  pnl: number
  emotion?: string
  strategy?: string
  mistake?: string | null
  note?: string
  session?: string
  confluences?: string[]
  screenshotUrl: string | null
  screenshots?: string[]
  voiceUrl?: string | null
}

export interface CapitalPoint {
  date: string
  capital: number
}

export interface LotStep {
  date: string
  lot: number
}

export interface Tier {
  currentCapital: number
  activeLot: number
  currentRisk: number
  nextObjective: number
  lossesBeforeStepDown: number
  stepDownThreshold: number // capital below which lot decreases
}

export type AccountZone = 'green' | 'orange' | 'red'
