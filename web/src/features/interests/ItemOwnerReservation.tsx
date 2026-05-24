import { useState } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { ItemStatus } from '@/lib/types'
import {
  useCancelReservation,
  useMarkItemClaimed,
  useOwnerActiveReservation,
  formatReservationExpiryLabel,
} from './api'

type ItemOwnerReservationProps = {
  itemId: string
  itemStatus: ItemStatus
  isOwner: boolean
}

const panelClassName =
  'mt-6 rounded-xl border border-base-600 bg-base-800/50 p-5 sm:p-6'

function claimerLabel(displayName: string | null, userId: string): string {
  return displayName?.trim() || `${userId.slice(0, 8)}…`
}

export default function ItemOwnerReservation({
  itemId,
  itemStatus,
  isOwner,
}: ItemOwnerReservationProps) {
  const showPanel = isOwner && itemStatus === 'reserved'
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [claimConfirmOpen, setClaimConfirmOpen] = useState(false)

  const { data: reservation, isLoading, error } = useOwnerActiveReservation(
    itemId,
    showPanel
  )
  const cancelReservation = useCancelReservation(itemId)
  const markItemClaimed = useMarkItemClaimed(itemId)

  if (!showPanel) {
    return null
  }

  if (isLoading) {
    return (
      <section className={panelClassName}>
        <p className="text-sm text-ink-600">Loading reservation…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className={panelClassName}>
        <p className="text-sm text-red-400">
          Error loading reservation: {(error as Error).message}
        </p>
      </section>
    )
  }

  if (!reservation) {
    return (
      <section className={panelClassName}>
        <p className="text-sm text-ink-600">
          This item is reserved, but no active reservation record was found.
        </p>
      </section>
    )
  }

  const claimerName = claimerLabel(
    reservation.claimer_display_name,
    reservation.claimer_id
  )
  const isPending = cancelReservation.isPending || markItemClaimed.isPending
  const cancelError =
    cancelReservation.error instanceof Error ? cancelReservation.error.message : null
  const claimError =
    markItemClaimed.error instanceof Error ? markItemClaimed.error.message : null

  return (
    <>
      <section className={panelClassName}>
        <header className="mb-4 space-y-1">
          <h3 className="text-base font-medium text-ink-400">Active reservation</h3>
          <p className="text-sm text-ink-600">
            Reserved for{' '}
            <span className="text-ink-400">{claimerName}</span>
            {reservation.expires_at ? (
              <>
                {' '}
                until{' '}
                <span className="text-ink-400">
                  {formatReservationExpiryLabel(reservation.expires_at)}
                </span>
                .
              </>
            ) : (
              <>
                {' '}
                with{' '}
                <span className="text-ink-400">no pickup deadline</span>.
              </>
            )}
          </p>
        </header>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => setClaimConfirmOpen(true)}
          >
            {markItemClaimed.isPending ? 'Saving…' : 'Mark as claimed'}
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => setCancelConfirmOpen(true)}
          >
            Cancel reservation
          </Button>
        </div>
      </section>

      <Modal
        isOpen={claimConfirmOpen}
        onClose={() => {
          if (!isPending) {
            setClaimConfirmOpen(false)
            markItemClaimed.reset()
          }
        }}
        title="Mark as claimed"
      >
        <div className="space-y-4">
          <p className="text-ink-500">
            Confirm pickup with{' '}
            <strong className="text-ink-400">{claimerName}</strong>? The handoff
            will be marked complete and this item will be archived.
          </p>

          {claimError && <p className="text-sm text-red-400">Error: {claimError}</p>}

          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => setClaimConfirmOpen(false)}
            >
              Not yet
            </Button>
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() =>
                markItemClaimed.mutate(undefined, {
                  onSuccess: () => setClaimConfirmOpen(false),
                })
              }
            >
              {markItemClaimed.isPending ? 'Saving…' : 'Mark as claimed'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={cancelConfirmOpen}
        onClose={() => {
          if (!isPending) {
            setCancelConfirmOpen(false)
            cancelReservation.reset()
          }
        }}
        title="Cancel reservation"
      >
        <div className="space-y-4">
          <p className="text-ink-500">
            Cancel the reservation for{' '}
            <strong className="text-ink-400">{claimerName}</strong>? The item will
            return to <strong className="text-ink-400">available</strong> and you
            can pick someone else from the interest queue.
          </p>

          {cancelError && <p className="text-sm text-red-400">Error: {cancelError}</p>}

          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => setCancelConfirmOpen(false)}
            >
              Keep reservation
            </Button>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() =>
                cancelReservation.mutate(undefined, {
                  onSuccess: () => setCancelConfirmOpen(false),
                })
              }
            >
              {cancelReservation.isPending ? 'Cancelling…' : 'Cancel reservation'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
