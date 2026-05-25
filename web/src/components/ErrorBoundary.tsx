import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-base-900 flex items-center justify-center px-4">
          <div className="card p-8 max-w-md w-full space-y-4 border border-base-700">
            <h1 className="text-heading">Something went wrong</h1>
            <p className="text-caption">
              An unexpected error occurred. You can try refreshing the page or return to the home
              screen.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                className="btn btn-accent px-4 py-2 font-medium text-black"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
              <a
                href="/"
                className="btn px-4 py-2 font-medium bg-base-700 text-ink-400 hover:bg-base-600"
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
