import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, ExternalLink, Activity } from 'lucide-react'
import type { Trade } from '../types'
import TradeDetailModal from './TradeDetailModal'
import { safeFixed } from '../lib/formatters'

interface Props {
  trades: Trade[]
  initialYear?: number
  initialMonth?: number // 0-indexed
  onTradeUpdated?: (updatedTrade: Trade) => void
}

export default function TradingCalendar({ trades, initialYear, initialMonth, onTradeUpdated }: Props) {
  const now = new Date()
  const [currentYear, setCurrentYear] = useState<number>(initialYear ?? now.getFullYear())
  const [currentMonth, setCurrentMonth] = useState<number>(initialMonth ?? now.getMonth())

  // Modal State
  const [dayTradesModalDate, setDayTradesModalDate] = useState<string | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  // Extract all distinct year-month pairs present in trades data for quick selection
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    set.add(`${now.getFullYear()}-${now.getMonth()}`)

    for (const t of trades) {
      if (t.date) {
        const [y, m] = t.date.split('-').map(Number)
        if (y && m) set.add(`${y}-${m - 1}`)
      }
    }

    return Array.from(set)
      .map((key) => {
        const [y, m] = key.split('-').map(Number)
        const dateObj = new Date(y, m, 1)
        const label = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        return { key, year: y, month: m, label: label.charAt(0).toUpperCase() + label.slice(1) }
      })
      .sort((a, b) => b.year - a.year || b.month - a.month)
  }, [trades])

  // Build a map of daily PnL and trades list
  const dayMap = useMemo(() => {
    const map = new Map<string, { pnl: number; trades: Trade[] }>()
    for (const t of trades) {
      const existing = map.get(t.date) ?? { pnl: 0, trades: [] }
      existing.pnl += t.pnl
      existing.trades.push(t)
      map.set(t.date, existing)
    }
    return map
  }, [trades])

  // Trades for selected modal date
  const modalTrades = useMemo(() => {
    if (!dayTradesModalDate) return []
    return dayMap.get(dayTradesModalDate)?.trades || []
  }, [dayTradesModalDate, dayMap])

  // Handle day click
  const handleDayClick = (dateKey: string) => {
    const entry = dayMap.get(dateKey)
    if (!entry || entry.trades.length === 0) return

    if (entry.trades.length === 1) {
      // Direct open if single trade
      setSelectedTrade(entry.trades[0])
    } else {
      // Open selector popup if multiple trades
      setDayTradesModalDate(dateKey)
    }
  }

  // Calculate statistics for the selected month
  const monthStats = useMemo(() => {
    let monthlyPnl = 0
    let monthlyTradesCount = 0
    let monthlyWins = 0

    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    for (const t of trades) {
      if (t.date && t.date.startsWith(monthStr)) {
        monthlyPnl += t.pnl
        monthlyTradesCount += 1
        if (t.pnl >= 0) monthlyWins += 1
      }
    }

    const winRate = monthlyTradesCount > 0 ? (monthlyWins / monthlyTradesCount) * 100 : 0
    return { monthlyPnl, monthlyTradesCount, winRate }
  }, [trades, currentYear, currentMonth])

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const handleSelectMonth = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [y, m] = e.target.value.split('-').map(Number)
    setCurrentYear(y)
    setCurrentMonth(m)
  }

  const firstDay = new Date(currentYear, currentMonth, 1)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const startWeekday = (firstDay.getDay() + 6) % 7 // Monday-first

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthLabel = firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const formattedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
  const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-premium space-y-5 transition-all duration-300">
      {/* Calendar Header with Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon size={14} className="text-signal-data animate-bounce-slow" />
          <h3 className="font-sans text-[12px] font-bold uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
            Calendrier · <span className="gradient-text font-extrabold">{formattedMonthLabel}</span>
          </h3>
        </div>

        {/* Controls: Prev/Next buttons & Month dropdown */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 border border-graphite-700/50 rounded-lg bg-graphite-800/10 hover:bg-graphite-800/30 text-ink-500 hover:text-paper-50 dark:hover:text-paper-50 transition-all cursor-pointer"
            title="Mois précédent"
          >
            <ChevronLeft size={14} />
          </button>

          <select
            value={`${currentYear}-${currentMonth}`}
            onChange={handleSelectMonth}
            className="bg-paper-100 dark:bg-graphite-800 border border-graphite-700/50 rounded-lg px-3 py-1 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data transition-colors cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m.key} value={m.key} className="bg-paper-50 dark:bg-graphite-900 text-ink-900 dark:text-paper-50">
                {m.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleNextMonth}
            className="p-1.5 border border-graphite-700/50 rounded-lg bg-graphite-800/10 hover:bg-graphite-800/30 text-ink-500 hover:text-paper-50 dark:hover:text-paper-50 transition-all cursor-pointer"
            title="Mois suivant"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Monthly Summary Bar */}
      <div className="grid grid-cols-3 divide-x divide-graphite-700/40 border-y border-graphite-700/40 py-3 font-mono text-[11px] bg-graphite-800/5 dark:-mx-6 dark:px-6">
        <div className="text-center flex flex-col items-center justify-center gap-0.5">
          <span className="text-[10px] text-ink-500 dark:text-ink-400 uppercase tracking-wider">Trades</span>
          <span className="font-bold text-[14px] text-ink-900 dark:text-paper-50">{monthStats.monthlyTradesCount}</span>
        </div>
        <div className="text-center flex flex-col items-center justify-center gap-0.5">
          <span className="text-[10px] text-ink-500 dark:text-ink-400 uppercase tracking-wider">Win Rate</span>
          <span className="font-bold text-[14px] text-ink-900 dark:text-paper-50">{safeFixed(monthStats.winRate, 1)}%</span>
        </div>
        <div className="text-center flex flex-col items-center justify-center gap-0.5">
          <span className="text-[10px] text-ink-500 dark:text-ink-400 uppercase tracking-wider">P&L Mensuel</span>
          <span
            className={`font-mono text-[15px] font-bold ${monthStats.monthlyPnl >= 0 ? 'text-signal-gain drop-shadow-[0_0_10px_rgba(47,191,113,0.25)]' : 'text-signal-loss drop-shadow-[0_0_10px_rgba(229,72,77,0.25)]'
              }`}
          >
            {monthStats.monthlyPnl >= 0 ? '+' : ''}
            {safeFixed(monthStats.monthlyPnl)} $
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((w) => (
          <div
            key={w}
            className="py-2 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-ink-500 dark:text-ink-300"
          >
            {w}
          </div>
        ))}

        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={idx} className="aspect-square bg-transparent rounded-lg opacity-25" />
          }
          const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const entry = dayMap.get(dateKey)
          const hasTrades = Boolean(entry && entry.trades.length > 0)
          const isWin = entry && entry.pnl >= 0
          const isLoss = entry && entry.pnl < 0

          return (
            <div
              key={idx}
              onClick={() => hasTrades && handleDayClick(dateKey)}
              className={`aspect-square rounded-xl p-2 flex flex-col justify-between transition-all duration-300 relative border group ${hasTrades
                ? 'cursor-pointer hover:scale-105 hover:-translate-y-0.5 hover:shadow-premium hover:z-20'
                : 'pointer-events-none'
                } ${isWin
                  ? 'bg-gradient-to-br from-signal-gain/5 via-signal-gain/10 to-signal-gain/15 border-signal-gain/30 hover:border-signal-gain shadow-glow-gain/5'
                  : isLoss
                    ? 'bg-gradient-to-br from-signal-loss/5 via-signal-loss/10 to-signal-loss/15 border-signal-loss/30 hover:border-signal-loss shadow-glow-loss/5'
                    : 'bg-paper-100/50 dark:bg-graphite-800/30 border-transparent hover:border-graphite-700/50'
                }`}
            >
              <div className="flex items-center justify-between font-mono text-[10px] z-10">
                <span className="text-ink-500 dark:text-ink-300 font-medium group-hover:text-ink-900 dark:group-hover:text-paper-50 transition-colors">
                  {day}
                </span>
                {hasTrades && (
                  <span className="text-[8px] px-1.5 py-0.2 bg-graphite-700 dark:bg-graphite-700 text-paper-50 rounded-full font-extrabold">
                    {entry!.trades.length}T
                  </span>
                )}
              </div>

              {entry && (
                <div
                  className={`font-mono text-[10px] font-bold leading-tight z-10 ${isWin ? 'text-signal-gain' : 'text-signal-loss'
                    }`}
                >
                  {isWin ? '+' : ''}
                  {safeFixed(entry.pnl, 0)} $
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal: Multi-Trades Selector for a specific day */}
      {dayTradesModalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-graphite-700/60 bg-paper-50 dark:bg-graphite-900 rounded-2xl p-6 shadow-premium space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-graphite-700/40 pb-3">
              <div>
                <h3 className="font-sans text-[14px] font-bold text-ink-900 dark:text-paper-50 flex items-center gap-2">
                  <Activity size={14} className="text-signal-data" />
                  Positions du {dayTradesModalDate}
                </h3>
                <p className="font-mono text-[10px] text-ink-500 mt-1">
                  {modalTrades.length} position{modalTrades.length > 1 ? 's' : ''} clôturée{modalTrades.length > 1 ? 's' : ''}
                </p>
              </div>

              <button
                onClick={() => setDayTradesModalDate(null)}
                className="text-ink-500 hover:text-ink-900 dark:hover:text-paper-50 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="divide-y divide-graphite-700/40 max-h-[350px] overflow-y-auto pr-1">
              {modalTrades.map((t) => {
                const isWin = t.pnl >= 0
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setDayTradesModalDate(null)
                      setSelectedTrade(t)
                    }}
                    className="group cursor-pointer py-3.5 px-2 hover:bg-graphite-800/10 dark:hover:bg-graphite-800/20 rounded-xl transition-all flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-mono text-[12px]">
                        <span className="font-bold text-ink-900 dark:text-paper-50 group-hover:text-signal-data transition-colors">
                          {t.symbol}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${t.direction === 'BUY' ? 'bg-signal-gain/10 text-signal-gain' : 'bg-signal-loss/10 text-signal-loss'
                            }`}
                        >
                          {t.direction}
                        </span>
                        <span className="text-ink-500 text-[10px]">
                          {safeFixed(t.volume)} Vol
                        </span>
                      </div>

                      <div className="font-mono text-[10px] text-ink-500">
                        {t.openTime} – {t.closeTime} {t.session ? `· Session ${t.session}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-sm font-bold ${isWin ? 'text-signal-gain' : 'text-signal-loss'}`}
                      >
                        {isWin ? '+' : ''}
                        {safeFixed(t.pnl)} $
                      </span>

                      <ExternalLink size={13} className="text-ink-500 group-hover:text-signal-data transition-colors" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onTradeUpdated={(updated) => {
            setSelectedTrade(updated)
            onTradeUpdated?.(updated)
          }}
        />
      )}
    </div>
  )
}
