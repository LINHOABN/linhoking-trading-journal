import type { StatsSummary } from '../lib/api'

interface Props {
  stats: StatsSummary
}

export default function StatsPanel({ stats }: Props) {
  return (
    <div className="border border-graphite-700 dark:border-graphite-700 p-6">
      <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
        Statistiques
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Stat label="Taux de réussite" value={`${stats.winRate.toFixed(0)}%`} />
        <Stat label="Trades totaux" value={`${stats.totalTrades}`} />
        <Stat label="Gain moyen" value={`+${stats.avgWin.toFixed(2)} $`} tone="gain" />
        <Stat label="Perte moyenne" value={`${stats.avgLoss.toFixed(2)} $`} tone="loss" />
        <Stat
          label="Meilleur jour"
          value={stats.bestDay ? `${stats.bestDay.slice(5)} · +${stats.bestDayPnl?.toFixed(0)}$` : '—'}
        />
        <Stat
          label="Pire jour"
          value={stats.worstDay ? `${stats.worstDay.slice(5)} · ${stats.worstDayPnl?.toFixed(0)}$` : '—'}
        />
      </div>

      <div className="mt-5 border-t border-graphite-700 pt-4">
        <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
          Comportement
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-500 dark:text-ink-300">
          Meilleure plage horaire :{' '}
          <span className="text-ink-900 dark:text-paper-50">{stats.bestHour ?? '—'}</span>.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-[14px] font-semibold ${
          tone === 'gain'
            ? 'text-signal-gain'
            : tone === 'loss'
            ? 'text-signal-loss'
            : 'text-ink-900 dark:text-paper-50'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
