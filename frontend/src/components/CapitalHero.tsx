import { useState, FormEvent } from 'react'
import { ArrowUpRight, ArrowDownRight, Wifi, Settings, PlusCircle, Trash2, X, TrendingUp, DollarSign, Wallet } from 'lucide-react'
import type { CapitalPoint } from '../types'
import type { Deposit } from '../lib/api'
import { addDeposit, deleteDeposit } from '../lib/api'
import { safeFixed } from '../lib/formatters'

interface Props {
  curve: CapitalPoint[]
  startingCapital: number
  totalInvested: number
  deposits: Deposit[]
  mt5Balance: number | null
  onEditStartingCapital?: () => void
  onDepositsUpdated?: () => void
}

export default function CapitalHero({
  curve,
  startingCapital,
  totalInvested,
  deposits,
  mt5Balance,
  onEditStartingCapital,
  onDepositsUpdated,
}: Props) {
  const [showDepositsModal, setShowDepositsModal] = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const cachedCapStr = localStorage.getItem('linhoking_cached_capital')
  const cachedCap = cachedCapStr ? parseFloat(cachedCapStr) : null
  const displayBalance = mt5Balance !== null
    ? mt5Balance
    : (cachedCap !== null ? cachedCap : (curve.length > 0 ? curve[curve.length - 1].capital : startingCapital))

  const totalPnL = displayBalance - startingCapital
  const changeFromStart = startingCapital > 0 ? (totalPnL / startingCapital) * 100 : 0
  const isPositive = totalPnL >= 0

  // Profit vs total invested
  const roiVsInvested = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : null

  const handleAddDeposit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(newAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Montant invalide')
      return
    }
    try {
      setSaving(true)
      await addDeposit({ amount, label: newLabel || undefined })
      setNewAmount('')
      setNewLabel('')
      onDepositsUpdated?.()
    } catch {
      alert('Erreur lors de l\'ajout du dépôt')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDeposit = async (id: string) => {
    if (!window.confirm('Supprimer ce versement ?')) return
    await deleteDeposit(id)
    onDepositsUpdated?.()
  }

  return (
    <>
      <div className="glass-panel rounded-2xl p-6 shadow-premium transition-all duration-300 relative overflow-hidden group">
        {/* Glow corner indicator */}
        <div className={`absolute top-0 right-0 h-40 w-40 rounded-full blur-3xl opacity-15 pointer-events-none transition-all duration-500 ${isPositive ? 'bg-signal-gain' : 'bg-signal-loss'}`} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
            <Wallet size={12} className="text-signal-data" />
            <span>Capital Total</span>
          </div>
          {mt5Balance !== null && (
            <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-signal-gain border border-signal-gain/30 bg-signal-gain/5 px-2.5 py-0.5 rounded-full shadow-glow-gain animate-pulse">
              <Wifi size={11} />
              <span>MT5 LIVE Sync</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-baseline gap-2.5">
          <span className="font-mono text-[44px] font-extrabold leading-none text-ink-900 dark:text-paper-50 tracking-tight">
            {safeFixed(displayBalance)}
          </span>
          <span className="font-mono text-[14px] font-bold text-ink-500 dark:text-ink-300">USD</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* P&L Badge */}
          <div
            className={`flex items-center gap-1 font-mono text-[13px] font-bold px-2.5 py-0.5 rounded-lg border transition-all ${isPositive
              ? 'bg-signal-gain/10 text-signal-gain border-signal-gain/20 shadow-glow-gain'
              : 'bg-signal-loss/10 text-signal-loss border-signal-loss/20 shadow-glow-loss'
              }`}
          >
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {isPositive ? '+' : ''}
            {safeFixed(changeFromStart, 1)}% ({totalPnL >= 0 ? '+' : ''}{safeFixed(totalPnL)} $)
          </div>

          {/* Capital invested */}
          <button
            onClick={() => setShowDepositsModal(true)}
            className="flex items-center gap-2 font-mono text-[11px] text-ink-500 dark:text-ink-300 hover:text-signal-data transition-all border border-graphite-700/50 bg-graphite-800/10 hover:bg-graphite-800/30 rounded-lg px-3 py-1 cursor-pointer"
            title="Gérer les versements"
          >
            <TrendingUp size={12} className="text-signal-data" />
            <span>Investi : <strong className="text-signal-data">{totalInvested > 0 ? safeFixed(totalInvested) : safeFixed(startingCapital)} $</strong></span>
            {roiVsInvested !== null && (
              <span className={`text-[10px] font-extrabold px-1.5 py-0.1 rounded ${roiVsInvested >= 0 ? 'bg-signal-gain/15 text-signal-gain' : 'bg-signal-loss/15 text-signal-loss'}`}>
                {roiVsInvested >= 0 ? '+' : ''}{safeFixed(roiVsInvested, 1)}% ROI
              </span>
            )}
          </button>

          {/* Edit starting capital trigger */}
          <div className="flex items-center gap-2 font-mono text-[11px] text-ink-500 dark:text-ink-300 ml-auto">
            <span className="opacity-80">Ressource départ : <strong>{safeFixed(startingCapital, 0)} $</strong></span>
            {onEditStartingCapital && (
              <button
                onClick={onEditStartingCapital}
                className="flex items-center gap-1 text-[11px] text-signal-data hover:underline font-bold"
              >
                <Settings size={12} />
                <span>Ajuster</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Deposits Modal */}
      {showDepositsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-graphite-700/60 bg-paper-50 dark:bg-graphite-900 rounded-2xl p-6 shadow-premium space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-graphite-700/40 pb-3">
              <div>
                <h3 className="font-sans text-[15px] font-bold text-ink-900 dark:text-paper-50 flex items-center gap-2">
                  <DollarSign size={16} className="text-signal-gain" />
                  Gestion de l'Investissement
                </h3>
                <p className="font-mono text-[10px] text-ink-500 mt-1">
                  Somme rechargée : <strong className="text-signal-data">{safeFixed(totalInvested > 0 ? totalInvested : startingCapital)} $</strong>
                  {' '}({deposits.length} versement{deposits.length > 1 ? 's' : ''})
                </p>
              </div>
              <button onClick={() => setShowDepositsModal(false)} className="text-ink-500 hover:text-ink-900 dark:hover:text-paper-50">
                <X size={16} />
              </button>
            </div>

            {/* Existing deposits */}
            <div className="max-h-[220px] overflow-y-auto divide-y divide-graphite-700/40 space-y-0 pr-1">
              {deposits.length === 0 ? (
                <div className="font-mono text-[11px] text-ink-500 py-6 text-center">
                  Aucun versement spécifique enregistré. Vos calculs utilisent votre capital de départ.
                </div>
              ) : (
                deposits.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-3 px-1 hover:bg-graphite-800/10 rounded transition-colors group">
                    <div>
                      <div className="font-mono text-[13px] font-bold text-signal-gain">+{safeFixed(d.amount)} $</div>
                      <div className="font-mono text-[10px] text-ink-500 mt-0.5">
                        {d.deposit_date} {d.label ? `· ${d.label}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDeposit(d.id)}
                      className="text-ink-500 hover:text-signal-loss transition-colors p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add new deposit form */}
            <form onSubmit={handleAddDeposit} className="border-t border-graphite-700/50 pt-4 space-y-3">
              <p className="font-sans text-[11px] font-bold text-ink-500">Enregistrer un Rechargement</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-ink-500 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="Montant (ex: 500)"
                    className="w-full bg-paper-100 dark:bg-graphite-800 border border-graphite-700/50 rounded-lg pl-7 pr-2.5 py-2 font-mono text-[12px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data transition-colors"
                  />
                </div>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Note (ex: Transfert)"
                  className="flex-1 bg-paper-100 dark:bg-graphite-800 border border-graphite-700/50 rounded-lg px-3 py-2 font-mono text-[12px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-signal-data to-indigo-500 text-white rounded-lg font-mono text-[12px] font-bold py-2 hover:opacity-90 shadow-glow transition-all"
              >
                <PlusCircle size={13} />
                {saving ? 'Enregistrement…' : 'Valider le dépôt'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
