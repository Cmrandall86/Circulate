import { useEffect, useId, useRef, useState } from 'react'
import { useTheme, type ThemeMode } from '@/hooks/useTheme'
import IconButton from '@/components/ui/IconButton'

const OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
]

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.5 2.5a8.5 8.5 0 1 0 8.5 8.5 6.5 6.5 0 0 1-8.5-8.5Z"
      />
    </svg>
  )
}

function ThemeModeIcon({ mode }: { mode: ThemeMode }) {
  return mode === 'light' ? <SunIcon /> : <MoonIcon />
}

type ThemeSelectorProps = {
  layout?: 'popover' | 'menu'
  onSelect?: () => void
}

export function ThemeSelector({ layout = 'popover', onSelect }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme()

  function choose(mode: ThemeMode) {
    setTheme(mode)
    onSelect?.()
  }

  const isMenu = layout === 'menu'

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={isMenu ? 'flex flex-col gap-1' : 'flex flex-col gap-0.5'}
    >
      {OPTIONS.map(({ mode, label }) => {
        const selected = theme === mode
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => choose(mode)}
            className={
              isMenu
                ? `flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors interactive-focus ${
                    selected
                      ? 'bg-base-700 text-link font-medium'
                      : 'text-ink-400 hover:bg-base-700'
                  }`
                : `text-body interactive-focus flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'bg-base-700 text-link font-medium'
                      : 'text-ink-400 hover:bg-base-700'
                  }`
            }
          >
            <ThemeModeIcon mode={mode} />
            <span className="flex-1">{label}</span>
            {selected && (
              <span className="text-link" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

type ThemePopoverProps = {
  onSelect?: () => void
}

export default function ThemePopover({ onSelect }: ThemePopoverProps) {
  const [open, setOpen] = useState(false)
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleSelect() {
    close()
    onSelect?.()
  }

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      close()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        ref={triggerRef}
        aria-label="Theme"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <ThemeModeIcon mode={theme} />
      </IconButton>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-20 mt-1 min-w-[10.5rem] rounded-xl border border-base-600 bg-base-800 p-1 shadow-lg"
        >
          <ThemeSelector onSelect={handleSelect} />
        </div>
      )}
    </div>
  )
}

export function ThemeMenuSection({ onSelect }: { onSelect?: () => void }) {
  return (
    <div className="border-t border-base-700 px-2 py-2">
      <p className="text-caption mb-1 px-2 font-medium uppercase tracking-wide">Theme</p>
      <ThemeSelector layout="menu" onSelect={onSelect} />
    </div>
  )
}
