import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import { useLiveSocket } from './useLiveSocket'
import type { Trade, CapitalPoint, LotStep } from '../types'

interface DashboardData {
  trades: Trade[]
  riskState: api.RiskState | null
  startingCapital: number
  totalInvested: number
  deposits: api.Deposit[]
  capitalCurve: CapitalPoint[]
  lotHistory: LotStep[]
  stats: api.StatsSummary | null
  loading: boolean
  error: string | null
  liveConnected: boolean
  refetch: () => void
}

export function useDashboardData(onRefreshUser?: () => void, user?: api.Me | null): DashboardData {
  const [trades, setTrades] = useState<Trade[]>([])
  const [riskState, setRiskState] = useState<api.RiskState | null>(null)
  const [startingCapital, setStartingCapital] = useState(0)
  const [totalInvested, setTotalInvested] = useState(0)
  const [deposits, setDeposits] = useState<api.Deposit[]>([])
  const [capitalCurve, setCapitalCurve] = useState<CapitalPoint[]>([])
  const [lotHistory, setLotHistory] = useState<LotStep[]>([])
  const [stats, setStats] = useState<api.StatsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!api.getToken()) {
      setLoading(false)
      return
    }
    try {
      const summary = await api.getDashboardSummary()
      setTrades(summary.trades ?? [])

      const safeRisk = summary.risk_state
      setRiskState((prevRisk) => {
        if (!safeRisk) return prevRisk // keep previous on failure
        const cachedCapital = localStorage.getItem('linhoking_cached_capital')
        const prevCap = prevRisk?.capital || (cachedCapital ? parseFloat(cachedCapital) : null)

        if (safeRisk.capital === 200 && prevCap && prevCap !== 200) {
          return { ...safeRisk, capital: prevCap }
        }
        if (safeRisk.capital !== 200) {
          localStorage.setItem('linhoking_cached_capital', safeRisk.capital.toString())
        }
        return safeRisk
      })

      const safeTier = summary.tier ?? { tier: null, startingCapital: 58.18 }
      const capVal = safeRisk && safeRisk.capital !== 200 ? safeRisk.capital : (safeTier.startingCapital !== 200 ? safeTier.startingCapital : 58.18)
      setStartingCapital(safeTier.startingCapital !== 200 ? safeTier.startingCapital : capVal)
      setTotalInvested(summary.deposits?.total_invested ?? 0)
      setDeposits(summary.deposits?.deposits ?? [])
      setCapitalCurve(summary.capital_curve ?? [])
      setLotHistory(summary.lot_history ?? [])
      if (summary.stats) setStats(summary.stats)
      setError(null)
      onRefreshUser?.()
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
    }
  }, [onRefreshUser])

  useEffect(() => {
    load()
    const interval = setInterval(() => {
      load()
    }, 5000)
    return () => clearInterval(interval)
  }, [load, user])

  // Any live event (new trade, MT5 sync) triggers a refetch
  const liveConnected = useLiveSocket(true, load)

  return {
    trades,
    riskState,
    startingCapital,
    totalInvested,
    deposits,
    capitalCurve,
    lotHistory,
    stats,
    loading,
    error,
    liveConnected,
    refetch: load,
  }
}
