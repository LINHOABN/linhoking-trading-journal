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
