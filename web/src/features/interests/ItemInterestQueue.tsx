import { useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import type { InterestLevel, ItemStatus } from '@/lib/types'
import {
  INTEREST_LEVELS,
  RESERVATION_EXPIRY_PRESETS,
  formatReservationExpiryLabel,
  maxCustomExpiryDate,
  minCustomExpiryDate,
  resolveReservationExpiresAt,
  useCreateReservation,
  useItemInterestQueue,
  useMarkItemInterestsViewed,
  type ReservationExpiryPreset,
} from './api'

type ItemInterestQueueProps = {
  itemId: string
  itemStatus: ItemStatus
  isOwner: boolean
}

type ReserveTarget = {
  userId: string
  displayName: string
}

const panelClassName =
  'mt-6 rounded-xl border border-base-600 bg-base-800/50 p-5 sm:p-6'

function interestLevelBadgeVariant(
  level: InterestLevel
): 'success' | 'default' {
  return level === 'need' ? 'success' : 'default'
}

function formatInterestTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function memberLabel(displayName: string | null, userId: string): string {
  return displayName?.trim() || `${userId.slice(0, 8)}…`
}

function avatarInitial(displayName: string | null, userId: string): string {
  const source = displayName?.trim() || userId
  return source.charAt(0).toUpperCase()
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function presetButtonClassName(isSelected: boolean): string {
  const base =
    'text-body interactive-focus rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default'

  if (isSelected) {
    return `${base} border-link bg-mint-400/10 text-link font-semibold`
  }

  return `${base} border-base-600 bg-base-900/40 text-ink-400 hover:border-base-500 hover:bg-base-800`
}

export default function ItemInterestQueue({
  itemId,
  itemStatus,
  isOwner,
}: ItemInterestQueueProps) {
  const showQueue = isOwner && itemStatus === 'available'
  const { data: queue, isLoading, error } = useItemInterestQueue(itemId, showQueue)
  const createReservation = useCreateReservation(itemId)
  const markInterestsViewed = useMarkItemInterestsViewed(itemId)
  const markedViewedRef = useRef(false)

  const [reserveTarget, setReserveTarget] = useState<ReserveTarget | null>(null)
  const [expiryPreset, setExpiryPreset] = useState<ReservationExpiryPreset>('7d')
  const [customDateTime, setCustomDateTime] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    markedViewedRef.current = false
  }, [itemId])

  useEffect(() => {
    if (!showQueue || isLoading || error || markedViewedRef.current) {
      return
    }

    markedViewedRef.current = true
    markInterestsViewed.mutate()
  }, [showQueue, isLoading, error, itemId, markInterestsViewed.mutate])

  function openReserveModal(userId: string, displayName: string | null) {
    setFormError('')
    setExpiryPreset('7d')
    setCustomDateTime(toDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)))
    setReserveTarget({
      userId,
      displayName: memberLabel(displayName, userId),
    })
  }

  function closeReserveModal() {
    if (createReservation.isPending) return
    setReserveTarget(null)
    setFormError('')
    createReservation.reset()
  }

  function handleConfirmReserve() {
    if (!reserveTarget) return

    try {
      const expiresAt = resolveReservationExpiresAt(expiryPreset, customDateTime)
      createReservation.mutate(
        { claimerId: reserveTarget.userId, expiresAt },
        {
          onSuccess: () => closeReserveModal(),
          onError: (err) => {
            setFormError(err instanceof Error ? err.message : 'Failed to reserve')
          },
        }
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Invalid reservation options')
    }
  }

  const previewExpiresAt = (() => {
    try {
      return resolveReservationExpiresAt(expiryPreset, customDateTime)
    } catch {
      return undefined
    }
  })()

  if (!showQueue) {
    return null
  }

  if (isLoading) {
    return (
      <section className={panelClassName}>
        <p className="text-caption">Loading interest queue…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className={panelClassName}>
        <p className="text-caption text-red-400">
          Error loading interest queue: {(error as Error).message}
        </p>
      </section>
    )
  }

  const mutationError =
    createReservation.error instanceof Error ? createReservation.error.message : null

  return (
    <>
      <section className={panelClassName}>
        <header className="mb-4 space-y-1">
          <h3 className="text-heading">Interest queue</h3>
          <p className="text-caption">
            Members who want this item, sorted by level then arrival time. Reserve
            one person and choose how long the pickup window lasts.
          </p>
        </header>

        {!queue?.length ? (
          <p className="text-caption">
            No one has expressed interest yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((entry) => {
              const isReserving =
                createReservation.isPending &&
                createReservation.variables?.claimerId === entry.user_id

              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-lg border border-base-600 bg-base-900/40 px-3 py-3 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-base-600 bg-base-700">
                      {entry.avatar_display_url ? (
                        <img
                          src={entry.avatar_display_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-caption font-medium text-ink-500">
                          {avatarInitial(entry.display_name, entry.user_id)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-body truncate font-medium">
                        {memberLabel(entry.display_name, entry.user_id)}
                      </p>
                    <p className="text-caption">
                      {formatInterestTimestamp(entry.created_at)}
                    </p>
                    {entry.mutual_group_names.length > 0 ? (
                      <p className="text-caption mt-1 text-link">
                        Shared groups: {entry.mutual_group_names.join(', ')}
                      </p>
                    ) : (
                      <p className="text-caption mt-1">No shared groups</p>
                    )}
                  </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    <Badge variant={interestLevelBadgeVariant(entry.state)}>
                      {INTEREST_LEVELS[entry.state]}
                    </Badge>
                    <Button
                      variant="primary"
                      className="min-w-[5.5rem]"
                      disabled={createReservation.isPending}
                      onClick={() => openReserveModal(entry.user_id, entry.display_name)}
                    >
                      {isReserving ? 'Reserving…' : 'Reserve'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {mutationError && !reserveTarget && (
          <p className="mt-4 text-caption text-red-400" role="alert">
            Error: {mutationError}
          </p>
        )}
      </section>

      <Modal
        isOpen={reserveTarget !== null}
        onClose={closeReserveModal}
        title="Reserve for pickup"
      >
        {reserveTarget && (
          <div className="space-y-4">
            <p className="text-body text-ink-500">
              Reserve this item for{' '}
              <strong className="text-ink-400">{reserveTarget.displayName}</strong>.
              Choose how long they have to coordinate pickup.
            </p>

            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Pickup deadline">
              {RESERVATION_EXPIRY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={presetButtonClassName(expiryPreset === preset.id)}
                  disabled={createReservation.isPending}
                  aria-pressed={expiryPreset === preset.id}
                  onClick={() => {
                    setFormError('')
                    setExpiryPreset(preset.id)
                  }}
                >
                  <span className="text-body block font-medium">{preset.label}</span>
                  <span className="text-caption block">{preset.description}</span>
                </button>
              ))}
            </div>

            {expiryPreset === 'custom' && (
              <Input
                label="Custom deadline"
                type="datetime-local"
                value={customDateTime}
                min={toDateTimeLocalValue(minCustomExpiryDate())}
                max={toDateTimeLocalValue(maxCustomExpiryDate())}
                disabled={createReservation.isPending}
                onChange={(e) => {
                  setFormError('')
                  setCustomDateTime(e.target.value)
                }}
              />
            )}

            {previewExpiresAt !== undefined && (
              <p className="text-caption">
                Pickup window:{' '}
                <span className="text-ink-400">
                  {formatReservationExpiryLabel(previewExpiresAt)}
                </span>
              </p>
            )}

            {formError && (
              <p className="text-caption text-red-400" role="alert">
                Error: {formError}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                disabled={createReservation.isPending}
                onClick={closeReserveModal}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={createReservation.isPending}
                onClick={handleConfirmReserve}
              >
                {createReservation.isPending ? 'Reserving…' : 'Confirm reservation'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
