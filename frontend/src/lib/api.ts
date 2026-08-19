import type { Trade, Tier, CapitalPoint, LotStep, Direction, Emotion } from '../types'

export function getApiUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '' // Use relative path on production host (Vercel)
  }
  return import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://localhost:8000' : '')
}

const TOKEN_KEY = 'linhoking_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function wsUrl(): string {
  const token = getToken()
  const apiUrl = getApiUrl()
  let base: string
  if (apiUrl) {
    base = apiUrl.replace(/^http/, 'ws')
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    base = `${proto}//${window.location.host}`
  }
  return `${base}/ws/live?token=${encodeURIComponent(token ?? '')}`
}

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${getApiUrl()}${path}`, { ...options, headers })

  if (!res.ok) {
    if (res.status === 401) {
      clearToken()
    }
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* no JSON body */
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---------- Auth ----------

export async function login(email: string, password: string): Promise<string> {
  // FastAPI's OAuth2PasswordRequestForm expects x-www-form-urlencoded, not JSON
  const body = new URLSearchParams({ username: email, password })
  const res = await fetch(`${getApiUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Échec de la connexion' }))
    throw new ApiError(res.status, err.detail ?? 'Échec de la connexion')
  }
  const data = await res.json()
  return data.access_token as string
}

export async function register(email: string, password: string): Promise<void> {
  await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export interface Me {
  id: string
  email: string
  mt5ApiKey: string
  mt5Balance: number | null
  mt5AccountNumber?: string | null
  mt5Broker?: string | null
  mt5Leverage?: number | null
  mt5Currency?: string | null
}

export async function getMe(): Promise<Me> {
  const data = await request<{
    id: string
    email: string
    mt5_api_key: string
    mt5_balance: number | null
    mt5_account_number?: string | null
    mt5_broker?: string | null
    mt5_leverage?: number | null
    mt5_currency?: string | null
  }>('/auth/me')
  return {
    id: data.id,
    email: data.email,
    mt5ApiKey: data.mt5_api_key,
    mt5Balance: data.mt5_balance ?? null,
    mt5AccountNumber: data.mt5_account_number ?? null,
    mt5Broker: data.mt5_broker ?? null,
    mt5Leverage: data.mt5_leverage ?? null,
    mt5Currency: data.mt5_currency ?? null,
  }
}

// ---------- Trades ----------

interface ApiTrade {
  id: string
  trade_date: string
  open_time: string
  close_time: string
  symbol: string
  direction: Direction
  volume: number
  entry_price: number
  exit_price: number
  stop_loss: number
  take_profit: number
  pnl: number
  emotion: string | null
  strategy: string | null
  mistake: string | null
  note: string | null
  session: string | null
  confluences: string | null
  screenshot_url: string | null
  voice_url: string | null
  mt5_ticket: string | null
  source: string
}

function mapTrade(t: ApiTrade): Trade {
  let parsedConfluences: string[] = []
  if (t.confluences) {
    try {
      const parsed = typeof t.confluences === 'string' ? JSON.parse(t.confluences) : t.confluences
      if (Array.isArray(parsed)) parsedConfluences = parsed
    } catch {
      parsedConfluences = []
    }
  }

  let parsedScreenshots: string[] = []
  if (t.screenshot_url) {
    try {
      const parsed = typeof t.screenshot_url === 'string' ? JSON.parse(t.screenshot_url) : t.screenshot_url
      if (Array.isArray(parsed)) {
        parsedScreenshots = parsed
      } else if (t.screenshot_url) {
        parsedScreenshots = [String(t.screenshot_url)]
      }
    } catch {
      if (t.screenshot_url) parsedScreenshots = [String(t.screenshot_url)]
    }
  }

  const openTimeStr = typeof t.open_time === 'string' ? t.open_time : (t.open_time ? String(t.open_time) : '00:00')
  const closeTimeStr = typeof t.close_time === 'string' ? t.close_time : (t.close_time ? String(t.close_time) : '00:00')

  return {
    id: t.id,
    date: String(t.trade_date || ''),
    openTime: openTimeStr.slice(0, 5),
    closeTime: closeTimeStr.slice(0, 5),
    symbol: t.symbol || 'XAUUSD',
    direction: t.direction || 'BUY',
    volume: t.volume ?? 0.01,
    entryPrice: t.entry_price ?? 0,
    exitPrice: t.exit_price ?? 0,
    stopLoss: t.stop_loss ?? 0,
    takeProfit: t.take_profit ?? 0,
    pnl: t.pnl ?? 0,
    emotion: t.emotion ?? undefined,
    strategy: t.strategy ?? '',
    mistake: t.mistake ?? undefined,
    note: t.note ?? '',
    session: t.session ?? undefined,
    confluences: parsedConfluences,
    screenshotUrl: parsedScreenshots.length > 0 ? parsedScreenshots[0] : null,
    screenshots: parsedScreenshots,
    voiceUrl: t.voice_url ?? null,
  }
}

export async function getTrades(): Promise<Trade[]> {
  const data = await request<ApiTrade[]>('/trades')
  return data.map(mapTrade)
}

export interface NewTradeInput {
  date: string
  openTime: string
  closeTime: string
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
  mistake?: string
  note?: string
  session?: string
  confluences?: string[]
  screenshotUrl?: string
}

export async function createTrade(input: NewTradeInput): Promise<Trade> {
  const data = await request<ApiTrade>('/trades', {
    method: 'POST',
    body: JSON.stringify({
      trade_date: input.date,
      open_time: input.openTime,
      close_time: input.closeTime,
      symbol: input.symbol,
      direction: input.direction,
      volume: input.volume,
      entry_price: input.entryPrice,
      exit_price: input.exitPrice,
      stop_loss: input.stopLoss,
      take_profit: input.takeProfit,
      pnl: input.pnl,
      emotion: input.emotion,
      strategy: input.strategy,
      mistake: input.mistake,
      note: input.note,
      session: input.session,
      confluences: input.confluences ? JSON.stringify(input.confluences) : undefined,
      screenshot_url: input.screenshotUrl,
    }),
  })
  return mapTrade(data)
}

export async function updateTrade(
  tradeId: string,
  patch: Partial<NewTradeInput>
): Promise<Trade> {
  const data = await request<ApiTrade>(`/trades/${tradeId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      emotion: patch.emotion,
      strategy: patch.strategy,
      mistake: patch.mistake,
      note: patch.note,
      session: patch.session,
      confluences: patch.confluences ? JSON.stringify(patch.confluences) : undefined,
      screenshot_url: patch.screenshotUrl,
    }),
  })
  return mapTrade(data)
}

export async function uploadTradeScreenshot(tradeId: string, file: File): Promise<Trade> {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${getApiUrl()}/trades/${tradeId}/screenshot`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!res.ok) {
    throw new Error("Erreur lors de l'envoi de l'image")
  }
  const data: ApiTrade = await res.json()
  return mapTrade(data)
}

export async function deleteTradeScreenshot(tradeId: string, url: string): Promise<Trade> {
  const data = await request<ApiTrade>(`/trades/${tradeId}/screenshot?url=${encodeURIComponent(url)}`, {
    method: 'DELETE',
  })
  return mapTrade(data)
}

export async function uploadTradeVoice(tradeId: string, fileOrBlob: Blob): Promise<Trade> {
  const base64Url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(fileOrBlob)
  })

  const data = await request<ApiTrade>(`/trades/${tradeId}/voice_base64`, {
    method: 'POST',
    body: JSON.stringify({ audio_base64: base64Url }),
  })
  return mapTrade(data)
}

