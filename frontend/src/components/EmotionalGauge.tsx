import type { RiskState } from '../lib/api'

const STYLES = {
  'Croissance': { color: 'bg-signal-gain', label: 'Zone verte', detail: 'Compte en progression saine vers l\'objectif.' },
  'Zone orange': { color: 'bg-signal-warn', label: 'Zone orange', detail: 'Approche d\'un niveau dangereux — vigilance sur le risque.' },
  'Zone rouge': { color: 'bg-signal-loss', label: 'Zone rouge', detail: 'Risque important de retour au palier inférieur.' },
  'Zone critique': { color: 'bg-signal-loss', label: 'Zone critique', detail: 'Capital très bas — trading fortement déconseillé.' },
  'Objectif atteint': { color: 'bg-signal-data', label: 'Objectif atteint !', detail: 'Félicitations ! Vous avez atteint votre prochain palier.' },
}

interface Props {
  risk?: RiskState
}

export default function EmotionalGauge({ risk }: Props) {
  const etat = risk?.etat ?? 'Croissance'
  const { color, label, detail } = STYLES[etat as keyof typeof STYLES] ?? STYLES['Croissance']
  const indicatorPos = etat === 'Zone rouge' || etat === 'Zone critique' ? '15%' : etat === 'Zone orange' ? '48%' : '80%'

  return (
    <div className="border border-graphite-700 dark:border-graphite-700 p-6">
      <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
        État du compte
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="font-mono text-[14px] font-semibold text-ink-900 dark:text-paper-50">
          {label}
        </span>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-ink-500 dark:text-ink-300">{detail}</p>

      <div className="relative mt-4 h-1.5 w-full border border-graphite-700">
        <div className="flex h-full w-full">
          <div className="h-full flex-1 bg-signal-loss/30" />
          <div className="h-full flex-1 bg-signal-warn/30" />
          <div className="h-full flex-1 bg-signal-gain/30" />
        </div>
        <div
          className={`absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 ${color}`}
          style={{ left: indicatorPos }}
        />
      </div>
    </div>
  )
}
