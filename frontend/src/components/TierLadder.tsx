import { TrendingUp, AlertTriangle, Target, Layers, DollarSign, BarChart2, ShieldAlert } from 'lucide-react'
import type { RiskState } from '../lib/api'
import { safeFixed } from '../lib/formatters'

interface Props {
  risk: RiskState
}

const STATE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  'Croissance': { bg: 'bg-signal-gain/10', text: 'text-signal-gain', label: '📈 Croissance' },
  'Zone orange': { bg: 'bg-signal-warn/10', text: 'text-signal-warn', label: '⚠️ Zone orange' },
  'Zone rouge': { bg: 'bg-signal-loss/10', text: 'text-signal-loss', label: '🔴 Zone rouge' },
  'Zone critique': { bg: 'bg-signal-loss/20', text: 'text-signal-loss', label: '🚨 Zone critique' },
  'Objectif atteint': { bg: 'bg-signal-data/10', text: 'text-signal-data', label: '🎯 Objectif atteint !' },
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  highlight?: 'gain' | 'loss' | 'warn' | 'data'
}) {
  const colors: Record<string, string> = {
    gain: 'text-signal-gain',
    loss: 'text-signal-loss',
    warn: 'text-signal-warn',
    data: 'text-signal-data',
  }
  return (
    <div className="border border-graphite-700 dark:border-graphite-700 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`font-mono text-[22px] font-semibold leading-none ${highlight ? colors[highlight] : 'text-ink-900 dark:text-paper-50'}`}>
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[11px] text-ink-500 dark:text-ink-400 leading-snug">{sub}</div>
      )}
    </div>
  )
}

export default function TierLadder({ risk }: Props) {
  const state = STATE_STYLES[risk.etat] ?? STATE_STYLES['Croissance']

  return (
    <div className="border border-graphite-700 dark:border-graphite-700 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
          Moteur de Paliers
        </div>
        <div className={`px-2.5 py-1 text-[10px] font-mono font-semibold rounded-full ${state.bg} ${state.text}`}>
          {state.label}
        </div>
      </div>

      {/* Progress bar — progression vers l'objectif */}
      <div>
        <div className="flex justify-between font-mono text-[11px] text-ink-500 dark:text-ink-400 mb-1.5">
          <span>Niveau {risk.niveau} $</span>
          <span>{risk.progression} %</span>
          <span>Objectif {risk.objectif} $</span>
        </div>
        <div className="h-2 bg-graphite-700/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-signal-gain rounded-full transition-all duration-700"
            style={{ width: `${Math.min(risk.progression, 100)}%` }}
          />
        </div>
        <div className="mt-1 font-mono text-[11px] text-ink-500 dark:text-ink-400 text-right">
          Encore <span className="text-ink-900 dark:text-paper-50 font-semibold">{safeFixed(risk.reste)} $</span> avant le prochain niveau
        </div>
      </div>

      {/* Stat cards: 2-column grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Layers size={11} />}
          label="Lot actif"
          value={safeFixed(risk.lot)}
          sub={`Niveau ${risk.niveau} $`}
        />
        <StatCard
          icon={<DollarSign size={11} />}
          label="Risque / trade"
          value={`${safeFixed(risk.risque, 0)} $`}
          sub={`${risk.niveau} × 5%`}
          highlight="warn"
        />
        <StatCard
          icon={<Target size={11} />}
          label="Objectif"
          value={`${risk.objectif} $`}
          sub={`+${safeFixed(risk.reste)} $ restants`}
          highlight="data"
        />
        <StatCard
          icon={<BarChart2 size={11} />}
          label="Progression"
          value={`${safeFixed(risk.progression, 1)} %`}
          sub={`vers ${risk.objectif} $`}
          highlight={risk.progression >= 85 ? 'gain' : undefined}
        />
        <StatCard
          icon={<ShieldAlert size={11} />}
          label="Pertes restantes"
          value={`${risk.pertes_restantes}`}
          sub="avant retour palier inférieur"
          highlight={risk.pertes_restantes <= 2 ? 'loss' : risk.pertes_restantes <= 5 ? 'warn' : 'gain'}
        />
        <StatCard
          icon={<TrendingUp size={11} />}
          label="Capital actuel"
          value={`${safeFixed(risk.capital)} $`}
          sub={`Palier ${risk.niveau} $`}
          highlight={risk.capital >= risk.objectif ? 'gain' : undefined}
        />
      </div>

      {/* Warning banner if in red zone */}
      {(risk.etat === 'Zone rouge' || risk.etat === 'Zone critique') && (
        <div className="flex items-start gap-2 border border-signal-loss/40 bg-signal-loss/5 px-3 py-2 text-[11px] text-signal-loss font-mono">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Attention — seulement <strong>{risk.pertes_restantes}</strong> perte
            {risk.pertes_restantes <= 1 ? '' : 's'} avant retour au palier inférieur. Gérez votre risque.
          </span>
        </div>
      )}
    </div>
  )
}