export async function deleteTradeVoice(tradeId: string): Promise<Trade> {
  const data = await request<ApiTrade>(`/trades/${tradeId}/voice`, {
    method: 'DELETE',
  })
  return mapTrade(data)
}

// ---------- Tier engine ----------

interface ApiTier {
  starting_capital: number
  current_capital: number
  active_lot: number
  current_risk: number
  next_objective: number
  step_down_threshold: number
  losses_before_step_down: number
  consecutive_losses: number
}

function mapTier(t: ApiTier): Tier {
  return {
    currentCapital: t.current_capital,
    activeLot: t.active_lot,
    currentRisk: t.current_risk,
    nextObjective: t.next_objective,
    lossesBeforeStepDown: t.losses_before_step_down,
    stepDownThreshold: t.step_down_threshold,
  }
}

export async function getTier(): Promise<{ tier: Tier; startingCapital: number }> {
  const data = await request<ApiTier>('/tiers/me')
  return { tier: mapTier(data), startingCapital: data.starting_capital }
}

export async function updateTier(patch: { startingCapital?: number; currentCapital?: number }): Promise<void> {
  await request('/tiers/me', {
    method: 'PUT',
    body: JSON.stringify({
      starting_capital: patch.startingCapital,
      current_capital: patch.currentCapital,
    }),
  })
}

