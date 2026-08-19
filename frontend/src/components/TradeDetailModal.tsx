import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import {
    X,
    Upload,
    Image as ImageIcon,
    Check,
    Tag,
    Clock,
    Plus,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Maximize2,
    Mic,
    Square,
    Play,
    Pause,
    Radio,
    Volume2,
} from 'lucide-react'
import type { Trade } from '../types'
import { updateTrade, uploadTradeScreenshot, deleteTradeScreenshot, uploadTradeVoice, deleteTradeVoice } from '../lib/api'
import { safeFixed } from '../lib/formatters'

interface Props {
    trade: Trade
    onClose: () => void
    onTradeUpdated: (trade: Trade) => void
}

const DEFAULT_CONFLUENCES = [
    'Breakout de structure (MSB / BOS)',
    'Fair Value Gap (FVG / Imbalance)',
    'Sweep de liquidité (High / Low)',
    'Retest Fibonacci (61.8% / 78.6%)',
    'Divergence Indicateur (RSI / MACD)',
    'Alignement Multi-Timeframe (H4 / H1)',
    'Fort Volume à l’entrée',
    'Niveau psychologique / Chiffre rond',
]

const SESSION_COLORS: Record<string, string> = {
    Asie: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Londres: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'Londres / NY': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'New York': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
}

const CONFLUENCE_STORAGE_KEY = 'linhoking_custom_confluences'

