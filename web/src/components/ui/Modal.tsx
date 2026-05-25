import { useEffect, useId, useRef, type ReactNode } from 'react'
import IconButton from './IconButton'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  )
}

function trapTabKey(event: KeyboardEvent, container: HTMLElement) {
  if (event.key !== 'Tab') return

  const focusable = getFocusableElements(container)
  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement

  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault()
      last.focus()
    }
    return
  }

  if (active === last) {
    event.preventDefault()
    first.focus()
  }
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) {
      const previous = previousFocusRef.current
      if (previous && document.contains(previous)) {
        previous.focus()
      }
      previousFocusRef.current = null
      return
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null

    const frame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (dialogRef.current) {
        trapTabKey(event, dialogRef.current)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay/50" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        className="card relative z-10 max-w-md w-full p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          {title ? (
            <h2 id={titleId} className="text-heading pr-2">
              {title}
            </h2>
          ) : null}
          <IconButton
            ref={closeButtonRef}
            aria-label="Close"
            onClick={onClose}
            className={title ? '' : 'ml-auto'}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              ×
            </span>
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}
