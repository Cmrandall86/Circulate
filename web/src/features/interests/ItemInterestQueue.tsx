import Badge from '@/components/ui/Badge'
import type { InterestLevel, ItemStatus } from '@/lib/types'
import { INTEREST_LEVELS, useItemInterestQueue } from './api'

type ItemInterestQueueProps = {
  itemId: string
  itemStatus: ItemStatus
  isOwner: boolean
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

export default function ItemInterestQueue({
  itemId,
  itemStatus,
  isOwner,
}: ItemInterestQueueProps) {
  const showQueue = isOwner && itemStatus === 'available'
  const { data: queue, isLoading, error } = useItemInterestQueue(itemId, showQueue)

  if (!showQueue) {
    return null
  }

  if (isLoading) {
    return (
      <section className={panelClassName}>
        <p className="text-sm text-ink-600">Loading interest queue…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className={panelClassName}>
        <p className="text-sm text-red-400">
          Error loading interest queue: {(error as Error).message}
        </p>
      </section>
    )
  }

  return (
    <section className={panelClassName}>
      <header className="mb-4 space-y-1">
        <h3 className="text-base font-medium text-ink-400">Interest queue</h3>
        <p className="text-sm text-ink-600">
          Members who want this item, sorted by level then arrival time.
        </p>
      </header>

      {!queue?.length ? (
        <p className="text-sm text-ink-600">
          No one has expressed interest yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {queue.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-lg border border-base-600 bg-base-900/40 px-3 py-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-base-600 bg-base-700">
                {entry.avatar_display_url ? (
                  <img
                    src={entry.avatar_display_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-ink-500">
                    {avatarInitial(entry.display_name, entry.user_id)}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-400">
                  {memberLabel(entry.display_name, entry.user_id)}
                </p>
                <p className="text-xs text-ink-600">
                  {formatInterestTimestamp(entry.created_at)}
                </p>
              </div>

              <Badge
                variant={interestLevelBadgeVariant(entry.state)}
                className="shrink-0"
              >
                {INTEREST_LEVELS[entry.state]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
