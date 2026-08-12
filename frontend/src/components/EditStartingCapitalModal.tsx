import { useState, FormEvent } from 'react'
import { X, DollarSign } from 'lucide-react'
import { updateTier } from '../lib/api'

interface Props {
    initialCapital: number
    isOpen: boolean
    onClose: () => void
    onSaved: () => void
}

export default function EditStartingCapitalModal({
    initialCapital,
    isOpen,
    onClose,
    onSaved,
}: Props) {
    const [val, setVal] = useState(initialCapital.toString())
    const [saving, setSaving] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        const num = parseFloat(val)
        if (isNaN(num) || num <= 0) {
            alert('Veuillez saisir un montant de capital valide')
            return
        }

        try {
            setSaving(true)
            await updateTier({ startingCapital: num })
            onSaved()
            onClose()
        } catch (err) {
            alert('Erreur lors de la mise à jour du capital de départ')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md border border-graphite-700 bg-paper-50 dark:bg-graphite-900 p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-graphite-700 pb-4">
                    <div className="font-mono text-[13px] font-semibold uppercase tracking-wide text-ink-900 dark:text-paper-50 flex items-center gap-2">
                        <DollarSign size={16} className="text-signal-gain" />
                        Modifier le Capital de Départ
                    </div>
                    <button
                        onClick={onClose}
                        className="text-ink-500 hover:text-ink-900 dark:hover:text-paper-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    <div>
                        <label className="block font-mono text-[11px] uppercase tracking-wider text-ink-500 dark:text-ink-300">
                            Capital Initial (USD)
                        </label>
                        <div className="mt-1.5 flex items-center border border-graphite-700 bg-white dark:bg-graphite-800 px-3 py-2">
                            <span className="font-mono text-ink-500">$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="1"
                                value={val}
                                onChange={(e) => setVal(e.target.value)}
                                className="w-full bg-transparent font-mono text-[14px] text-ink-900 dark:text-paper-50 focus:outline-none ml-2"
                                placeholder="200.00"
                                required
                            />
                        </div>
                        <p className="mt-1.5 text-[11px] text-ink-500 dark:text-ink-400">
                            Définissez le solde initial de votre compte de trading pour calculer la vraie performance (en %).
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="border border-graphite-700 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-500 hover:text-ink-900 dark:hover:text-paper-50"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-signal-gain px-5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-graphite-900 hover:bg-signal-gain/90"
                        >
                            {saving ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
