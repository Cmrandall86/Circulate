import { useState } from 'react'
import { Link, useParams, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import type { Item } from '../lib/types'
import { useDeleteItem, useItemImages, itemKeys } from '@/features/items/api'
import {
  useAdminItem,
  useAdminArchiveItem,
  useAdminDeleteItem,
} from '@/features/admin-items/api'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'

type ConfirmAction = 'delete-owner' | 'delete-admin' | 'archive'

export default function ItemDetail() {
  const { id } = useParams({ from: '/item/$id' })
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { data: role, isLoading: roleLoading } = useRole()

  const isAdmin = role === 'admin'

  // Wait for auth + role to settle before enabling either query.
  // This prevents the normal query from firing (and possibly erroring on RLS)
  // before we know the user is an admin.
  const settled = !authLoading && (!user || !roleLoading)
  const adminQueryEnabled = settled && isAdmin
  const normalQueryEnabled = settled && !isAdmin

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  // Admin fetch — bypasses RLS via Edge Function
  const adminItemQuery = useAdminItem(id, { enabled: adminQueryEnabled })

  // Normal fetch — subject to RLS (public items or group-visible items the user can see)
  const normalItemQuery = useQuery({
    queryKey: itemKeys.one(id),
    enabled: normalQueryEnabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*, item_visibility_groups(item_id, group_id, tier)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Item & {
        item_visibility_groups: { item_id: string; group_id: string; tier: number }[]
      }
    },
  })

  // Images — admin version comes from the Edge Function (signed via service-role);
  // non-admin version comes from useItemImages (signed via user session).
  const { data: normalImages, isLoading: normalImagesLoading } = useItemImages(id)

  // Mutations
  const ownerDeleteItem = useDeleteItem(id)
  const adminArchive = useAdminArchiveItem()
  const adminDelete = useAdminDeleteItem()

  const item = isAdmin ? adminItemQuery.data?.item : normalItemQuery.data
  const images = isAdmin ? adminItemQuery.data?.images : normalImages
  const imagesLoading = isAdmin ? adminItemQuery.isLoading : normalImagesLoading

  const isLoading = isAdmin ? adminItemQuery.isLoading : normalItemQuery.isLoading
  const error = isAdmin ? adminItemQuery.error : normalItemQuery.error

  const isOwner = !!user && item?.owner_id === user.id
  const canModerate = isOwner || isAdmin

  const isAlreadyArchived = item?.status === 'archived'
  const isMutating = ownerDeleteItem.isPending || adminArchive.isPending || adminDelete.isPending

  function handleConfirm() {
    if (confirmAction === 'delete-owner') {
      ownerDeleteItem.mutate(undefined, {
        onSuccess: () => navigate({ to: '/' }),
      })
    } else if (confirmAction === 'delete-admin') {
      adminDelete.mutate(id, {
        onSuccess: () => navigate({ to: '/' }),
      })
    } else if (confirmAction === 'archive') {
      adminArchive.mutate(id, {
        onSuccess: () => setConfirmAction(null),
      })
    }
  }

  const mutationError =
    ownerDeleteItem.error instanceof Error ? ownerDeleteItem.error.message
    : adminDelete.error instanceof Error ? adminDelete.error.message
    : adminArchive.error instanceof Error ? adminArchive.error.message
    : null

  if (!settled || isLoading) return <div className="text-ink-500">Loading...</div>
  if (error) return <div className="text-red-500">Error: {(error as Error).message}</div>
  if (!item) return <div className="text-ink-600">Item not found</div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card p-6">
        {/* Admin notice when viewing another user's item */}
        {isAdmin && !isOwner && (
          <div className="mb-4 px-3 py-2 rounded border border-yellow-600/40 bg-yellow-600/10 text-yellow-400 text-sm flex items-center gap-2">
            <span>Admin view — this item belongs to another user.</span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-ink-400">{item.title}</h1>
            {isAlreadyArchived && (
              <Badge variant="default" className="mt-1 shrink-0">archived</Badge>
            )}
          </div>

          {canModerate && (
            <div className="flex gap-2 shrink-0">
              {/* Edit — available to owner and admin */}
              <Link to={`/item/${id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>

              {/* Delete */}
              <Button
                variant="danger"
                disabled={isMutating}
                onClick={() =>
                  setConfirmAction(isOwner ? 'delete-owner' : 'delete-admin')
                }
              >
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Image Gallery */}
        {imagesLoading && (
          <div className="w-full h-96 bg-base-800 rounded-lg mb-6 flex items-center justify-center">
            <span className="text-ink-600">Loading images...</span>
          </div>
        )}
        {!imagesLoading && images && images.length > 0 && (
          <div className="mb-6">
            <div className="relative w-full h-96 bg-base-800 rounded-lg overflow-hidden mb-4">
              <img
                src={images[selectedImageIndex]?.signed_url || ''}
                alt={`${item.title} — image ${selectedImageIndex + 1}`}
                className="w-full h-full object-contain"
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setSelectedImageIndex((p) => (p - 1 + images.length) % images.length)
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-base-900/80 hover:bg-base-900 text-ink-400 rounded-full w-10 h-10 flex items-center justify-center"
                  >
                    ←
                  </button>
                  <button
                    onClick={() =>
                      setSelectedImageIndex((p) => (p + 1) % images.length)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-base-900/80 hover:bg-base-900 text-ink-400 rounded-full w-10 h-10 flex items-center justify-center"
                  >
                    →
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-base-900/80 px-3 py-1 rounded-full text-ink-400 text-sm">
                    {selectedImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      idx === selectedImageIndex ? 'border-mint-400' : 'border-base-700'
                    }`}
                  >
                    <img
                      src={img.signed_url || ''}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {item.description && <p className="text-ink-500 mb-4">{item.description}</p>}
        {item.condition && <p className="text-ink-600 mb-2">Condition: {item.condition}</p>}
        {item.category && <p className="text-ink-600 mb-2">Category: {item.category}</p>}
        {item.approx_location && (
          <p className="text-ink-600 mb-4">Location: {item.approx_location}</p>
        )}
        <div className="text-sm text-ink-600">
          Created: {new Date(item.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* Confirmation modal for archive / delete */}
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => {
          if (!isMutating) {
            setConfirmAction(null)
            ownerDeleteItem.reset?.()
            adminDelete.reset?.()
            adminArchive.reset?.()
          }
        }}
        title={
          confirmAction === 'archive'
            ? 'Archive item'
            : 'Delete item'
        }
      >
        <div className="space-y-4">
          {confirmAction === 'archive' && (
            <p className="text-ink-500">
              Archive <strong className="text-ink-400">"{item.title}"</strong>? It will be hidden
              from the feed. Images are preserved and the item can be reviewed later.
            </p>
          )}
          {(confirmAction === 'delete-owner' || confirmAction === 'delete-admin') && (
            <>
              <p className="text-ink-500">
                Permanently delete{' '}
                <strong className="text-ink-400">"{item.title}"</strong>?
              </p>
              <p className="text-sm text-red-400">
                All images and associated data will be removed. This cannot be undone.
              </p>
            </>
          )}

          {mutationError && (
            <p className="text-red-400 text-sm">Error: {mutationError}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => setConfirmAction(null)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction === 'archive' ? 'primary' : 'danger'}
              onClick={handleConfirm}
              disabled={isMutating}
            >
              {isMutating
                ? confirmAction === 'archive' ? 'Archiving…' : 'Deleting…'
                : confirmAction === 'archive' ? 'Archive' : 'Delete permanently'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
