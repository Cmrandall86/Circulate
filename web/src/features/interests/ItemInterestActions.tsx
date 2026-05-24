import { Link } from '@tanstack/react-router'
import Button from '@/components/ui/Button'
import type { InterestLevel, ItemStatus } from '@/lib/types'
import {
  INTEREST_LEVEL_ORDER,
  INTEREST_LEVELS,
  useActiveReservation,
  useMyInterest,
  useSetInterest,
  useWithdrawInterest,
  formatReservationExpiryLabel,
} from './api'

type ItemInterestActionsProps = {
  itemId: string
  itemStatus: ItemStatus
  ownerId: string
  userId: string | undefined
  authSettled: boolean
}

const panelClassName =
  'mt-6 rounded-xl border border-base-600 bg-base-800/50 p-5 sm:p-6'

function levelButtonClassName(isSelected: boolean): string {
  const base =
    'w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-default'

  if (isSelected) {
    return `${base} border-mint-400 bg-mint-400/10 text-mint-300`
  }

  return `${base} border-base-600 bg-base-900/40 text-ink-400 hover:border-base-500 hover:bg-base-800`
}

export default function ItemInterestActions({
  itemId,
  itemStatus,
  ownerId,
  userId,
  authSettled,
}: ItemInterestActionsProps) {
  const isOwner = !!userId && userId === ownerId
  const isAvailable = itemStatus === 'available'
  const isReserved = itemStatus === 'reserved'
  const canViewMemberState =
    authSettled && !!userId && !isOwner && (isAvailable || isReserved)

  const { data: myInterest, isLoading: interestLoading } = useMyInterest(
    itemId,
    canViewMemberState
  )
  const { data: myReservation, isLoading: reservationLoading } = useActiveReservation(
    itemId,
    canViewMemberState && isReserved
  )
  const setInterest = useSetInterest(itemId)
  const withdrawInterest = useWithdrawInterest(itemId)

  const isPending = setInterest.isPending || withdrawInterest.isPending
  const mutationError =
    setInterest.error instanceof Error
      ? setInterest.error.message
      : withdrawInterest.error instanceof Error
        ? withdrawInterest.error.message
        : null

  if (!authSettled) {
    return null
  }

  if (!userId) {
    return (
      <section className={panelClassName}>
        <header className="mb-4 space-y-1">
          <h3 className="text-base font-medium text-ink-400">Express interest</h3>
          <p className="text-sm text-ink-600">
            Sign in to let the owner know you want this item.
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Link to="/signin">
            <Button variant="primary">Sign in</Button>
          </Link>
          <Link to="/signup">
            <Button variant="secondary">Create account</Button>
          </Link>
        </div>
      </section>
    )
  }

  if (isOwner) {
    return null
  }

  if (isReserved) {
    if (interestLoading || reservationLoading) {
      return (
        <div className="mt-6 text-sm text-ink-600">Loading reservation…</div>
      )
    }

    if (myReservation) {
      return (
        <section className={panelClassName}>
          <header className="mb-2 space-y-1">
            <h3 className="text-base font-medium text-mint-300">You were chosen</h3>
            <p className="text-sm text-ink-400">
              The owner reserved this item for you. Coordinate pickup outside the
              app
              {myReservation.expires_at ? (
                <>
                  {' '}
                  before{' '}
                  <span className="text-ink-300">
                    {formatReservationExpiryLabel(myReservation.expires_at)}
                  </span>
                </>
              ) : (
                <>
                  {' '}
                  — there is{' '}
                  <span className="text-ink-300">no pickup deadline</span>
                </>
              )}
              .
            </p>
          </header>
        </section>
      )
    }

    if (myInterest) {
      return (
        <section className={panelClassName}>
          <p className="text-sm text-ink-600">
            This item is reserved for someone else. Your interest is still on
            record if the reservation falls through.
          </p>
        </section>
      )
    }

    return (
      <section className={panelClassName}>
        <p className="text-sm text-ink-600">
          This item is not accepting interest right now.
        </p>
      </section>
    )
  }

  if (!isAvailable) {
    return (
      <section className={panelClassName}>
        <p className="text-sm text-ink-600">
          This item is not accepting interest right now.
        </p>
      </section>
    )
  }

  if (interestLoading) {
    return (
      <div className="mt-6 text-sm text-ink-600">Loading interest…</div>
    )
  }

  const currentLevel = myInterest?.state

  return (
    <section className={panelClassName}>
      <header className="mb-4 space-y-1">
        <h3 className="text-base font-medium text-ink-400">
          {currentLevel ? 'Your interest' : 'Express interest'}
        </h3>
        <p className="text-sm text-ink-600">
          {currentLevel
            ? `You're currently set to "${INTEREST_LEVELS[currentLevel]}". Pick another level to update.`
            : 'Choose how strongly you want this item.'}
        </p>
      </header>

      <div className="space-y-2" role="group" aria-label="Interest level">
        {INTEREST_LEVEL_ORDER.map((level: InterestLevel) => {
          const isSelected = currentLevel === level
          const isSaving = isPending && setInterest.variables === level

          return (
            <button
              key={level}
              type="button"
              className={levelButtonClassName(isSelected)}
              disabled={isPending || isSelected}
              aria-pressed={isSelected}
              onClick={() => setInterest.mutate(level)}
            >
              {isSaving ? 'Saving…' : INTEREST_LEVELS[level]}
            </button>
          )
        })}
      </div>

      {currentLevel && (
        <div className="mt-5 border-t border-base-600 pt-4">
          <Button
            variant="ghost"
            className="w-full rounded-lg border border-base-600 bg-base-900/30 py-2.5 text-ink-500 hover:border-ink-600 hover:bg-base-900/60 hover:text-ink-400"
            disabled={isPending}
            onClick={() => withdrawInterest.mutate()}
          >
            {withdrawInterest.isPending ? 'Withdrawing…' : 'Withdraw interest'}
          </Button>
        </div>
      )}

      {mutationError && (
        <p className="mt-4 text-sm text-red-400">Error: {mutationError}</p>
      )}
    </section>
  )
}
