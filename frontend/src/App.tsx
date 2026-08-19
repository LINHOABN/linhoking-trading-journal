import { useState } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useDashboardData } from './hooks/useDashboardData'
import Header from './components/Header'
import LoginScreen from './components/LoginScreen'
import CapitalHero from './components/CapitalHero'
import EmotionalGauge from './components/EmotionalGauge'
import TierLadder from './components/TierLadder'
import CapitalCurveChart from './components/CapitalCurveChart'
import RiskEvolutionChart from './components/RiskEvolutionChart'
import LotHistoryChart from './components/LotHistoryChart'
import TradeJournal from './components/TradeJournal'
import TradingCalendar from './components/TradingCalendar'
import StatsPanel from './components/StatsPanel'
import EditStartingCapitalModal from './components/EditStartingCapitalModal'
import MT5Modal from './components/MT5Modal'

function Dashboard() {
  const [isEditCapitalOpen, setIsEditCapitalOpen] = useState(false)
  const [isMt5ModalOpen, setIsMt5ModalOpen] = useState(false)
  const { user, refreshUser } = useAuth()
  const {
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
    refetch,
  } = useDashboardData(refreshUser, user)
  const mt5Balance = user?.mt5Balance ?? null

  const handleRefetch = () => {
    refetch()
    refreshUser()
  }

  const now = new Date()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-50 dark:bg-graphite-900">
        <span className="font-mono text-[12px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
          Chargement du journal…
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper-50 px-6 dark:bg-graphite-900">
        <span className="font-mono text-[12px] text-signal-loss">{error}</span>
        <button
          onClick={refetch}
          className="border border-graphite-700 px-4 py-2 font-mono text-[11px] uppercase tracking-widest2 text-ink-900 dark:text-paper-50"
        >
          Réessayer
        </button>
      </div>
    )
  }

  const fallbackRisk = riskState ?? {
    capital: mt5Balance ?? 58.18,
    niveau: 1,
    lot: 0.01,
    risque: 1,
    objectif: 70,
    reste: 11.82,
    progression: 30,
    pertes_restantes: 3,
    etat: 'vert',
  }

  const fallbackStats = stats ?? {
    winRate: 0,
    totalTrades: 0,
    avgWin: 0,
    avgLoss: 0,
    bestDay: null,
    bestDayPnl: null,
    worstDay: null,
    worstDayPnl: null,
    bestHour: null,
  }

  return (
    <div className="min-h-screen bg-paper-50 text-ink-900 transition-colors dark:bg-graphite-900 dark:text-paper-50">
      <Header liveConnected={liveConnected} onOpenMt5Modal={() => setIsMt5ModalOpen(true)} />

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <CapitalHero
          curve={capitalCurve}
          startingCapital={startingCapital || 58.18}
          totalInvested={totalInvested}
          deposits={deposits}
          mt5Balance={mt5Balance}
          onEditStartingCapital={() => setIsEditCapitalOpen(true)}
          onDepositsUpdated={handleRefetch}
        />

        <div className="mt-4 space-y-4">
          <TierLadder risk={fallbackRisk} />
          <EmotionalGauge risk={fallbackRisk} />
        </div>

        {(() => {
          const liveCap = mt5Balance !== null ? mt5Balance : fallbackRisk.capital
          const fallbackCurve = [
            { date: 'Départ', capital: liveCap },
            { date: 'Aujourd\'hui', capital: liveCap }
          ]
          return (
            <div className="mt-6 space-y-6">
              <CapitalCurveChart data={capitalCurve.length > 0 ? capitalCurve : fallbackCurve} />
              <RiskEvolutionChart data={capitalCurve.length > 0 ? capitalCurve : fallbackCurve} trades={trades} />
              <LotHistoryChart data={lotHistory.length > 0 ? lotHistory : [
                { date: 'Initial', lot: fallbackRisk.lot }
              ]} />
            </div>
          )
        })()}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TradingCalendar trades={trades} onTradeUpdated={handleRefetch} />
          </div>
          <StatsPanel stats={fallbackStats} />
        </div>

        <div className="mt-4">
          <TradeJournal trades={trades} onTradeUpdated={handleRefetch} />
        </div>

        <footer className="mt-8 border-t border-graphite-700 pt-4 pb-2 text-center font-mono text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
          LINHOKING · Session XAU/USD intraday
        </footer>
      </main>

      <EditStartingCapitalModal
        initialCapital={startingCapital || 200}
        isOpen={isEditCapitalOpen}
        onClose={() => setIsEditCapitalOpen(false)}
        onSaved={handleRefetch}
      />

      <MT5Modal
        user={user}
        isOpen={isMt5ModalOpen}
        onClose={() => setIsMt5ModalOpen(false)}
        onKeyRotated={handleRefetch}
      />
    </div>
  )
}

function Root() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-50 dark:bg-graphite-900">
        <span className="font-mono text-[12px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
          …
        </span>
      </div>
    )
  }

  return user ? <Dashboard /> : <LoginScreen />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ThemeProvider>
  )
}
