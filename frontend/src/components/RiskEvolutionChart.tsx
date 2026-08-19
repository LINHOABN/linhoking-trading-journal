import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { CapitalPoint } from '../types'
import { useTheme } from '../context/ThemeContext'
import { formatShortDate, formatFullDate, safeFixed } from '../lib/formatters'

interface Props {
  data: CapitalPoint[]
}

export default function RiskEvolutionChart({ data }: Props) {
  const { theme } = useTheme()
  const gridColor = theme === 'dark' ? '#262B33' : '#DDE1E6'
  const textColor = theme === 'dark' ? '#8B92A0' : '#5B6470'

  const chartData = data.map((d) => ({
    date: d.date,
    capital: d.capital,
    risque: +(d.capital != null && !isNaN(d.capital) ? (d.capital * 0.04) : 0).toFixed(2),
  }))

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
