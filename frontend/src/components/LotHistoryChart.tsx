import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
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

  const displayData = data && data.length > 0 ? data : [{ date: "Aujourd'hui", lot: 0.01 }]
  const chartPoints = [...displayData]
  if (chartPoints.length === 1) {
    chartPoints.unshift({
      date: 'Départ',
      lot: chartPoints[0].lot,
    })
  }

  const lots = chartPoints.map((p) => p.lot)
  const minLot = lots.length > 0 ? Math.min(...lots) : 0.01
  const maxLot = lots.length > 0 ? Math.max(...lots) : 0.1
  const yDomain: [number, number] = [
    Math.max(0, Math.floor((minLot - 0.01) * 100) / 100),
    Math.ceil((maxLot + 0.02) * 100) / 100,
  ]

  const lastLot = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].lot : 0.01

  return (
    <div className="border border-graphite-700 dark:border-graphite-700 p-6 bg-paper-50 dark:bg-graphite-900">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300 font-mono">
            Courbe d'évolution des lots
          </div>
          <div className="mt-0.5 font-mono text-[18px] font-semibold text-signal-data">
            {lastLot.toFixed(2)} lot(s)
          </div>
        </div>
        <div className="font-mono text-[10px] text-ink-500 dark:text-ink-300">
          Volume par trade (Lots)
        </div>
      </div>

      <div className="mt-5 h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartPoints} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="lotFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
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
              tickFormatter={(val) => `${val.toFixed(2)} lot`}
            />
            <Tooltip content={<CustomTooltip theme={theme} gridColor={gridColor} textColor={textColor} />} />
            <Area
              type="stepAfter"
              dataKey="lot"
              stroke="#3B82F6"
              strokeWidth={2.5}
              fill="url(#lotFill)"
              dot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }}
              activeDot={{ r: 7, fill: '#3B82F6' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
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
      <p className="font-bold text-signal-data">
        Volume : <span className="text-ink-900 dark:text-paper-50">{item.lot.toFixed(2)} lot(s)</span>
      </p>
    </div>
  )
}
