import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import type { LotStep } from '../types'
import { formatShortDate, formatFullDate, safeFixed } from '../lib/formatters'
import { useTheme } from '../context/ThemeContext'
import { BarChart3, Table as TableIcon, Layers } from 'lucide-react'

interface Props {
  data: LotStep[]
}

export default function LotHistoryChart({ data }: Props) {
  const { theme } = useTheme()
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')

  const gridColor = theme === 'dark' ? '#262B33' : '#DDE1E6'
  const textColor = theme === 'dark' ? '#8B92A0' : '#5B6470'

  const displayData = data && data.length > 0 ? data : [{ date: "Aujourd'hui", lot: 0.01 }]
  const chartPoints = displayData.map((item) => ({
    date: item?.date || "Aujourd'hui",
    lot: typeof item?.lot === 'number' && !isNaN(item.lot) ? item.lot : 0.01,
  }))

  const lots = chartPoints.map((p) => p.lot)
  const count = lots.length
  const totalVolume = lots.reduce((acc, curr) => acc + (typeof curr === 'number' && !isNaN(curr) ? curr : 0), 0)
  const avgLot = count > 0 ? totalVolume / count : 0.01
  const minLot = count > 0 ? Math.min(...lots) : 0.01
  const maxLot = count > 0 ? Math.max(...lots) : 0.01
  const lastLot = count > 0 ? (lots[lots.length - 1] ?? 0.01) : 0.01

  const yMin = Math.max(0, Math.floor((minLot - 0.01) * 100) / 100)
  const yMax = minLot === maxLot ? Math.ceil((maxLot + 0.03) * 100) / 100 : Math.ceil((maxLot + 0.02) * 100) / 100
  const yDomain: [number, number] = [yMin, yMax]


  return (
    <div className="border border-graphite-700 dark:border-graphite-700 p-6 bg-paper-50 dark:bg-graphite-900 rounded">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span className="text-[11px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300 font-mono font-bold">
              Historique des Lots Exécutés
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-[22px] font-bold text-blue-500">
              {safeFixed(lastLot)} <span className="text-xs font-normal text-ink-400">lot(s) actuel</span>
            </span>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-paper-200 dark:bg-graphite-800 rounded border border-graphite-700">
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded transition-colors ${viewMode === 'chart'
              ? 'bg-blue-600 text-white font-semibold shadow'
              : 'text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white'
              }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Courbe
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded transition-colors ${viewMode === 'table'
              ? 'bg-blue-600 text-white font-semibold shadow'
              : 'text-ink-500 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white'
              }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Tableau ({count})
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-paper-100 dark:bg-graphite-800/60 rounded border border-graphite-700/50 text-[11px] font-mono">
        <div>
          <div className="text-ink-400 text-[10px]">Total Trades Executés</div>
          <div className="font-bold text-ink-900 dark:text-paper-50">{count} trade(s)</div>
        </div>
        <div>
          <div className="text-ink-400 text-[10px]">Volume Total Cumulé</div>
          <div className="font-bold text-blue-500">{safeFixed(totalVolume)} lots</div>
        </div>
        <div>
          <div className="text-ink-400 text-[10px]">Lot Moyen</div>
          <div className="font-bold text-ink-900 dark:text-paper-50">{safeFixed(avgLot)} lot</div>
        </div>
        <div>
          <div className="text-ink-400 text-[10px]">Lot Max Atteint</div>
          <div className="font-bold text-emerald-500">{safeFixed(maxLot)} lot</div>
        </div>
      </div>

      {/* Main View Content */}
      {viewMode === 'chart' ? (
        <div className="mt-5 h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPoints} margin={{ top: 20, right: 15, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="lotFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 10, fill: textColor, fontFamily: 'IBM Plex Mono' }}
                stroke={gridColor}
              />
              <YAxis
                tick={{ fontSize: 10, fill: textColor, fontFamily: 'IBM Plex Mono' }}
                stroke={gridColor}
                domain={yDomain}
                allowDecimals={true}
                tickFormatter={(val) => `${safeFixed(val)} lot`}
              />
              <Tooltip content={<CustomTooltip theme={theme} gridColor={gridColor} textColor={textColor} />} />
              <ReferenceLine y={lastLot} stroke="#3B82F6" strokeDasharray="4 4" opacity={0.6} />
              <Area
                type="stepAfter"
                dataKey="lot"
                stroke="#3B82F6"
                strokeWidth={2.5}
                fill="url(#lotFill)"
                dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#60A5FA', stroke: '#1E3A8A', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4 max-h-[340px] overflow-y-auto border border-graphite-700 rounded">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="sticky top-0 bg-paper-200 dark:bg-graphite-800 text-ink-500 dark:text-ink-300 border-b border-graphite-700">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Volume (Lot)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-700/50">
              {chartPoints.map((item, idx) => (
                <tr key={idx} className="hover:bg-paper-100 dark:hover:bg-graphite-800/40 transition-colors">
                  <td className="py-2 px-3 text-ink-400">{chartPoints.length - idx}</td>
                  <td className="py-2 px-3 text-ink-900 dark:text-paper-100">{formatFullDate(item.date)}</td>
                  <td className="py-2 px-3 text-right font-bold text-blue-500">{safeFixed(item.lot)} lot(s)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CustomTooltip({ active, payload, theme, gridColor, textColor }: any) {
  if (!active || !payload || !payload.length) return null

  const item = payload[0].payload as LotStep

  return (
    <div
      style={{
        background: theme === 'dark' ? '#14171D' : '#FFFFFF',
        border: `1px solid ${gridColor}`,
      }}
      className="px-3 py-2 text-[11px] shadow-lg font-mono space-y-1 rounded"
    >
      <p style={{ color: textColor }} className="text-[10px]">{formatFullDate(item.date)}</p>
      <p className="font-bold text-blue-500">
        Volume : <span className="text-ink-900 dark:text-paper-50">{safeFixed(item.lot)} lot(s)</span>
      </p>
    </div>
  )
}
