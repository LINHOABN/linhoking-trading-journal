import { useState, useMemo } from 'react'
import { Search, Filter, Image as ImageIcon, ExternalLink, Tag, ArrowUpDown, Calendar, X, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react'
import type { Trade } from '../types'
import TradeDetailModal from './TradeDetailModal'

interface Props {
  trades: Trade[]
  onTradeUpdated?: (updatedTrade: Trade) => void
}

const SESSION_COLORS: Record<string, string> = {
  Asie: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Londres: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'Londres / NY': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'New York': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
}

const DAYS_OF_WEEK = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

function getDayOfWeekName(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const dateObj = new Date(year, month, day)
    return DAYS_OF_WEEK[dateObj.getDay()] || ''
  }
  return ''
}

function formatDateWithDayName(dateStr: string): string {
  if (!dateStr) return ''
  const dayName = getDayOfWeekName(dateStr)
  return `${dayName} ${dateStr}`
}

export default function TradeJournal({ trades, onTradeUpdated }: Props) {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState<string>('ALL')
  const [sessionFilter, setSessionFilter] = useState<string>('ALL')
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const [resultFilter, setResultFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL')
  const [dateSortOrder, setDateSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST')

  const resetAllFilters = () => {
    setSearchQuery('')
    setSelectedDate('')
    setDayOfWeekFilter('ALL')
    setSessionFilter('ALL')
    setDirectionFilter('ALL')
    setResultFilter('ALL')
  }

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedDate ||
    dayOfWeekFilter !== 'ALL' ||
    sessionFilter !== 'ALL' ||
    directionFilter !== 'ALL' ||
    resultFilter !== 'ALL'
  )

  const filteredTrades = useMemo(() => {
    let result = trades.filter((t) => {
      if (selectedDate && t.date !== selectedDate) return false
      if (dayOfWeekFilter !== 'ALL') {
        const dayName = getDayOfWeekName(t.date)
        if (dayName !== dayOfWeekFilter) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchSymbol = t.symbol.toLowerCase().includes(q)
        const matchStrategy = t.strategy?.toLowerCase().includes(q)
        const matchNote = t.note?.toLowerCase().includes(q)
        const matchMistake = t.mistake?.toLowerCase().includes(q)
        const matchConfluence = t.confluences?.some((c) => c.toLowerCase().includes(q))
        if (!matchSymbol && !matchStrategy && !matchNote && !matchMistake && !matchConfluence) return false
      }
      if (sessionFilter !== 'ALL' && t.session !== sessionFilter) return false
      if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false
      if (resultFilter === 'WIN' && t.pnl < 0) return false
      if (resultFilter === 'LOSS' && t.pnl >= 0) return false
      return true
    })

    result.sort((a, b) => {
      const dateTimeA = `${a.date}T${a.openTime || '00:00'}`
      const dateTimeB = `${b.date}T${b.openTime || '00:00'}`
      return dateSortOrder === 'NEWEST'
        ? dateTimeB.localeCompare(dateTimeA)
        : dateTimeA.localeCompare(dateTimeB)
    })

    return result
  }, [trades, searchQuery, selectedDate, dayOfWeekFilter, sessionFilter, directionFilter, resultFilter, dateSortOrder])

  const groupedTrades = useMemo(() => {
    const groups: { [date: string]: { trades: Trade[]; dailyPnl: number } } = {}
    for (const t of filteredTrades) {
      if (!groups[t.date]) {
        groups[t.date] = { trades: [], dailyPnl: 0 }
      }
      groups[t.date].trades.push(t)
      groups[t.date].dailyPnl += t.pnl
    }
    return Object.entries(groups)
  }, [filteredTrades])

  return (
    <div className="glass-panel rounded-2xl shadow-premium">
      {/* Filter Panel */}
      <div className="border-b border-graphite-700/40 px-6 py-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-sans text-[12px] font-bold uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
              Journal <span className="gradient-text font-extrabold">({filteredTrades.length} / {trades.length})</span>
            </h3>
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="flex items-center gap-1.5 text-[10px] font-bold text-signal-data hover:text-white bg-signal-data/10 hover:bg-signal-data border border-signal-data/30 rounded-lg px-2.5 py-0.5 transition-all"
              >
                <RotateCcw size={11} /> Réinitialiser
              </button>
            )}
          </div>

          {/* Direction & Result Tab Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-paper-100/50 dark:bg-graphite-800/50 rounded-lg p-1 border border-graphite-700/40">
              {[
                { key: 'ALL', label: 'Tous' },
                { key: 'BUY', label: '↑ BUY' },
                { key: 'SELL', label: '↓ SELL' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDirectionFilter(tab.key as any)}
                  className={`px-3 py-1 rounded-md font-mono text-[10px] font-bold transition-all ${directionFilter === tab.key
                    ? tab.key === 'BUY'
                      ? 'bg-signal-gain text-black shadow-glow-gain'
                      : tab.key === 'SELL'
                        ? 'bg-signal-loss text-white shadow-glow-loss'
                        : 'bg-signal-data text-white shadow-glow'
                    : 'text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-paper-50'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-paper-100/50 dark:bg-graphite-800/50 rounded-lg p-1 border border-graphite-700/40">
              {[
                { key: 'ALL', label: 'Tout' },
                { key: 'WIN', label: '✓ Gains' },
                { key: 'LOSS', label: '✗ Pertes' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setResultFilter(tab.key as any)}
                  className={`px-3 py-1 rounded-md font-mono text-[10px] font-bold transition-all ${resultFilter === tab.key
                    ? tab.key === 'WIN'
                      ? 'bg-signal-gain text-black shadow-glow-gain'
                      : tab.key === 'LOSS'
                        ? 'bg-signal-loss text-white shadow-glow-loss'
                        : 'bg-signal-data text-white shadow-glow'
                    : 'text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-paper-50'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search + Filters row */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <div className="relative sm:col-span-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher symbole, stratégie…"
              className="w-full bg-paper-50/80 dark:bg-graphite-800/50 border border-graphite-700/50 rounded-lg pl-9 pr-2 py-2 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data transition-colors"
            />
          </div>

          <div className="relative sm:col-span-3 flex items-center gap-1">
            <div className="relative flex-1">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-paper-50/80 dark:bg-graphite-800/50 border border-graphite-700/50 rounded-lg pl-8 pr-2 py-2 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data transition-colors"
              />
            </div>
            {selectedDate && (
              <button onClick={() => setSelectedDate('')} className="p-1.5 text-ink-500 hover:text-signal-loss border border-graphite-700/50 rounded-lg bg-paper-100 dark:bg-graphite-800 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="sm:col-span-2">
            <select
              value={dayOfWeekFilter}
              onChange={(e) => setDayOfWeekFilter(e.target.value)}
              className="w-full bg-paper-50/80 dark:bg-graphite-800/50 border border-graphite-700/50 rounded-lg px-2 py-2 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data transition-colors"
            >
              <option value="ALL">Tous les jours</option>
              <option value="Lundi">Lundi</option>
              <option value="Mardi">Mardi</option>
              <option value="Mercredi">Mercredi</option>
              <option value="Jeudi">Jeudi</option>
              <option value="Vendredi">Vendredi</option>
              <option value="Samedi">Samedi</option>
              <option value="Dimanche">Dimanche</option>
            </select>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Filter size={13} className="text-ink-500 shrink-0" />
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="w-full bg-paper-50/80 dark:bg-graphite-800/50 border border-graphite-700/50 rounded-lg px-2 py-2 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data transition-colors"
            >
              <option value="ALL">Toutes sessions</option>
              <option value="Asie">Asie</option>
              <option value="Londres">Londres</option>
              <option value="Londres / NY">Lon / NY</option>
              <option value="New York">New York</option>
            </select>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <ArrowUpDown size={13} className="text-ink-500 shrink-0" />
            <select
              value={dateSortOrder}
              onChange={(e) => setDateSortOrder(e.target.value as any)}
              className="w-full bg-paper-50/80 dark:bg-graphite-800/50 border border-graphite-700/50 rounded-lg px-2 py-2 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data transition-colors"
            >
              <option value="NEWEST">Plus récents</option>
              <option value="OLDEST">Plus anciens</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trades Grouped by Date */}
      <div className="divide-y divide-graphite-700/30 px-4 py-2">
        {groupedTrades.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <p className="font-mono text-[12px] text-ink-500">Aucun trade ne correspond aux filtres.</p>
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 border border-signal-data bg-signal-data/10 rounded-xl px-5 py-2 text-[11px] text-signal-data font-bold hover:bg-signal-data hover:text-white transition-all"
              >
                <RotateCcw size={12} /> Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          groupedTrades.map(([date, group]) => (
            <div key={date} className="py-3 space-y-2">
              {/* Daily Group Header */}
              <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-paper-100/60 dark:bg-graphite-800/40">
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-ink-900 dark:text-paper-50">
                  <Calendar size={12} className="text-signal-data" />
                  <span className="capitalize">{formatDateWithDayName(date)}</span>
                  <span className="text-[10px] text-ink-500 font-normal">
                    ({group.trades.length} trade{group.trades.length > 1 ? 's' : ''})
                  </span>
                </div>
                <div className="font-mono text-[11px] font-bold">
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] ${group.dailyPnl >= 0
                    ? 'bg-signal-gain/10 text-signal-gain border border-signal-gain/20'
                    : 'bg-signal-loss/10 text-signal-loss border border-signal-loss/20'
                    }`}>
                    {group.dailyPnl >= 0 ? '+' : ''}{group.dailyPnl.toFixed(2)} $
                  </span>
                </div>
              </div>

              {/* Trade Cards */}
              <div className="space-y-2 pl-2">
                {group.trades.map((t) => (
                  <TradeCard key={t.id} trade={t} onOpenModal={() => setSelectedTrade(t)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

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

function TradeCard({ trade, onOpenModal }: { trade: Trade; onOpenModal: () => void }) {
  const isWin = trade.pnl >= 0
  const sessionStyle =
    SESSION_COLORS[trade.session || ''] || 'bg-graphite-700/40 text-ink-300 border-graphite-700/50'

  const hasComment = Boolean(trade.note || trade.strategy || trade.mistake)
  const confluenceCount = trade.confluences?.length || 0
  const photoCount = trade.screenshots?.length || (trade.screenshotUrl ? 1 : 0)

  return (
    <div
      onClick={onOpenModal}
      className={`group cursor-pointer rounded-xl border transition-all duration-300 hover:scale-[1.005] hover:-translate-y-px hover:shadow-premium hover:z-10 relative overflow-hidden ${isWin
        ? 'border-signal-gain/20 hover:border-signal-gain/50 bg-gradient-to-r from-signal-gain/5 to-transparent'
        : 'border-signal-loss/20 hover:border-signal-loss/50 bg-gradient-to-r from-signal-loss/5 to-transparent'
        } dark:bg-graphite-800/20`}
    >
      {/* Subtle left border accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${isWin ? 'bg-signal-gain' : 'bg-signal-loss'}`} />

      <div className="pl-5 pr-4 py-3.5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[130px_1fr_auto]">
          {/* Time Column */}
          <div className="font-mono text-[11px] text-ink-500 dark:text-ink-300 flex flex-col justify-center gap-0.5">
            <div className="font-bold text-[12px] text-ink-900 dark:text-paper-50 group-hover:text-signal-data transition-colors">
              {getDayOfWeekName(trade.date)}
            </div>
            <div className="text-[10px] opacity-75">
              {trade.openTime} → {trade.closeTime}
            </div>
          </div>

          {/* Main info */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[14px] font-bold text-ink-900 dark:text-paper-50 group-hover:text-signal-data transition-colors">
                {trade.symbol}
              </span>

              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${trade.direction === 'BUY'
                ? 'bg-signal-gain/10 text-signal-gain border-signal-gain/20'
                : 'bg-signal-loss/10 text-signal-loss border-signal-loss/20'
                }`}>
                {trade.direction === 'BUY' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {trade.direction}
              </span>

              <span className="font-mono text-[11px] text-ink-500 dark:text-ink-400">
                {trade.volume.toFixed(2)} vol
              </span>

              {trade.session && (
                <span className={`px-2 py-0.5 border font-mono text-[9px] uppercase font-bold rounded-full ${sessionStyle}`}>
                  {trade.session}
                </span>
              )}
            </div>

            <div className="mt-1.5 font-mono text-[10px] text-ink-500/80 dark:text-ink-400">
              E: {trade.entryPrice} · S: {trade.exitPrice} · SL: {trade.stopLoss} · TP: {trade.takeProfit}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-ink-500">
              {confluenceCount > 0 && (
                <span className="flex items-center gap-1 text-signal-gain/80">
                  <Tag size={11} />
                  {confluenceCount} confl.
                </span>
              )}

              {photoCount > 0 && (
                <span className="flex items-center gap-1 text-signal-data/80">
                  <ImageIcon size={11} />
                  {photoCount} photo{photoCount > 1 ? 's' : ''}
                </span>
              )}

              <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all text-signal-data text-[10px] font-semibold translate-x-1 group-hover:translate-x-0">
                <ExternalLink size={11} />
                Voir analyse
              </span>
            </div>
          </div>

          {/* P&L */}
          <div className="flex flex-col items-end justify-center gap-0.5">
            <span className={`font-mono text-[17px] font-extrabold leading-none ${isWin
              ? 'text-signal-gain drop-shadow-[0_0_12px_rgba(47,191,113,0.3)]'
              : 'text-signal-loss drop-shadow-[0_0_12px_rgba(229,72,77,0.3)]'
              }`}>
              {isWin ? '+' : ''}{trade.pnl.toFixed(2)} $
            </span>
          </div>
        </div>

        {/* Comment preview */}
        {hasComment && (
          <div className="mt-3 ml-0 md:ml-[142px] border-l-2 border-signal-data/40 bg-paper-50/50 dark:bg-graphite-900/40 rounded-r-xl px-3 py-2 text-[11px] space-y-1">
            {trade.note && (
              <p className="text-ink-700 dark:text-paper-200 line-clamp-1 italic">"{trade.note}"</p>
            )}
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-ink-500">
              {trade.strategy && <span>Stratégie : <strong className="text-ink-700 dark:text-ink-300">{trade.strategy}</strong></span>}
              {trade.mistake && <span className="text-signal-warn">Erreur : <strong>{trade.mistake}</strong></span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
