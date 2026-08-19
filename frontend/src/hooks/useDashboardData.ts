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
        api.getTrades(),
        api.getRiskState(),
        api.getTier(),
        api.getCapitalCurve(),
        api.getLotHistory(),
        api.getStatsSummary(),
        api.getDeposits().catch(() => ({ total_invested: 0, deposit_count: 0, deposits: [] })),
      ])
      setTrades(tradesData)

      setRiskState((prevRisk) => {
        const cachedCapital = localStorage.getItem('linhoking_cached_capital')
        const prevCap = prevRisk?.capital || (cachedCapital ? parseFloat(cachedCapital) : null)

        // If the serverless container returned default 200 but we have a live non-200 balance, keep live balance
        if (riskData.capital === 200 && prevCap && prevCap !== 200) {
          return { ...riskData, capital: prevCap }
        }
        if (riskData.capital !== 200) {
          localStorage.setItem('linhoking_cached_capital', riskData.capital.toString())
        }
        return riskData
      })

      setStartingCapital(tierData.startingCapital)
      setTotalInvested(depositsData.total_invested)
      setDeposits(depositsData.deposits)
      setCapitalCurve(curveData)
      setLotHistory(lotData)
      setStats(statsData)
      setError(null)
      onRefreshUser?.()
    } catch (e) {
      setError(e instanceof api.ApiError ? e.message : 'Impossible de charger les données')
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
