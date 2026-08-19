/**
 * Formats an ISO date string "2026-06-16" to short French date format e.g. "16 juin"
 */
export function formatShortDate(dateStr: string): string {
    if (!dateStr || dateStr === 'Départ' || dateStr === "Aujourd'hui") return dateStr
    try {
        const parts = dateStr.split('-')
        if (parts.length < 3) return dateStr
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10)
        const day = parseInt(parts[2], 10)
        if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr

        const months = [
            'janv.', 'févr.', 'mars', 'avril', 'mai', 'juin',
            'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'
        ]
        return `${day} ${months[month - 1] || ''}`.trim()
    } catch {
        return dateStr
    }
}

/**
 * Formats an ISO date string "2026-06-16" to full readable French format e.g. "16 juin 2026"
 */
export function formatFullDate(dateStr: string): string {
    if (!dateStr || dateStr === 'Départ' || dateStr === "Aujourd'hui") return dateStr
    try {
        const parts = dateStr.split('-')
        if (parts.length < 3) return dateStr
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10)
        const day = parseInt(parts[2], 10)
        if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr

        const months = [
            'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
            'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
        ]
        return `${day} ${months[month - 1] || ''} ${year}`.trim()
    } catch {
        return dateStr
    }
}

/**
 * Safely converts any value (number, string, undefined, null, NaN) to a fixed decimal string representation
 * preventing any "Cannot read properties of undefined (reading 'toFixed')" runtime crashes.
 */
export function safeFixed(val: any, digits: number = 2): string {
    const num = typeof val === 'number' ? val : parseFloat(String(val ?? '0'))
    if (isNaN(num) || num === null || num === undefined) {
        return (0).toFixed(digits)
    }
    return num.toFixed(digits)
}

export function getTradeOutcomeBadge(trade: any): { hit: 'TP' | 'SL' | null; label: string } {
    if (!trade || !trade.exitPrice) return { hit: null, label: '' }
    const ep = Number(trade.entryPrice)
    const xp = Number(trade.exitPrice)
    const sl = Number(trade.stopLoss)
    const tp = Number(takeProfit(trade))

    if (!xp || isNaN(xp)) return { hit: null, label: '' }

    if (trade.direction === 'BUY') {
        if (tp > 0 && xp >= tp - 0.05) {
            return { hit: 'TP', label: '🎯 TP Touché' }
        }
        if (sl > 0 && xp <= sl + 0.05) {
            return { hit: 'SL', label: '🛑 SL Touché' }
        }
    }

    if (trade.direction === 'SELL') {
        if (tp > 0 && xp <= tp + 0.05) {
            return { hit: 'TP', label: '🎯 TP Touché' }
        }
        if (sl > 0 && xp >= sl - 0.05) {
            return { hit: 'SL', label: '🛑 SL Touché' }
        }
    }

    return { hit: null, label: '' }
}

function takeProfit(trade: any): number {
    return Number(trade.takeProfit || trade.take_profit || 0)
}

export function calculateTradeRiskUSD(trade: any): number {
    if (!trade) return 5.0
    const ep = Number(trade.entryPrice || trade.entry_price || 0)
    const sl = Number(trade.stopLoss || trade.stop_loss || 0)
    const xp = Number(trade.exitPrice || trade.exit_price || 0)
    const vol = Number(trade.volume || 0.01)
    const pnl = Number(trade.pnl || 0)

    if (sl > 0 && ep > 0) {
        const dist = Math.abs(ep - sl)
        const factor = ep > 100 ? 100 : 100000
        const risk = dist * vol * factor
        if (risk > 0.01 && risk < 10000) return +risk.toFixed(2)
    }

    if (pnl < 0) return +Math.abs(pnl).toFixed(2)
    if (ep > 0 && xp > 0) {
        const dist = Math.abs(ep - xp)
        const factor = ep > 100 ? 100 : 100000
        const calc = dist * vol * factor
        if (calc > 0.01 && calc < 10000) return +calc.toFixed(2)
    }

    return 5.0
}
