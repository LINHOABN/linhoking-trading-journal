import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { CapitalPoint } from '../types'
import { useTheme } from '../context/ThemeContext'
import { formatShortDate, formatFullDate, safeFixed } from '../lib/formatters'

interface Props {
  data: CapitalPoint[]
}

type Period = 'all' | 'this_month' | 'last_month' | 'last_30'

export default function CapitalCurveChart({ data }: Props) {
  const { theme } = useTheme()
  const [period, setPeriod] = useState<Period>('all')

  const gridColor = theme === 'dark' ? '#262B33' : '#DDE1E6'
  const textColor = theme === 'dark' ? '#8B92A0' : '#5B6470'

  // Filter data based on selected period
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return []
    if (period === 'all') return data

    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth() // 0-indexed

    if (period === 'this_month') {
      return data.filter((d) => {
        const [y, m] = d.date.split('-').map(Number)
        return y === thisYear && m - 1 === thisMonth
      })
    }

    if (period === 'last_month') {
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
      return data.filter((d) => {
        const [y, m] = d.date.split('-').map(Number)
        return y === lastMonthYear && m - 1 === lastMonth
      })
    }

    if (period === 'last_30') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return data.filter((d) => new Date(d.date) >= thirtyDaysAgo)
    }

    return data
  }, [data, period])

  const chartPoints = [...filteredData]
  if (chartPoints.length === 1) {
    chartPoints.unshift({
      date: 'Départ',
      capital: chartPoints[0].capital,
    })
  }

  // Calculate dynamic domain with padding
  const capitals = chartPoints.map((p) => p.capital)
  const minCap = capitals.length > 0 ? Math.min(...capitals) : 0
  const maxCap = capitals.length > 0 ? Math.max(...capitals) : 200
  const padding = Math.max((maxCap - minCap) * 0.15, maxCap * 0.02, 10)
  const yDomain: [number, number] = [
    Math.max(0, Math.floor(minCap - padding)),
    Math.ceil(maxCap + padding),
  ]

  const lastCapital = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].capital : 0

  return (
    <div className="border border-graphite-700 dark:border-graphite-700 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
            Courbe de capital
          </div>
          <div className="mt-0.5 font-mono text-[20px] font-semibold text-ink-900 dark:text-paper-50">
            {safeFixed(lastCapital)} $
          </div>
        </div>

        {/* Timeframe Selector Tabs */}
        <div className="flex items-center gap-1 bg-paper-100 dark:bg-graphite-800 p-1 border border-graphite-700">
          {[
            { key: 'all', label: 'Tout' },
            { key: 'this_month', label: 'Ce mois' },
            { key: 'last_month', label: 'Mois dernier' },
            { key: 'last_30', label: '30 jours' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriod(item.key as Period)}
              className={`px-3 py-1 font-mono text-[11px] transition-colors ${period === item.key
                ? 'bg-signal-data text-white font-semibold'
                : 'text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-paper-50'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartPoints} margin={{ top: 12, right: 16, left: 10, bottom: 8 }}>
            <defs>
              <linearGradient id="capitalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
            <YAxis
              tick={{ fontSize: 11, fill: textColor, fontFamily: 'IBM Plex Mono' }}
              axisLine={false}
              tickLine={false}
              width={65}
              domain={yDomain}
              tickFormatter={(val: number) => `${Math.round(val)} $`}
            />
            <Tooltip
              contentStyle={{
                background: theme === 'dark' ? '#14171D' : '#FFFFFF',
                border: `1px solid ${gridColor}`,
                borderRadius: 4,
                fontSize: 13,
                fontFamily: 'IBM Plex Mono',
                padding: '8px 12px',
              }}
              labelStyle={{ color: textColor, fontWeight: 'bold' }}
              labelFormatter={(label) => formatFullDate(String(label))}
              formatter={(value: number) => [`${safeFixed(value)} $`, 'Capital']}
            />
            <Area
              type="monotone"
              dataKey="capital"
              stroke="#5B8DEF"
              strokeWidth={2.5}
              fill="url(#capitalFill)"
              dot={{ r: 4, fill: '#5B8DEF', strokeWidth: 0 }}
              activeDot={{ r: 7, fill: '#5B8DEF' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
