import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Link, useRouterState, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { useOwnerInterestIndicators } from '@/features/interests/api'
import FeedbackModal from '@/features/feedback/FeedbackModal'
import ThemePopover, { ThemeMenuSection } from '@/components/ThemePopover'
import IconButton from '@/components/ui/IconButton'

function NewInterestNavLink({
  count,
  onNavigate,
  compact = false,
}: {
  count: number
  onNavigate?: () => void
  compact?: boolean
}) {
  if (count <= 0) return null

  const countLabel = count > 9 ? '9+' : String(count)
  const ariaLabel = `${count} ${count === 1 ? 'item' : 'items'} with new interest`

  return (
    <Link
      to="/"
      onClick={onNavigate}
      aria-label={ariaLabel}
      className={`text-caption interactive-focus inline-flex items-center rounded-full border border-link/30 bg-link/10 font-medium text-link transition-colors hover:bg-link/15 ${
        compact ? 'gap-1.5 px-2.5 py-1' : 'text-body gap-2 px-3 py-1.5'
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-link" aria-hidden="true" />
      {compact ? (
        <span>Interest · {countLabel}</span>
      ) : (
        <>
          <span>New interest</span>
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-mint-400 px-1 text-[10px] font-bold leading-none text-black">
            {countLabel}
          </span>
        </>
      )}
    </Link>
  )
}

export default function Navbar() {
  const { user, clearUser } = useAuth()
  const { data: role } = useRole()
  const isAdmin = role === 'admin'
  const router = useRouterState()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentPath = router.location.pathname
  const [menuOpen, setMenuOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const { data: ownerIndicators } = useOwnerInterestIndicators(!!user)
  const unreadInterestItemCount =
    ownerIndicators?.filter((row) => row.has_unread).length ?? 0

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/'
    return currentPath.startsWith(path)
  }

  const closeMenu = () => setMenuOpen(false)

  async function handleSignOut() {
    closeMenu()
    if (import.meta.env.DEV) console.log('[signout] clicked')

    // Attempt graceful server-side sign-out. In supabase-js v2, all scopes make a
    // network request. If the access token is already expired/invalid, Supabase returns
    // 403 and supabase-js surfaces "Auth session missing!". Treat this as non-fatal —
    // the token is already gone from the server's perspective.
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (import.meta.env.DEV) {
        console.log('[signout] result:', error?.message ?? 'ok')
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[signout] unexpected throw:', err)
    }

    // Force-clear the Supabase auth entry from localStorage.
    // supabase-js does NOT clear storage when signOut fails (e.g. "Auth session missing!"),
    // so stale tokens remain and will cause the same 403 on the next sign-in attempt.
    try {
      const projectRef = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
      localStorage.removeItem(`sb-${projectRef}-auth-token`)
      if (import.meta.env.DEV) console.log('[signout] cleared localStorage: sb-' + projectRef + '-auth-token')
    } catch { /* ignore in environments where localStorage is unavailable */ }

    // Synchronously clear React user state so the Navbar and any guards re-render
    // immediately to signed-out state — without waiting for onAuthStateChange, which
    // does not fire when the supabase-js signOut call fails.
    clearUser()
    queryClient.clear()
    navigate({ to: '/' })
  }

  return (
    <>
    <div className="sticky top-0 z-10 border-b border-base-700 bg-base-800/80 backdrop-blur">
      <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between px-6 py-3">
        {/* Brand */}
        <Link
          to="/"
          className={`text-heading interactive-focus flex items-center gap-2 rounded-lg transition-colors ${isActive('/') ? 'text-link' : 'text-link/70 hover:text-link'}`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" className="shrink-0">
            <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M20.5 12a8.5 8.5 0 1 1-6-8.12"/>
              <circle cx="20.5" cy="5.2" r="1.6" fill="currentColor" stroke="none"/>
            </g>
          </svg>
          Circulate
        </Link>

        {/* ── Desktop nav (sm and up) ── */}
        <div className="hidden sm:flex items-center gap-3">
          {user && (
            <NewInterestNavLink count={unreadInterestItemCount} />
          )}
          {user && (
            <Link
              to="/groups"
              className={`text-body interactive-focus rounded-lg transition-colors ${
                isActive('/groups') ? 'font-medium text-link' : 'text-ink-600 hover:text-ink-400'
              }`}
            >
              Groups
            </Link>
          )}
          {user && (
            <Link
              to="/settings"
              className={`text-body interactive-focus rounded-lg transition-colors ${
                isActive('/settings') ? 'font-medium text-link' : 'text-ink-600 hover:text-ink-400'
              }`}
            >
              Settings
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin/users"
              className={`text-body interactive-focus rounded-lg transition-colors ${
                isActive('/admin') ? 'font-medium text-link' : 'text-ink-600 hover:text-ink-400'
              }`}
            >
              Admin
            </Link>
          )}
          {user && (
            <button
              className="text-body interactive-focus rounded-lg transition-colors text-ink-600 hover:text-ink-400"
              onClick={() => setFeedbackOpen(true)}
            >
              Feedback
            </button>
          )}
          <ThemePopover />
          {user ? (
            <>
              <button
                className="text-body interactive-focus rounded-2xl border border-base-600 px-3 py-1.5 text-ink-400 hover:bg-base-700"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className={`btn px-3 py-1.5 transition-colors ${
                  isActive('/signin') ? 'btn-accent ring-2 ring-mint-400/50' : 'btn-accent'
                }`}
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className={`interactive-focus px-3 py-1.5 rounded-2xl border transition-colors ${
                  isActive('/signup')
                    ? 'border-link/50 bg-base-700 text-link'
                    : 'border-base-600 hover:bg-base-700 text-ink-400'
                }`}
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* ── Mobile nav (below sm) ── */}
        <div className="flex sm:hidden items-center gap-2">
          {!user && <ThemePopover />}
          {user ? (
            <>
              <NewInterestNavLink
                count={unreadInterestItemCount}
                compact
                onNavigate={closeMenu}
              />
              {/* Hamburger button */}
              <IconButton
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <span className="flex flex-col gap-[5px] w-5">
                  <span className="block h-0.5 w-full bg-current rounded" />
                  <span className="block h-0.5 w-full bg-current rounded" />
                  <span className="block h-0.5 w-full bg-current rounded" />
                </span>
              </IconButton>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className={`btn px-3 py-1.5 transition-colors ${
                  isActive('/signin') ? 'btn-accent ring-2 ring-mint-400/50' : 'btn-accent'
                }`}
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className={`interactive-focus px-3 py-1.5 rounded-2xl border transition-colors ${
                  isActive('/signup')
                    ? 'border-link/50 bg-base-700 text-link'
                    : 'border-base-600 hover:bg-base-700 text-ink-400'
                }`}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile dropdown menu ── */}
      {menuOpen && user && (
        <div className="sm:hidden border-t border-base-700 bg-base-800 px-4 py-2 flex flex-col gap-1">
          <Link
            to="/groups"
            className={`text-body interactive-focus rounded-lg px-2 py-3 transition-colors ${
              isActive('/groups') ? 'font-medium text-link' : 'text-ink-400 hover:bg-base-700'
            }`}
            onClick={closeMenu}
          >
            Groups
          </Link>
          <Link
            to="/settings"
            className={`text-body interactive-focus rounded-lg px-2 py-3 transition-colors ${
              isActive('/settings') ? 'font-medium text-link' : 'text-ink-400 hover:bg-base-700'
            }`}
            onClick={closeMenu}
          >
            Settings
          </Link>
          {isAdmin && (
            <Link
              to="/admin/users"
              className={`text-body interactive-focus rounded-lg px-2 py-3 transition-colors ${
                isActive('/admin') ? 'font-medium text-link' : 'text-ink-400 hover:bg-base-700'
              }`}
              onClick={closeMenu}
            >
              Admin
            </Link>
          )}
          <button
            className="text-body interactive-focus rounded-lg px-2 py-3 text-left text-ink-400 transition-colors hover:bg-base-700"
            onClick={() => { closeMenu(); setFeedbackOpen(true) }}
          >
            Feedback
          </button>
          <ThemeMenuSection onSelect={closeMenu} />
          <button
            className="text-body interactive-focus rounded-lg px-2 py-3 text-left text-ink-400 transition-colors hover:bg-base-700"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      )}
    </div>

    <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  )
}
