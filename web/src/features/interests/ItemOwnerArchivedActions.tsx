import { useState } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { ItemStatus } from '@/lib/types'
import type { ArchivedItemKind } from '@/features/items/status'
import { useReactivateItem } from './api'

type ItemOwnerArchivedActionsProps = {
  itemId: string
  itemTitle: string
  itemStatus: ItemStatus
  isOwner: boolean
  archiveKind: ArchivedItemKind | undefined
  archiveKindLoading: boolean
}

const panelClassName =
  'mt-6 rounded-xl border border-base-600 bg-base-800/50 p-5 sm:p-6'

export default function ItemOwnerArchivedActions({
  itemId,
  itemTitle,
  itemStatus,
  isOwner,
  archiveKind,
  archiveKindLoading,
}: ItemOwnerArchivedActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const reactivateItem = useReactivateItem(itemId)

  if (!isOwner || itemStatus !== 'archived') {
    return null
  }

  if (archiveKindLoading) {
    return (
      <section className={panelClassName}>
        <p className="text-sm text-ink-600">Loading archive details…</p>
      </section>
    )
  }

  if (archiveKind === 'handoff_complete') {
    return (
      <section className={panelClassName}>
        <p className="text-sm text-ink-600">
          This handoff is complete. Completed giveaways stay archived and cannot
          re-enter the browse feed.
        </p>
      </section>
    )
  }

  const mutationError =
    reactivateItem.error instanceof Error ? reactivateItem.error.message : null

  return (
    <>
      <section className={panelClassName}>
        <header className="mb-4 space-y-1">
          <h3 className="text-base font-medium text-ink-400">Archived item</h3>
          <p className="text-sm text-ink-600">
            This item was removed from the browse feed without a completed handoff.
            You can return it to the live feed if you want to offer it again.
          </p>
        </header>

        <Button
          variant="primary"
          className="w-full sm:w-auto"
          disabled={reactivateItem.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Return to feed
        </Button>

        {mutationError && (
          <p className="mt-4 text-sm text-red-400">Error: {mutationError}</p>
        )}
      </section>

      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!reactivateItem.isPending) {
            setConfirmOpen(false)
            reactivateItem.reset()
          }
        }}
        title="Return to feed"
      >
        <div className="space-y-4">
          <p className="text-ink-500">
            Return <strong className="text-ink-400">"{itemTitle}"</strong> to the
            browse feed as <strong className="text-ink-400">available</strong>?
            Existing interest rows will stay on record.
          </p>

          {mutationError && (
            <p className="text-sm text-red-400">Error: {mutationError}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              disabled={reactivateItem.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={reactivateItem.isPending}
              onClick={() =>
                reactivateItem.mutate(undefined, {
                  onSuccess: () => setConfirmOpen(false),
                })
              }
            >
              {reactivateItem.isPending ? 'Returning…' : 'Return to feed'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
