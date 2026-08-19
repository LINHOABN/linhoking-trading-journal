import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('React ErrorBoundary captured an error:', error, errorInfo)
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper-50 px-6 dark:bg-graphite-900 font-mono text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-signal-loss/40 bg-signal-loss/10 text-signal-loss font-bold text-lg">
                        !
                    </div>
                    <h2 className="text-[16px] font-bold text-ink-900 dark:text-paper-50">
                        Une erreur d'affichage s'est produite
                    </h2>
                    <p className="max-w-md text-[12px] text-ink-500 dark:text-ink-300">
                        {this.state.error?.message || 'Erreur inconnue de rendu'}
                    </p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false, error: null })
                            window.location.reload()
                        }}
                        className="mt-2 border border-graphite-700 bg-graphite-800 px-5 py-2 text-[11px] uppercase tracking-widest2 text-paper-50 hover:bg-graphite-700 transition-colors rounded"
                    >
                        Rafraîchir la page
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