export default function TradeDetailModal({ trade, onClose, onTradeUpdated }: Props) {
    const isWin = trade.pnl >= 0
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Photos state
    const screenshots = trade.screenshots || (trade.screenshotUrl ? [trade.screenshotUrl] : [])
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)

    // Fullscreen Lightbox State
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

    // Interactive trade state
    const [note, setNote] = useState(trade.note || '')
    const [strategy, setStrategy] = useState(trade.strategy || '')
    const [mistake, setMistake] = useState(trade.mistake || '')
    const [emotion, setEmotion] = useState(trade.emotion || '')
    const [confluences, setConfluences] = useState<string[]>(trade.confluences || [])

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [voiceUploading, setVoiceUploading] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const timerIntervalRef = useRef<any>(null)
    const audioInputRef = useRef<HTMLInputElement>(null)
    const audioPlayerRef = useRef<HTMLAudioElement>(null)

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            let options: MediaRecorderOptions = { audioBitsPerSecond: 32000 }
            if (typeof MediaRecorder.isTypeSupported === 'function') {
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 }
                } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                    options = { mimeType: 'audio/webm', audioBitsPerSecond: 32000 }
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    options = { mimeType: 'audio/mp4', audioBitsPerSecond: 32000 }
                } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                    options = { mimeType: 'audio/aac', audioBitsPerSecond: 32000 }
                }
            }
            const mediaRecorder = new MediaRecorder(stream, options)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = async () => {
                const mimeType = options.mimeType || 'audio/webm'
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
                if (audioBlob.size > 0) {
                    await handleUploadVoiceBlob(audioBlob)
                }
                stream.getTracks().forEach((track) => track.stop())
            }

            mediaRecorder.start(200)
            setIsRecording(true)
            setRecordingTime(0)

            timerIntervalRef.current = setInterval(() => {
                setRecordingTime((prev) => {
                    if (prev >= 180) { // Auto-stop after 3 minutes
                        stopRecording()
                        return 180
                    }
                    return prev + 1
                })
            }, 1000)
        } catch {
            alert("Impossible d'accéder au microphone. Vérifiez les autorisations de votre navigateur.")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            try {
                if (mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.requestData()
                }
            } catch {
                /* ignore */
            }
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current)
            }
        }
    }

    const handleUploadVoiceBlob = async (blob: Blob) => {
        if (!blob || blob.size === 0) {
            alert("Enregistrement trop court ou audio vide. Veuillez parler au moins 1 seconde.")
            return
        }
        if (blob.size > 2.5 * 1024 * 1024) {
            alert("Note vocale trop longue (max 2.5 Mo). Veuillez réaliser un enregistrement plus court.")
            return
        }
        try {
            setVoiceUploading(true)
            const updated = await uploadTradeVoice(trade.id, blob)
            onTradeUpdated(updated)
        } catch (e: any) {
            alert(`Erreur lors de l'enregistrement de la note vocale: ${e?.message || e}`)
        } finally {
            setVoiceUploading(false)
        }
    }

    const handleAudioFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            setVoiceUploading(true)
            const updated = await uploadTradeVoice(trade.id, file)
            onTradeUpdated(updated)
        } catch (e: any) {
            alert(`Erreur lors de l'envoi du fichier audio: ${e?.message || e}`)
        } finally {
            setVoiceUploading(false)
        }
    }

    const handleDeleteVoice = async () => {
        if (!confirm("Voulez-vous supprimer cette note vocale ?")) return
        try {
            setVoiceUploading(true)
            const updated = await deleteTradeVoice(trade.id)
            onTradeUpdated(updated)
        } catch (e: any) {
            alert(`Erreur lors de la suppression de la note vocale: ${e?.message || e}`)
        } finally {
            setVoiceUploading(false)
        }
    }

    const formatSeconds = (sec: number) => {
        const m = Math.floor(sec / 60)
        const s = sec % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    // Options list state (defaults + custom added by user)
    const [confluenceOptions, setConfluenceOptions] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(CONFLUENCE_STORAGE_KEY)
            if (saved) {
                return JSON.parse(saved)
            }
        } catch {
            // fallback
        }
        return DEFAULT_CONFLUENCES
    })

    const [newConfluenceText, setNewConfluenceText] = useState('')
    const [isAddingOption, setIsAddingOption] = useState(false)

    // Persist confluenceOptions to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(CONFLUENCE_STORAGE_KEY, JSON.stringify(confluenceOptions))
        } catch {
            // ignore
        }
    }, [confluenceOptions])

    const handleToggleConfluence = (item: string) => {
        setConfluences((prev) =>
            prev.includes(item) ? prev.filter((c) => c !== item) : [...prev, item]
        )
    }

    const handleAddConfluenceOption = () => {
        const trimmed = newConfluenceText.trim()
        if (!trimmed) return
        if (!confluenceOptions.includes(trimmed)) {
            const updatedOptions = [...confluenceOptions, trimmed]
            setConfluenceOptions(updatedOptions)
            if (!confluences.includes(trimmed)) {
                setConfluences((prev) => [...prev, trimmed])
            }
        }
        setNewConfluenceText('')
        setIsAddingOption(false)
    }

    const handleRemoveConfluenceOption = (item: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setConfluenceOptions((prev) => prev.filter((c) => c !== item))
        setConfluences((prev) => prev.filter((c) => c !== item))
    }

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            setUploading(true)
            const updated = await uploadTradeScreenshot(trade.id, file)
            onTradeUpdated(updated)
            setSelectedPhotoIndex((updated.screenshots?.length || 1) - 1)
        } catch {
            alert("Erreur lors de l'envoi de l'image")
        } finally {
            setUploading(false)
        }
    }

    const handleDeletePhoto = async (photoUrl: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Voulez-vous supprimer cette capture d’écran ?')) return
        try {
            const updated = await deleteTradeScreenshot(trade.id, photoUrl)
            onTradeUpdated(updated)
            setSelectedPhotoIndex((prev) => Math.max(0, prev - 1))
        } catch {
            alert('Erreur lors de la suppression de l’image')
        }
    }

    const handleSaveAll = async () => {
        try {
            setSaving(true)
            const updated = await updateTrade(trade.id, {
                note: note.trim() || undefined,
                strategy: strategy.trim() || undefined,
                mistake: mistake.trim() || undefined,
                emotion: emotion.trim() || undefined,
                confluences,
            })
            onTradeUpdated(updated)
            onClose()
        } catch {
            alert('Erreur lors de la sauvegarde du trade')
        } finally {
            setSaving(false)
        }
    }

    const sessionStyle =
        SESSION_COLORS[trade.session || ''] || 'bg-graphite-700/50 text-paper-50 border-graphite-600'

    const currentPhoto = screenshots[selectedPhotoIndex] || screenshots[0]

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="relative flex max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-lg border border-graphite-700 bg-paper-50 dark:bg-graphite-900 shadow-2xl">
                {/* Header Bar */}
                <div className="flex items-center justify-between border-b border-graphite-700 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-[18px] font-bold text-ink-900 dark:text-paper-50">
                            {trade.symbol}
                        </span>
                        <span
                            className={`px-2 py-0.5 font-mono text-[11px] font-bold ${trade.direction === 'BUY'
                                ? 'bg-signal-gain/15 text-signal-gain'
                                : 'bg-signal-loss/15 text-signal-loss'
                                }`}
                        >
                            {trade.direction} · {safeFixed(trade.volume)} lot
                        </span>
                        {trade.session && (
                            <span className={`px-2 py-0.5 border font-mono text-[10px] uppercase font-semibold ${sessionStyle}`}>
                                Session {trade.session}
                            </span>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center text-ink-500 hover:text-ink-900 dark:hover:text-paper-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 2-Column Main Content */}
                <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2">
                    {/* LEFT COLUMN: Multi-Photo Gallery & Viewer */}
                    <div className="flex flex-col border-b border-graphite-700 p-6 lg:border-b-0 lg:border-r space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] uppercase tracking-wider text-signal-data font-semibold flex items-center gap-1.5">
                                <ImageIcon size={14} /> Captures d’écran & Graphiques ({screenshots.length})
                            </span>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-1.5 bg-signal-data hover:bg-signal-data/90 text-white font-mono text-[10px] px-3 py-1 font-semibold transition-colors rounded-sm"
                            >
                                <Plus size={12} /> {uploading ? 'Envoi…' : 'Ajouter une photo'}
                            </button>
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />

                        {/* Featured Image Viewer */}
                        {screenshots.length > 0 ? (
                            <div className="relative group flex-1 flex flex-col items-center justify-center min-h-[300px] max-h-[450px] bg-black/40 rounded border border-graphite-700 p-2 overflow-hidden">
                                <img
                                    src={
                                        currentPhoto.startsWith('http')
                                            ? currentPhoto
                                            : `http://localhost:8000${currentPhoto}`
                                    }
                                    alt={`Capture trade ${selectedPhotoIndex + 1}`}
                                    onClick={() => setLightboxIndex(selectedPhotoIndex)}
                                    className="max-h-[420px] w-full object-contain cursor-zoom-in rounded transition-transform group-hover:scale-[1.01]"
                                />

                                {/* Click to Zoom Overlay button */}
                                <button
                                    onClick={() => setLightboxIndex(selectedPhotoIndex)}
                                    className="absolute top-3 right-3 bg-black/70 text-white p-2 rounded-full opacity-80 hover:opacity-100 hover:bg-black transition-opacity backdrop-blur-sm"
                                    title="Cliquer pour aggrandir"
                                >
                                    <Maximize2 size={16} />
                                </button>

                                {/* Delete Photo Button */}
                                <button
                                    onClick={(e) => handleDeletePhoto(currentPhoto, e)}
                                    className="absolute bottom-3 right-3 bg-signal-loss/80 hover:bg-signal-loss text-white p-1.5 rounded opacity-80 hover:opacity-100 transition-opacity"
                                    title="Supprimer cette photo"
                                >
                                    <Trash2 size={14} />
                                </button>

                                {/* Navigation arrows if multiple photos */}
                                {screenshots.length > 1 && (
                                    <>
                                        <button
                                            onClick={() =>
                                                setSelectedPhotoIndex((prev) =>
                                                    prev > 0 ? prev - 1 : screenshots.length - 1
                                                )
                                            }
                                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black transition-colors"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <button
                                            onClick={() =>
                                                setSelectedPhotoIndex((prev) =>
                                                    prev < screenshots.length - 1 ? prev + 1 : 0
                                                )
                                            }
                                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black transition-colors"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded border-2 border-dashed border-graphite-700 bg-graphite-800/30 p-8 text-center">
                                <ImageIcon size={40} className="text-ink-500 mb-3" />
                                <p className="font-mono text-[12px] text-ink-500 dark:text-ink-300">
                                    Aucune capture d’écran pour ce trade
                                </p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="mt-4 flex items-center gap-2 bg-signal-data px-4 py-2 font-mono text-[11px] font-semibold text-white transition-colors hover:bg-signal-data/90"
                                >
                                    <Upload size={14} /> {uploading ? 'Téléchargement…' : 'Ajouter une photo'}
                                </button>
                            </div>
                        )}

                        {/* Thumbnail Navigation Carousel */}
                        {screenshots.length > 1 && (
                            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-2">
                                {screenshots.map((url, idx) => (
                                    <div
                                        key={url}
                                        onClick={() => setSelectedPhotoIndex(idx)}
                                        className={`relative h-16 w-20 shrink-0 cursor-pointer rounded border-2 overflow-hidden transition-all ${idx === selectedPhotoIndex
                                            ? 'border-signal-data scale-105 shadow-md'
                                            : 'border-graphite-700 opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <img
                                            src={url.startsWith('http') ? url : `http://localhost:8000${url}`}
                                            alt={`Miniature ${idx + 1}`}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Details, Confluences & Comments */}
                    <div className="p-6 space-y-5 overflow-y-auto">
                        {/* Key PnL & Stats Row */}
                        <div className="grid grid-cols-2 gap-3 border border-graphite-700 p-4 bg-paper-100 dark:bg-graphite-800/60">
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-ink-300 font-mono">
                                    Résultat (P&L)
                                </div>
                                <div
                                    className={`mt-1 font-mono text-[24px] font-bold ${isWin ? 'text-signal-gain' : 'text-signal-loss'
                                        }`}
                                >
                                    {isWin ? '+' : ''}
                                    {safeFixed(trade.pnl)} $
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-ink-300 font-mono">
                                    Date & Horaire
                                </div>
                                <div className="mt-1 font-mono text-[12px] text-ink-900 dark:text-paper-50 flex items-center gap-1.5">
                                    <Clock size={13} className="text-ink-500" />
                                    {trade.date} ({trade.openTime} – {trade.closeTime})
                                </div>
                            </div>
                        </div>

                        {/* Price Levels Grid */}
                        <div className="grid grid-cols-4 gap-2 border border-graphite-700 p-3 text-center font-mono text-[11px] bg-paper-50 dark:bg-graphite-900">
                            <div>
                                <div className="text-[9px] uppercase text-ink-500">Entrée</div>
                                <div className="font-semibold text-ink-900 dark:text-paper-50">{trade.entryPrice}</div>
                            </div>
                            <div>
                                <div className="text-[9px] uppercase text-ink-500">Sortie</div>
                                <div className="font-semibold text-ink-900 dark:text-paper-50">{trade.exitPrice}</div>
                            </div>
                            <div>
                                <div className="text-[9px] uppercase text-signal-loss">Stop Loss</div>
                                <div className="font-semibold text-signal-loss">{trade.stopLoss}</div>
                            </div>
                            <div>
                                <div className="text-[9px] uppercase text-signal-gain">Take Profit</div>
                                <div className="font-semibold text-signal-gain">{trade.takeProfit}</div>
                            </div>
                        </div>

                        {/* CONFLUENCES CHECKLIST */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-signal-data font-semibold">
                                    <Tag size={13} /> Confluences & Critères d’Entrée ({confluences.length})
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsAddingOption(!isAddingOption)}
                                    className="flex items-center gap-1 font-mono text-[10px] text-signal-data hover:underline"
                                >
                                    <Plus size={12} /> {isAddingOption ? 'Annuler' : 'Ajouter un critère'}
                                </button>
                            </div>

                            {/* Add Custom Confluence Input */}
                            {isAddingOption && (
                                <div className="flex items-center gap-2 border border-signal-data/40 p-2 bg-paper-100 dark:bg-graphite-800">
                                    <input
                                        type="text"
                                        value={newConfluenceText}
                                        onChange={(e) => setNewConfluenceText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddConfluenceOption()}
                                        placeholder="Nouveau critère (ex: Retest MM200)..."
                                        className="flex-1 bg-paper-50 dark:bg-graphite-900 border border-graphite-700 px-2 py-1 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddConfluenceOption}
                                        className="flex items-center gap-1 bg-signal-data hover:bg-signal-data/90 text-white font-mono text-[11px] px-3 py-1 font-semibold"
                                    >
                                        Ajouter
                                    </button>
                                </div>
                            )}

                            {/* Confluences list */}
                            <div className="grid grid-cols-1 gap-1.5 border border-graphite-700 p-3 bg-paper-50 dark:bg-graphite-900 max-h-[220px] overflow-y-auto">
                                {confluenceOptions.map((item) => {
                                    const active = confluences.includes(item)
                                    return (
                                        <div
                                            key={item}
                                            onClick={() => handleToggleConfluence(item)}
                                            className={`group flex items-center justify-between px-2.5 py-1.5 font-mono text-[11px] transition-colors rounded-sm cursor-pointer ${active
                                                ? 'bg-signal-gain/15 text-signal-gain font-semibold border border-signal-gain/30'
                                                : 'text-ink-500 hover:text-ink-900 dark:hover:text-paper-50 hover:bg-paper-100 dark:hover:bg-graphite-800'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={`h-3.5 w-3.5 rounded flex items-center justify-center border ${active ? 'border-signal-gain bg-signal-gain text-black' : 'border-graphite-600'
                                                        }`}
                                                >
                                                    {active && <Check size={10} strokeWidth={3} />}
                                                </div>
                                                <span>{item}</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => handleRemoveConfluenceOption(item, e)}
                                                title="Supprimer ce critère de la liste"
                                                className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-signal-loss transition-opacity p-0.5"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* NOTES & COMMENTS FORM */}
                        <div className="space-y-3 pt-2">
                            <div>
                                <label className="block font-mono text-[10px] uppercase text-ink-500 dark:text-ink-300 mb-1">
                                    Commentaire / Note d’analyse :
                                </label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Notes sur la psychologie, la réaction du marché, la gestion de position..."
                                    rows={3}
                                    className="w-full bg-paper-50 dark:bg-graphite-900 border border-graphite-700 p-2.5 font-sans text-[12px] text-ink-900 dark:text-paper-50 focus:outline-none focus:border-signal-data"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block font-mono text-[9px] uppercase text-ink-500 mb-1">
                                        Stratégie
                                    </label>
                                    <input
                                        type="text"
                                        value={strategy}
                                        onChange={(e) => setStrategy(e.target.value)}
                                        placeholder="Breakout, Scalp..."
                                        className="w-full bg-paper-50 dark:bg-graphite-900 border border-graphite-700 px-2 py-1 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-mono text-[9px] uppercase text-ink-500 mb-1">
                                        Erreur
                                    </label>
                                    <input
                                        type="text"
                                        value={mistake}
                                        onChange={(e) => setMistake(e.target.value)}
                                        placeholder="FOMO, SL bougé..."
                                        className="w-full bg-paper-50 dark:bg-graphite-900 border border-graphite-700 px-2 py-1 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-mono text-[9px] uppercase text-ink-500 mb-1">
                                        Émotion
                                    </label>
                                    <input
                                        type="text"
                                        value={emotion}
                                        onChange={(e) => setEmotion(e.target.value)}
                                        placeholder="Confiant, Anxieux..."
                                        className="w-full bg-paper-50 dark:bg-graphite-900 border border-graphite-700 px-2 py-1 font-mono text-[11px] text-ink-900 dark:text-paper-50 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* VOICE NOTE SECTION */}
                            <div className="border border-graphite-700 p-3 bg-paper-100 dark:bg-graphite-800/80 rounded space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-signal-data font-semibold flex items-center gap-1.5">
                                        <Mic size={13} /> Note Vocale / Journal Audio
                                    </span>
                                    <input
                                        type="file"
                                        ref={audioInputRef}
                                        onChange={handleAudioFileChange}
                                        accept="audio/*"
                                        className="hidden"
                                    />
                                </div>

                                {trade.voiceUrl ? (
                                    <div className="flex items-center gap-3 border border-graphite-700 p-2.5 bg-paper-50 dark:bg-graphite-900 rounded">
                                        <audio
                                            ref={audioPlayerRef}
                                            src={trade.voiceUrl}
                                            controls
                                            className="w-full h-8 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleDeleteVoice}
                                            disabled={voiceUploading}
                                            className="p-1.5 text-signal-loss hover:bg-signal-loss/10 rounded transition-colors"
                                            title="Supprimer la note vocale"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-2 border border-dashed border-graphite-700 p-3 bg-paper-50/50 dark:bg-graphite-900/50 rounded">
                                        {isRecording ? (
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-2">
                                                    <span className="relative flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-loss opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-signal-loss"></span>
                                                    </span>
                                                    <span className="font-mono text-[12px] font-bold text-signal-loss animate-pulse">
                                                        Enregistrement... {formatSeconds(recordingTime)}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={stopRecording}
                                                    className="flex items-center gap-1.5 bg-signal-loss text-white font-mono text-[11px] px-3 py-1 font-semibold rounded hover:bg-signal-loss/90 transition-colors"
                                                >
                                                    <Square size={12} fill="white" /> Terminer & Sauvegarder
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-[11px] font-mono text-ink-500 dark:text-ink-300">
                                                    {voiceUploading ? 'Téléchargement audio…' : 'Aucune note vocale enregistrée'}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={startRecording}
                                                        disabled={voiceUploading}
                                                        className="flex items-center gap-1.5 bg-signal-data text-white font-mono text-[11px] px-3 py-1 font-semibold rounded hover:bg-signal-data/90 transition-colors"
                                                    >
                                                        <Mic size={13} /> Record Micro
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => audioInputRef.current?.click()}
                                                        disabled={voiceUploading}
                                                        className="flex items-center gap-1.5 border border-graphite-600 text-ink-900 dark:text-paper-50 font-mono text-[11px] px-2.5 py-1 rounded hover:bg-paper-100 dark:hover:bg-graphite-800 transition-colors"
                                                    >
                                                        <Upload size={12} /> Fichier audio
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Bar */}
                <div className="flex items-center justify-between border-t border-graphite-700 px-6 py-3 bg-paper-100 dark:bg-graphite-800">
                    <div className="font-mono text-[11px] text-ink-500">
                        ID: <span className="text-ink-900 dark:text-paper-50 font-semibold">{trade.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 font-mono text-[11px] text-ink-500 hover:text-ink-900 dark:hover:text-paper-50"
                        >
                            Fermer
                        </button>
                        <button
                            onClick={handleSaveAll}
                            disabled={saving}
                            className="flex items-center gap-1.5 bg-signal-data hover:bg-signal-data/90 text-white font-mono text-[11px] px-5 py-1.5 font-semibold transition-colors shadow"
                        >
                            <Check size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                    </div>
                </div>
            </div>

            {/* FULLSCREEN LIGHTBOX ZOOM MODAL */}
            {lightboxIndex !== null && screenshots[lightboxIndex] && (
                <div
                    onClick={() => setLightboxIndex(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative flex max-h-[95vh] max-w-[95vw] flex-col items-center justify-center"
                    >
                        {/* Close Lightbox */}
                        <button
                            onClick={() => setLightboxIndex(null)}
                            className="absolute -top-10 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-graphite-700 text-white hover:bg-graphite-600 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <img
                            src={
                                screenshots[lightboxIndex].startsWith('http')
                                    ? screenshots[lightboxIndex]
                                    : `http://localhost:8000${screenshots[lightboxIndex]}`
                            }
                            alt="Capture zoomée"
                            className="max-h-[88vh] max-w-[92vw] object-contain rounded border border-graphite-700 shadow-2xl"
                        />

                        {/* Lightbox Navigation */}
                        {screenshots.length > 1 && (
                            <>
                                <button
                                    onClick={() =>
                                        setLightboxIndex((prev) =>
                                            prev !== null && prev > 0 ? prev - 1 : screenshots.length - 1
                                        )
                                    }
                                    className="absolute -left-12 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-graphite-800/80 text-white hover:bg-graphite-700 transition-colors"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={() =>
                                        setLightboxIndex((prev) =>
                                            prev !== null && prev < screenshots.length - 1 ? prev + 1 : 0
                                        )
                                    }
                                    className="absolute -right-12 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-graphite-800/80 text-white hover:bg-graphite-700 transition-colors"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </>
                        )}

                        <div className="mt-2 font-mono text-[11px] text-paper-300">
                            Photo {lightboxIndex + 1} sur {screenshots.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )

    return createPortal(modalContent, document.body)
}
