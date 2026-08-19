import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { CapitalPoint, Trade } from '../types'
import { useTheme } from '../context/ThemeContext'
import { formatShortDate, formatFullDate, safeFixed, calculateTradeRiskUSD, getTradeOutcomeBadge } from '../lib/formatters'

interface Props {
  data?: CapitalPoint[]
  trades?: Trade[]
}

function getRiskForCapital(cap: number): number {
  if (cap == null || isNaN(cap) || cap < 100) return 5
  if (cap < 200) return 10
  if (cap < 350) return 15
  if (cap < 500) return 20
  if (cap < 650) return 25
  if (cap < 800) return 30
  if (cap < 950) return 35
  if (cap < 1100) return 40
  const extra = Math.floor((cap - 1100) / 150) + 1
  return 40 + extra * 5
}

export default function RiskEvolutionChart({ data, trades }: Props) {
  const { theme } = useTheme()
  const gridColor = theme === 'dark' ? '#262B33' : '#DDE1E6'
  const textColor = theme === 'dark' ? '#8B92A0' : '#5B6470'

  let chartData: Array<{ date: string; capital: number; risque: number; label?: string }> = []

  if (trades && trades.length > 0) {
    const sorted = [...trades].sort((a, b) => (a.date + (a.openTime || '')).localeCompare(b.date + (b.openTime || '')))
    chartData = sorted.map((t, i) => {
      const risk = calculateTradeRiskUSD(t)
      const badge = getTradeOutcomeBadge(t)
      const outcomeText = badge.label ? ` (${badge.label})` : (t.pnl >= 0 ? ' (Gagné)' : ' (Perdu)')
      return {
        date: t.date ? `${formatShortDate(t.date)} ${t.openTime?.slice(0, 5) || ''}`.trim() : `Trade #${i + 1}`,
        capital: t.pnl,
        risque: risk,
        label: `${t.symbol} ${t.direction} ${t.volume} lot${outcomeText}`,
      }
    })
  } else if (data && data.length > 0) {
    chartData = data.map((d) => ({
      date: d.date,
      capital: d.capital,
      risque: getRiskForCapital(d.capital),
    }))
  }

  if (chartData.length === 1) {
    chartData.unshift({
      date: 'Départ',
      capital: chartData[0].capital,
      risque: chartData[0].risque,
    })
  }

  return (
    <div className="border border-graphite-700 dark:border-graphite-700 p-6">
      <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
        Évolution du risque
      </div>
      <div className="mt-4 h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              interval="preserveStartEnd"
              minTickGap={35}
              tick={{ fontSize: 11, fill: textColor, fontFamily: 'IBM Plex Mono' }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
              dy={6}
            />
            {/* Left YAxis for Capital */}
            <YAxis
              yAxisId="capital"
              orientation="left"
              tick={{ fontSize: 10, fill: textColor, fontFamily: 'IBM Plex Mono' }}
              axisLine={false}
              tickLine={false}
              width={50}
              domain={['auto', 'auto']}
              tickFormatter={(val: number) => `${Math.round(val)}$`}
            />
            {/* Right YAxis for Risk per trade */}
            <YAxis
              yAxisId="risk"
              orientation="right"
              tick={{ fontSize: 10, fill: '#D89614', fontFamily: 'IBM Plex Mono' }}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={['auto', 'auto']}
              tickFormatter={(val: number) => `${Math.round(val)}$`}
            />
            <Tooltip
              contentStyle={{
                background: theme === 'dark' ? '#14171D' : '#FFFFFF',
                border: `1px solid ${gridColor}`,
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'IBM Plex Mono',
              }}
              labelFormatter={(label) => formatFullDate(String(label))}
              formatter={(value: number, name: string) => [
                `${safeFixed(value)} $`,
                name === 'capital' ? 'Capital' : 'Risque max / trade',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: textColor }}
            />
            <Line
              yAxisId="capital"
              type="monotone"
              dataKey="capital"
              name="Capital"
              stroke="#5B8DEF"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
            <Line
              yAxisId="risk"
              type="monotone"
              dataKey="risque"
              name="Risque / trade"
              stroke="#D89614"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
