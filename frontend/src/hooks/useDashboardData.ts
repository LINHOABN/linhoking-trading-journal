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

export function useDashboardData(onRefreshUser?: () => void): DashboardData {
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
      const [tradesData, riskData, tierData, curveData, lotData, statsData, depositsData] = await Promise.all([
        api.getTrades().catch(() => [] as any[]),
        api.getRiskState().catch(() => null),
        api.getTier().catch(() => ({ tier: null, startingCapital: 58.18 })),
        api.getCapitalCurve().catch(() => []),
        api.getLotHistory().catch(() => []),
        api.getStatsSummary().catch(() => null),
        api.getDeposits().catch(() => ({ total_invested: 0, deposit_count: 0, deposits: [] })),
      ])
      setTrades(tradesData ?? [])

      const safeRisk = riskData as api.RiskState | null
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

      const safeTier = tierData as { tier: any; startingCapital: number }
      const capVal = safeRisk && safeRisk.capital !== 200 ? safeRisk.capital : (safeTier.startingCapital !== 200 ? safeTier.startingCapital : 58.18)
      setStartingCapital(safeTier.startingCapital !== 200 ? safeTier.startingCapital : capVal)
      setTotalInvested(depositsData.total_invested)
      setDeposits(depositsData.deposits)
      setCapitalCurve(curveData ?? [])
      setLotHistory(lotData ?? [])
      if (statsData) setStats(statsData)
      setError(null)
      onRefreshUser?.()
    } catch (e) {
      // Even on catastrophic error, don't show error — just stop loading
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
  }, [load])

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
