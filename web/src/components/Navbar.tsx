import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Link, useRouterState } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import FeedbackModal from '@/features/feedback/FeedbackModal'

export default function Navbar() {
  const { user } = useAuth()
  const { data: role } = useRole()
  const isAdmin = role === 'admin'
  const router = useRouterState()
  const currentPath = router.location.pathname
  const [menuOpen, setMenuOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/'
    return currentPath.startsWith(path)
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
    <div className="sticky top-0 z-10 border-b border-base-700 bg-base-800/80 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between p-3">
        {/* Brand */}
        <Link
          to="/"
          className={`flex items-center gap-2 font-semibold transition-colors ${isActive('/') ? 'text-mint-400' : 'text-mint-400/70 hover:text-mint-400'}`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
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
            <Link
              to="/groups"
              className={`transition-colors ${
                isActive('/groups') ? 'text-mint-400 font-medium' : 'text-ink-600 hover:text-ink-400'
              }`}
            >
              Groups
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin/users"
              className={`transition-colors ${
                isActive('/admin') ? 'text-mint-400 font-medium' : 'text-ink-600 hover:text-ink-400'
              }`}
            >
              Admin
            </Link>
          )}
          {user && (
            <button
              className="transition-colors text-ink-600 hover:text-ink-400"
              onClick={() => setFeedbackOpen(true)}
            >
              Feedback
            </button>
          )}
          {user ? (
            <>
              <Link
                to="/new"
                className={`btn px-3 py-1.5 transition-colors ${
                  isActive('/new') ? 'btn-accent ring-2 ring-mint-400/50' : 'btn-accent'
                }`}
              >
                New Item
              </Link>
              <button
                className="px-3 py-1.5 rounded-2xl border border-base-600 hover:bg-base-700 text-ink-400"
                onClick={() => supabase.auth.signOut()}
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
                className={`px-3 py-1.5 rounded-2xl border transition-colors ${
                  isActive('/signup')
                    ? 'border-mint-400/50 bg-base-700 text-mint-400'
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
          {user ? (
            <>
              <Link
                to="/new"
                className={`btn px-3 py-1.5 transition-colors ${
                  isActive('/new') ? 'btn-accent ring-2 ring-mint-400/50' : 'btn-accent'
                }`}
                onClick={closeMenu}
              >
                New Item
              </Link>
              {/* Hamburger button */}
              <button
                aria-label="Open menu"
                aria-expanded={menuOpen}
                className="p-2 rounded-lg text-ink-400 hover:text-ink-400 hover:bg-base-700 transition-colors"
                onClick={() => setMenuOpen((o) => !o)}
              >
                <span className="flex flex-col gap-[5px] w-5">
                  <span className="block h-0.5 w-full bg-current rounded" />
                  <span className="block h-0.5 w-full bg-current rounded" />
                  <span className="block h-0.5 w-full bg-current rounded" />
                </span>
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
                className={`px-3 py-1.5 rounded-2xl border transition-colors ${
                  isActive('/signup')
                    ? 'border-mint-400/50 bg-base-700 text-mint-400'
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
            className={`py-3 px-2 rounded-lg transition-colors ${
              isActive('/groups') ? 'text-mint-400 font-medium' : 'text-ink-400 hover:bg-base-700'
            }`}
            onClick={closeMenu}
          >
            Groups
          </Link>
          {isAdmin && (
            <Link
              to="/admin/users"
              className={`py-3 px-2 rounded-lg transition-colors ${
                isActive('/admin') ? 'text-mint-400 font-medium' : 'text-ink-400 hover:bg-base-700'
              }`}
              onClick={closeMenu}
            >
              Admin
            </Link>
          )}
          <button
            className="py-3 px-2 rounded-lg text-left text-ink-400 hover:bg-base-700 transition-colors"
            onClick={() => { closeMenu(); setFeedbackOpen(true) }}
          >
            Feedback
          </button>
          <button
            className="py-3 px-2 rounded-lg text-left text-ink-400 hover:bg-base-700 transition-colors"
            onClick={() => { closeMenu(); supabase.auth.signOut() }}
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
