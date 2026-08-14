import { useState } from 'react'
import { X, Copy, Check, Key, RefreshCw, HelpCircle, Terminal } from 'lucide-react'
import { rotateMt5Key } from '../lib/api'
import type { Me } from '../context/AuthContext'

interface Props {
    user: Me | null
    isOpen: boolean
    onClose: () => void
    onKeyRotated?: () => void
}

export default function MT5Modal({ user, isOpen, onClose, onKeyRotated }: Props) {
    const [copiedKey, setCopiedKey] = useState(false)
    const [copiedUrl, setCopiedUrl] = useState(false)
    const [copiedEa, setCopiedEa] = useState(false)
    const [rotating, setRotating] = useState(false)
    const [activeTab, setActiveTab] = useState<'key' | 'guide'>('key')

    if (!isOpen || !user) return null

    const serverUrl = window.location.origin

    const handleCopyKey = () => {
        navigator.clipboard.writeText(user.mt5ApiKey)
        setCopiedKey(true)
        setTimeout(() => setCopiedKey(false), 2000)
    }

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(serverUrl)
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
    }

    const handleRotateKey = async () => {
        if (!window.confirm('Générer une nouvelle clé API MT5 ? L\'ancienne clé cessera de fonctionner.')) return
        try {
            setRotating(true)
            await rotateMt5Key()
            onKeyRotated?.()
        } catch {
            alert('Erreur lors de la réinitialisation de la clé')
        } finally {
            setRotating(false)
        }
    }

    const eaScriptSnippet = `//+------------------------------------------------------------------+
//| MetaTrader 5 Expert Advisor Bridge - LINHOKING Trading Journal   |
//+------------------------------------------------------------------+
input string ApiBaseUrl = "${serverUrl}";
input string ApiKey     = "${user.mt5ApiKey}";
`

    const handleCopyEaSnippet = () => {
        navigator.clipboard.writeText(eaScriptSnippet)
        setCopiedEa(true)
        setTimeout(() => setCopiedEa(false), 2000)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl border border-graphite-700/60 bg-paper-50 dark:bg-graphite-900 rounded-2xl p-6 shadow-premium space-y-5 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-graphite-700/40 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal-data/10 text-signal-data border border-signal-data/30">
                            <Terminal size={16} />
                        </div>
                        <div>
                            <h3 className="font-sans text-[15px] font-bold text-ink-900 dark:text-paper-50">
                                Synchronisation MetaTrader 5 (MT5)
                            </h3>
                            <p className="font-mono text-[10px] text-ink-500">
                                Connectez votre compte MT5 pour suivre solde et trades en direct
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-ink-500 hover:text-ink-900 dark:hover:text-paper-50 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-graphite-700/40 font-mono text-[11px] gap-4">
                    <button
                        onClick={() => setActiveTab('key')}
                        className={`pb-2 font-bold transition-all border-b-2 ${activeTab === 'key'
                            ? 'border-signal-data text-signal-data'
                            : 'border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-paper-50'
                            }`}
                    >
                        🔑 Ma Clé API & Serveur
                    </button>
                    <button
                        onClick={() => setActiveTab('guide')}
                        className={`pb-2 font-bold transition-all border-b-2 ${activeTab === 'guide'
                            ? 'border-signal-data text-signal-data'
                            : 'border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-paper-50'
                            }`}
                    >
                        📖 Guide de Connexion MT5
                    </button>
                </div>

                {activeTab === 'key' ? (
                    <div className="space-y-4 font-mono text-[12px]">
                        {/* Account Status Card */}
                        {user.mt5AccountNumber ? (
                            <div className="border border-signal-gain/30 bg-signal-gain/5 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-signal-gain">
                                        Compte MT5 Connecté & En Ligne
                                    </div>
                                    <div className="text-[13px] font-bold text-ink-900 dark:text-paper-50 mt-0.5">
                                        {user.mt5Broker || 'Broker MT5'} · #{user.mt5AccountNumber}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-ink-500">Solde Synchronisé</div>
                                    <div className="text-[14px] font-extrabold text-signal-gain">
                                        {user.mt5Balance !== null ? `${user.mt5Balance.toFixed(2)} USD` : '—'}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="border border-graphite-700/50 bg-graphite-800/20 rounded-xl p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-ink-500">
                                    <HelpCircle size={15} className="text-signal-warn" />
                                    <span>Aucun compte MT5 actif connecté pour le moment</span>
                                </div>
                            </div>
                        )}

                        {/* Server URL */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                                1. URL du Serveur (ApiBaseUrl)
                            </label>
                            <div className="flex items-center gap-2 border border-graphite-700/50 bg-paper-100 dark:bg-graphite-800 rounded-lg px-3 py-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={serverUrl}
                                    className="w-full bg-transparent text-ink-900 dark:text-paper-50 focus:outline-none"
                                />
                                <button
                                    onClick={handleCopyUrl}
                                    className="flex items-center gap-1 text-[11px] font-bold text-signal-data hover:underline shrink-0"
                                >
                                    {copiedUrl ? <Check size={13} className="text-signal-gain" /> : <Copy size={13} />}
                                    <span>{copiedUrl ? 'Copié !' : 'Copier'}</span>
                                </button>
                            </div>
                        </div>

                        {/* API Key */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-ink-500 flex items-center justify-between">
                                <span>2. Votre Clé API unique (ApiKey)</span>
                                <button
                                    onClick={handleRotateKey}
                                    disabled={rotating}
                                    className="text-[10px] text-ink-500 hover:text-signal-loss flex items-center gap-1 normal-case underline"
                                >
                                    <RefreshCw size={10} className={rotating ? 'animate-spin' : ''} />
                                    <span>Régénérer</span>
                                </button>
                            </label>
                            <div className="flex items-center gap-2 border border-graphite-700/50 bg-paper-100 dark:bg-graphite-800 rounded-lg px-3 py-2">
                                <Key size={14} className="text-signal-data shrink-0" />
                                <input
                                    type="text"
                                    readOnly
                                    value={user.mt5ApiKey}
                                    className="w-full bg-transparent text-ink-900 dark:text-paper-50 focus:outline-none font-mono text-[11px]"
                                />
                                <button
                                    onClick={handleCopyKey}
                                    className="flex items-center gap-1 text-[11px] font-bold text-signal-data hover:underline shrink-0"
                                >
                                    {copiedKey ? <Check size={13} className="text-signal-gain" /> : <Copy size={13} />}
                                    <span>{copiedKey ? 'Copié !' : 'Copier'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3 font-mono text-[11px] max-h-[350px] overflow-y-auto pr-1">
                        <div className="border border-signal-data/30 bg-signal-data/5 rounded-xl p-3 space-y-2">
                            <div className="font-bold text-signal-data uppercase text-[10px] tracking-wider">
                                Étape 1 : Autoriser WebRequest dans MetaTrader 5
                            </div>
                            <ol className="list-decimal pl-4 space-y-1 text-ink-500 dark:text-ink-300">
                                <li>Ouvrez votre terminal **MetaTrader 5**.</li>
                                <li>Allez dans le menu **Outils &gt; Options** (ou `Ctrl + O`).</li>
                                <li>Cliquez sur l'onglet **Expert Advisors**.</li>
                                <li>Cochez la case **"Autoriser WebRequest pour les URL listées"**.</li>
                                <li>Ajoutez cette URL exacte dans la liste :</li>
                            </ol>
                            <div className="bg-graphite-900 text-signal-data px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center justify-between border border-graphite-700">
                                <span>{serverUrl}</span>
                                <button onClick={handleCopyUrl} className="text-[10px] hover:underline text-white">Copier</button>
                            </div>
                        </div>

                        <div className="border border-graphite-700/50 bg-graphite-800/20 rounded-xl p-3 space-y-2">
                            <div className="font-bold text-paper-50 uppercase text-[10px] tracking-wider">
                                Étape 2 : Ajouter l'Expert Advisor (LinhokingBridge.mq5)
                            </div>
                            <p className="text-ink-500 dark:text-ink-300">
                                Copiez les variables de configuration ci-dessous et collez-les dans les paramètres de votre robot **LinhokingBridge** sur MT5 :
                            </p>
                            <div className="relative bg-graphite-900 p-2.5 rounded font-mono text-[10px] text-paper-200 border border-graphite-700 overflow-x-auto">
                                <pre>{eaScriptSnippet}</pre>
                                <button
                                    onClick={handleCopyEaSnippet}
                                    className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold text-signal-data hover:underline bg-graphite-800 px-2 py-0.5 rounded"
                                >
                                    {copiedEa ? <Check size={11} className="text-signal-gain" /> : <Copy size={11} />}
                                    <span>{copiedEa ? 'Copié' : 'Copier'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="border border-signal-gain/30 bg-signal-gain/5 rounded-xl p-3 space-y-1">
                            <div className="font-bold text-signal-gain uppercase text-[10px] tracking-wider">
                                Étape 3 : Glisser l'EA sur votre graphique XAU/USD
                            </div>
                            <p className="text-ink-500 dark:text-ink-300">
                                Glissez l'EA sur votre graphique. Votre solde (Balance), vos informations de compte et chaque trade clôturé seront **immédiatement synchronisés en direct** avec votre journal LINHOKING !
                            </p>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-end pt-2 border-t border-graphite-700/40">
                    <button
                        onClick={onClose}
                        className="bg-signal-data px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white rounded-lg hover:bg-signal-data/90 shadow-glow transition-all"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    )
}
