import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { getApiUrl } from '../lib/api'

export default function LoginScreen() {
  const { login, register, error } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
    } catch {
      /* error already surfaced via context */
    } finally {
      setSubmitting(false)
    }
  }

  function handleDemoFill() {
    setMode('login')
    setEmail('bob@linhoking.com')
    setPassword('password123')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-50 px-6 dark:bg-graphite-900">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center border border-ink-900 font-mono text-[14px] font-semibold text-ink-900 dark:border-paper-50 dark:text-paper-50">
            LK
          </div>
          <div className="leading-tight">
            <div className="font-mono text-[16px] font-semibold tracking-wide text-ink-900 dark:text-paper-50">
              LINHOKING
            </div>
            <div className="text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
              Trading Journal
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="border border-graphite-700 p-6">
          <div className="flex gap-4 border-b border-graphite-700 pb-4 text-[11px] uppercase tracking-widest2">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={mode === 'login' ? 'font-bold text-signal-data dark:text-signal-data' : 'text-ink-500 dark:text-ink-300'}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={mode === 'register' ? 'font-bold text-signal-data dark:text-signal-data' : 'text-ink-500 dark:text-ink-300'}
            >
              Créer un compte
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: trader@linhoking.com"
                className="w-full border border-graphite-700 bg-transparent px-3 py-2 font-mono text-[13px] text-ink-900 outline-none focus:border-signal-data dark:text-paper-50"
              />
            </Field>
            <Field label="Mot de passe">
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-graphite-700 bg-transparent px-3 py-2 font-mono text-[13px] text-ink-900 outline-none focus:border-signal-data dark:text-paper-50"
              />
            </Field>
          </div>

          {error && <div className="mt-4 text-[12px] text-signal-loss">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full border border-ink-900 bg-ink-900 py-2.5 font-mono text-[12px] uppercase tracking-widest2 text-paper-50 transition-opacity hover:opacity-90 disabled:opacity-50 dark:border-paper-50 dark:bg-paper-50 dark:text-graphite-900 font-bold"
          >
            {submitting ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>

          <button
            type="button"
            onClick={handleDemoFill}
            className="mt-3 w-full border border-signal-data/40 bg-signal-data/10 py-1.5 font-mono text-[11px] uppercase tracking-wider text-signal-data hover:bg-signal-data/20 transition-colors rounded"
          >
            ⚡ Utiliser le Compte Démo
          </button>
        </form>

        <p className="mt-4 text-center font-mono text-[10px] text-ink-500 dark:text-ink-300">
          Connecté à {getApiUrl() || window.location.origin}
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-widest2 text-ink-500 dark:text-ink-300">
        {label}
      </span>
      {children}
    </label>
  )
}
