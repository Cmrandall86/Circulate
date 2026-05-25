import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useFeed, useOwnerArchivedFeed, useOwnerReservedFeed, type ArchivedItemWithImages } from '../hooks/useFeed'
import ItemCard from '../components/ItemCard'
import Button from '../components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useOwnerInterestIndicators } from '@/features/interests/api'
import { resolveItemPublicArea } from '@/lib/publicArea'

type FeedView = 'browse' | 'reserved' | 'archived'

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <h1 className="text-title">
            {isArchivedView
              ? 'My archived items'
              : isReservedView
                ? 'My reserved items'
                : 'Feed'}
          </h1>
          {user && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={view === 'browse' ? 'primary' : 'secondary'}
                onClick={() => setView('browse')}
              >
                Browse
              </Button>
              <Button
                variant={view === 'reserved' ? 'primary' : 'secondary'}
                onClick={() => setView('reserved')}
              >
                Reserved
              </Button>
              <Button
                variant={view === 'archived' ? 'primary' : 'secondary'}
                onClick={() => setView('archived')}
              >
                My archived
              </Button>
            </div>
          )}
        </div>
        {!isArchivedView && !isReservedView && (
          <Link to="/new">
            <Button className="btn-accent">Create Item</Button>
          </Link>
        )}
      </div>

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
                : 'No available items yet. Create one to get started!'}
          </p>
          {!isArchivedView && !isReservedView && (
            <Link to="/new">
              <Button className="btn-accent">Create Your First Item</Button>
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
