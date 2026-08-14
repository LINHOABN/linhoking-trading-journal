import { Sun, Moon, Radio, LogOut } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

interface Props {
  liveConnected: boolean
  onOpenMt5Modal?: () => void
}

export default function Header({ liveConnected, onOpenMt5Modal }: Props) {
  const { theme, toggle } = useTheme()
  const { user, logout } = useAuth()

  return (
    <header className="glass-panel mx-auto my-4 max-w-[1200px] rounded-xl px-6 py-4 flex items-center justify-between shadow-premium transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-signal-data to-indigo-500 font-mono text-[14px] font-bold text-white shadow-glow">
          LK
        </div>
        <div className="leading-tight">
          <div className="font-mono text-[16px] font-bold tracking-wider gradient-text">
            LINHOKING
          </div>
          <div className="text-[10px] uppercase font-bold tracking-widest2 text-ink-500 dark:text-ink-300">
            Trading Journal
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onOpenMt5Modal}
          className="hidden items-center gap-2 border border-graphite-700/50 dark:border-graphite-700/50 hover:border-signal-data/50 rounded-lg px-3 py-1 font-mono text-[11px] text-ink-500 dark:text-ink-300 sm:flex bg-graphite-800/10 backdrop-blur-xs transition-all cursor-pointer group"
          title="Cliquez pour synchroniser votre compte MT5"
        >
          <Radio size={12} className={liveConnected ? 'text-signal-gain animate-pulse' : 'text-ink-500 group-hover:text-signal-data'} />
          <span className="font-semibold group-hover:text-signal-data">{liveConnected ? 'Live MT5' : 'Synchro MT5'}</span>
        </button>

        {user && user.mt5AccountNumber && (
          <button
            onClick={onOpenMt5Modal}
            className="hidden items-center gap-1.5 border border-signal-gain/20 bg-signal-gain/5 hover:bg-signal-gain/10 rounded-lg px-3 py-1 font-mono text-[11px] text-signal-gain sm:flex transition-all cursor-pointer"
            title="Détails du compte MT5"
          >
            <span className="font-bold">{user.mt5Broker || 'MT5'}</span>
            <span className="opacity-75">#{user.mt5AccountNumber}</span>
          </button>
        )}

        {user && (
          <span className="hidden font-mono text-[11px] text-ink-500 dark:text-ink-300 md:inline font-semibold">
            {user.email}
          </span>
        )}

        <div className="flex items-center gap-2 border-l border-graphite-700/50 pl-3">
          <button
            onClick={toggle}
            aria-label="Changer de thème"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-graphite-700/50 text-ink-500 transition-all hover:text-ink-900 dark:border-graphite-700/50 dark:text-ink-300 dark:hover:text-paper-50 dark:hover:bg-graphite-800 hover:bg-paper-100"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            onClick={logout}
            aria-label="Se déconnecter"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-graphite-700/50 text-ink-500 transition-all hover:text-signal-loss hover:border-signal-loss/40 hover:bg-signal-loss/5 dark:border-graphite-700/50 dark:text-ink-300"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  )
}
