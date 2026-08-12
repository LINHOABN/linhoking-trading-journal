import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import type { LotStep } from '../types'
import { formatShortDate, formatFullDate } from '../lib/formatters'
import { useTheme } from '../context/ThemeContext'

interface Props {
  data: LotStep[]
}

export default function LotHistoryChart({ data }: Props) {
  const { theme } = useTheme()

  const gridColor = theme === 'dark' ? '#262B33' : '#DDE1E6'
  const textColor = theme === 'dark' ? '#8B92A0' : '#5B6470'
  const barColor = theme === 'dark' ? '#3B82F6' : '#2563EB' // Signal blue

  const displayData = data && data.length > 0 ? data : [{ date: 'Aujourd\'hui', lot: 0.01 }]

  return (
    <div className="border border-graphite-700 dark:border-graphite-700 p-6 bg-paper-50 dark:bg-graphite-900">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300 font-mono">
          Historique des lots
        </div>
        <div className="font-mono text-[10px] text-ink-500 dark:text-ink-300">
          Volume par trade (Lots)
        </div>
      </div>

      <div className="mt-5 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fontSize: 10, fill: textColor, fontFamily: 'monospace' }}
              stroke={gridColor}
            />
            <YAxis
              tick={{ fontSize: 10, fill: textColor, fontFamily: 'monospace' }}
              stroke={gridColor}
              domain={[0, 'auto']}
              allowDecimals={true}
              tickFormatter={(val) => `${val} lot`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
            />
            <Bar dataKey="lot" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {displayData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={barColor} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const item = payload[0].payload as LotStep

  return (
    <div className="border border-graphite-700 bg-graphite-900 px-3 py-2 text-[11px] shadow-lg font-mono text-paper-50 space-y-1">
      <p className="text-[10px] text-ink-300">{formatFullDate(item.date)}</p>
      <p className="font-bold text-signal-data">
        Volume : <span className="text-white">{item.lot.toFixed(2)} lot(s)</span>
      </p>
    </div>
  )
}
