import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useFeed, useOwnerArchivedFeed, useOwnerReservedFeed, type ArchivedItemWithImages } from '../hooks/useFeed'
import ItemCard from '../components/ItemCard'
import Button from '../components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useOwnerInterestIndicators } from '@/features/interests/api'
import { resolveItemPublicArea } from '@/lib/publicArea'

type FeedView = 'browse' | 'reserved' | 'archived'

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Feed() {
  const { user, loading: authLoading } = useAuth()
  const [view, setView] = useState<FeedView>('browse')

  const browseQuery = useFeed(!!user)
  const reservedQuery = useOwnerReservedFeed(!authLoading && !!user && view === 'reserved')
  const archivedQuery = useOwnerArchivedFeed(!authLoading && !!user && view === 'archived')
  const ownerIndicatorsQuery = useOwnerInterestIndicators(
    !authLoading && !!user && view === 'browse'
  )

  const ownerIndicatorByItemId = useMemo(() => {
    const map = new Map<string, { interestCount: number; hasUnread: boolean }>()
    for (const row of ownerIndicatorsQuery.data ?? []) {
      map.set(row.item_id, {
        interestCount: row.interest_count,
        hasUnread: row.has_unread,
      })
    }
    return map
  }, [ownerIndicatorsQuery.data])

  const isArchivedView = view === 'archived' && !!user
  const isReservedView = view === 'reserved' && !!user
  const activeQuery = isArchivedView
    ? archivedQuery
    : isReservedView
      ? reservedQuery
      : browseQuery
  const { data: items, isLoading, error } = activeQuery

  if (isLoading || authLoading) {
    return <div className="text-body text-ink-500">Loading feed...</div>
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-6 card border border-red-500/30 rounded-lg">
        <h2 className="text-heading mb-2 text-red-400">Failed to load feed</h2>
        <p className="text-caption">Something went wrong. Please try refreshing the page.</p>
      </div>
    )
  }

  const showPostAction = !isArchivedView && !isReservedView

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-title min-w-0">
            {isArchivedView
              ? 'My archived items'
              : isReservedView
                ? 'My reserved items'
                : 'Feed'}
          </h1>
          {showPostAction && (
            <Link
              to="/new"
              aria-label="Post item"
              className="interactive-focus btn-accent inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-black sm:hidden"
            >
              <PlusIcon />
            </Link>
          )}
        </div>

        {(user || showPostAction) && (
          <div className="flex items-center justify-between gap-3">
            {user && (
              <div
                className="flex w-full min-w-0 gap-1 rounded-2xl border border-base-600 bg-base-800/80 p-1 sm:w-auto sm:border-0 sm:bg-transparent sm:p-0 sm:gap-2"
                role="tablist"
                aria-label="Feed views"
              >
                {(
                  [
                    ['browse', 'Browse'],
                    ['reserved', 'Reserved'],
                    ['archived', 'My archived'],
                  ] as const
                ).map(([value, label]) => {
                  const active = view === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setView(value)}
                      className={`interactive-focus min-w-0 flex-1 rounded-xl px-2 py-2 text-caption font-medium transition-colors sm:flex-none sm:rounded-2xl sm:px-4 sm:py-2 sm:text-body ${
                        active
                          ? 'bg-base-700 text-ink-400 shadow-sm sm:btn-accent sm:text-black sm:shadow-none'
                          : 'text-ink-600 hover:bg-base-700/60 hover:text-ink-400 sm:bg-base-700 sm:text-ink-400 sm:hover:bg-base-600'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            {showPostAction && (
              <Link to="/new" className="hidden shrink-0 sm:block">
                <Button className="btn-accent whitespace-nowrap">Post item</Button>
              </Link>
            )}
          </div>
        )}
      </header>

      {isReservedView && (
        <p className="text-caption">
          Items you have reserved for pickup. Open an item to mark it as claimed
          once the handoff is complete, or cancel the reservation to offer it
          again on the browse feed.
        </p>
      )}

      {isArchivedView && (
        <p className="text-caption">
          Archived items are hidden from the public browse feed. Handoff complete
          means pickup was confirmed; Removed means you archived without completing
          a handoff.
        </p>
      )}

      {!items || items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-caption mb-4">
            {isArchivedView
              ? 'No archived items yet.'
              : isReservedView
                ? 'No reserved items. When you reserve an item for someone, it will appear here until pickup is confirmed or the reservation is cancelled.'
                : 'No available items yet. Post one to get started!'}
          </p>
          {!isArchivedView && !isReservedView && (
            <Link to="/new">
              <Button className="btn-accent">Post your first item</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid justify-items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))]">
          {items.map((item) => {
            const ownerIndicator =
              user && item.owner_id === user.id
                ? ownerIndicatorByItemId.get(item.id)
                : undefined

            return (
              <ItemCard
                key={item.id}
                item={item}
                constrainWidth={items.length <= 3}
                archiveKind={
                  isArchivedView
                    ? (item as ArchivedItemWithImages).archiveKind
                    : undefined
                }
                interestCount={ownerIndicator?.interestCount}
                hasUnreadInterest={ownerIndicator?.hasUnread}
                publicArea={
                  user
                    ? resolveItemPublicArea(
                        item.approx_location,
                        item.owner_public_area,
                      )
                    : null
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