// ---------- Stats ----------

export interface StatsSummary {
  winRate: number
  totalTrades: number
  avgWin: number
  avgLoss: number
  bestDay: string | null
  bestDayPnl: number | null
  worstDay: string | null
  worstDayPnl: number | null
  bestHour: string | null
}

export async function getStatsSummary(): Promise<StatsSummary> {
  const data = await request<{
    win_rate: number
    total_trades: number
    avg_win: number
    avg_loss: number
    best_day: string | null
    best_day_pnl: number | null
    worst_day: string | null
    worst_day_pnl: number | null
    best_hour: string | null
  }>('/stats/summary')
  return {
    winRate: data.win_rate,
    totalTrades: data.total_trades,
    avgWin: data.avg_win,
    avgLoss: data.avg_loss,
    bestDay: data.best_day,
    bestDayPnl: data.best_day_pnl,
    worstDay: data.worst_day,
    worstDayPnl: data.worst_day_pnl,
    bestHour: data.best_hour,
  }
}

export async function getCapitalCurve(): Promise<CapitalPoint[]> {
  return request<CapitalPoint[]>('/stats/capital-curve')
}

export async function getLotHistory(): Promise<LotStep[]> {
  return request<LotStep[]>('/stats/lot-history')
}

// ---------- Risk Engine ----------

export interface RiskState {
  capital: number
  niveau: number
  lot: number
  risque: number
  objectif: number
  reste: number
  progression: number
  pertes_restantes: number
  etat: string
}

export interface RiskLevelConfig {
  id: number
  niveau: number
  objectif: number
  lot: number
  risque: number
}

export async function getRiskState(): Promise<RiskState> {
  return request<RiskState>('/risk/state')
}

export async function getRiskLevels(): Promise<RiskLevelConfig[]> {
  return request<RiskLevelConfig[]>('/risk/levels')
}

export async function updateRiskLevel(
  niveau: number,
  patch: Partial<Pick<RiskLevelConfig, 'objectif' | 'lot' | 'risque'>>
): Promise<RiskLevelConfig> {
  return request<RiskLevelConfig>(`/risk/levels/${niveau}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

export { ApiError }

// ---------- Deposits ----------

export interface Deposit {
  id: string
  amount: number
  label: string | null
  deposit_date: string
  created_at: string
}

export interface DepositsTotal {
  total_invested: number
  deposit_count: number
  deposits: Deposit[]
}

export async function getDeposits(): Promise<DepositsTotal> {
  return request<DepositsTotal>('/deposits/')
}

export async function addDeposit(payload: { amount: number; label?: string; deposit_date?: string }): Promise<Deposit> {
  return request<Deposit>('/deposits/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteDeposit(depositId: string): Promise<void> {
  return request<void>(`/deposits/${depositId}`, { method: 'DELETE' })
}

export async function rotateMt5Key(): Promise<{ mt5_api_key: string }> {
  return request<{ mt5_api_key: string }>('/mt5/rotate-key', { method: 'POST' })
}
