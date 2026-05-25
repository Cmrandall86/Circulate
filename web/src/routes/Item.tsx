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
import { itemStatusBadgeVariant, itemStatusLabel, archivedItemBadgeVariant, archivedItemLabel, canEditItem } from '@/features/items/status'
import { useArchivedItemKind } from '@/hooks/useFeed'
import ItemGallery from '@/features/items/ItemGallery'
import ItemInterestActions from '@/features/interests/ItemInterestActions'
import ItemInterestQueue from '@/features/interests/ItemInterestQueue'
import ItemOwnerReservation from '@/features/interests/ItemOwnerReservation'
import ItemOwnerArchivedActions from '@/features/interests/ItemOwnerArchivedActions'
import { recoverExpiredReservations, useOwnerArchiveItem } from '@/features/interests/api'
import type { ItemStatus } from '@/lib/types'
import { resolveItemPublicArea } from '@/lib/publicArea'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'

type ConfirmAction = 'delete-owner' | 'delete-admin' | 'archive-owner' | 'archive-admin'

const ARCHIVABLE_STATUSES: ItemStatus[] = ['available', 'reserved']

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
  const reservationRecoveryQuery = useQuery({
    queryKey: ['reservations', 'recover'] as const,
    enabled: settled && !!id,
    queryFn: async () => {
      await recoverExpiredReservations()
      return true
    },
    staleTime: 0,
  })
  const handoffReady = reservationRecoveryQuery.isSuccess
  const adminQueryEnabled = settled && isAdmin && handoffReady
  const normalQueryEnabled = settled && !isAdmin && handoffReady

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  // Admin fetch — bypasses RLS via Edge Function
  const adminItemQuery = useAdminItem(id, { enabled: adminQueryEnabled })

  // Normal fetch — subject to RLS (public items or group-visible items the user can see)
  const normalItemQuery = useQuery({
    queryKey: itemKeys.one(id),
    enabled: normalQueryEnabled,
    queryFn: async () => {
      const { data: { user: sessionUser } } = await supabase.auth.getUser()
      const itemFields = sessionUser
        ? '*'
        : 'id, title, description, condition, category, status, visibility, owner_id, created_at, updated_at'

      const { data, error } = await supabase
        .from('items')
        .select(`${itemFields}, item_visibility_groups(item_id, group_id, tier)`)
        .eq('id', id)
        .single()
      if (error) throw error

      let owner_public_area: string | null = null
      if (sessionUser) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('public_area')
          .eq('id', data.owner_id)
          .maybeSingle()
        owner_public_area = ownerProfile?.public_area ?? null
      }

      return {
        ...(data as Item & {
          item_visibility_groups: { item_id: string; group_id: string; tier: number }[]
        }),
        owner_public_area,
      }
    },
  })

  // Images — admin version comes from the Edge Function (signed via service-role);
  // non-admin version comes from useItemImages (signed via user session).
  const { data: normalImages, isLoading: normalImagesLoading } = useItemImages(id)

  // Mutations
  const ownerDeleteItem = useDeleteItem(id)
  const ownerArchiveItem = useOwnerArchiveItem(id)
  const adminArchive = useAdminArchiveItem()
  const adminDelete = useAdminDeleteItem()

  const item = isAdmin ? adminItemQuery.data?.item : normalItemQuery.data
  const images = isAdmin ? adminItemQuery.data?.images : normalImages
  const imagesLoading = isAdmin ? adminItemQuery.isLoading : normalImagesLoading

  const memberPublicArea = user
    ? resolveItemPublicArea(
        item?.approx_location,
        isAdmin
          ? (item as { owner_public_area?: string | null } | undefined)?.owner_public_area
          : (normalItemQuery.data as { owner_public_area?: string | null } | undefined)
              ?.owner_public_area,
      )
    : null

  const isLoading =
    reservationRecoveryQuery.isLoading ||
    (isAdmin ? adminItemQuery.isLoading : normalItemQuery.isLoading)
  const error = isAdmin ? adminItemQuery.error : normalItemQuery.error

  const isOwner = !!user && item?.owner_id === user.id
  const canModerate = isOwner || isAdmin
  const canOwnerArchive =
    isOwner && !!item && ARCHIVABLE_STATUSES.includes(item.status)

  const { data: archiveKind, isLoading: archiveKindLoading } = useArchivedItemKind(
    id,
    item?.status ?? '',
    settled && !!item && item.status === 'archived'
  )

  const showEdit =
    canModerate &&
    !!item &&
    canEditItem(item.status, archiveKind) &&
    !(item.status === 'archived' && archiveKindLoading)

  const isMutating =
    ownerDeleteItem.isPending ||
    ownerArchiveItem.isPending ||
    adminArchive.isPending ||
    adminDelete.isPending

  const statusBadge = item ? (
    <Badge
      variant={
        item.status === 'archived' && archiveKind
          ? archivedItemBadgeVariant(archiveKind)
          : itemStatusBadgeVariant(item.status)
      }
      className="mt-1 shrink-0"
    >
      {item.status === 'archived' && archiveKind
        ? archivedItemLabel(archiveKind)
        : itemStatusLabel(item.status)}
    </Badge>
  ) : null

  function handleConfirm() {
    if (confirmAction === 'delete-owner') {
      ownerDeleteItem.mutate(undefined, {
        onSuccess: () => navigate({ to: '/' }),
      })
    } else if (confirmAction === 'delete-admin') {
      adminDelete.mutate(id, {
        onSuccess: () => navigate({ to: '/' }),
      })
    } else if (confirmAction === 'archive-owner') {
      ownerArchiveItem.mutate(undefined, {
        onSuccess: () => setConfirmAction(null),
      })
    } else if (confirmAction === 'archive-admin') {
      adminArchive.mutate(id, {
        onSuccess: () => setConfirmAction(null),
      })
    }
  }

  const mutationError =
    ownerDeleteItem.error instanceof Error ? ownerDeleteItem.error.message
    : ownerArchiveItem.error instanceof Error ? ownerArchiveItem.error.message
    : adminDelete.error instanceof Error ? adminDelete.error.message
    : adminArchive.error instanceof Error ? adminArchive.error.message
    : null

  if (!settled || isLoading) return <div className="text-body text-ink-500">Loading...</div>
  if (error) return <div className="text-body text-red-500">Error: {(error as Error).message}</div>
  if (!item) return <div className="text-caption">Item not found</div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card p-6">
        {/* Admin notice when viewing another user's item */}
        {isAdmin && !isOwner && (
          <div className="text-caption mb-4 flex items-center gap-2 rounded border border-yellow-600/40 bg-yellow-600/10 px-3 py-2 text-yellow-400">
            <span>Admin view — this item belongs to another user.</span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <h1 className="text-title">{item.title}</h1>
            {statusBadge}
          </div>

          {canModerate && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {showEdit && (
                <Link to={`/item/${id}/edit`}>
                  <Button variant="secondary">Edit</Button>
                </Link>
              )}

              {canOwnerArchive && (
                <Button
                  variant="secondary"
                  disabled={isMutating}
                  onClick={() => setConfirmAction('archive-owner')}
                >
                  Archive
                </Button>
              )}

              {isAdmin && !isOwner && (
                <Button
                  variant="secondary"
                  disabled={isMutating}
                  onClick={() => setConfirmAction('archive-admin')}
                >
                  Archive
                </Button>
              )}

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
            <span className="text-caption">Loading images...</span>
          </div>
        )}
        {!imagesLoading && images && images.length > 0 && (
          <ItemGallery
            images={images}
            itemTitle={item.title}
            selectedIndex={selectedImageIndex}
            onSelectIndex={setSelectedImageIndex}
          />
        )}

        {item.description && <p className="text-body mb-4 text-ink-500">{item.description}</p>}
        {item.condition && <p className="text-caption mb-2">Condition: {item.condition}</p>}
        {item.category && <p className="text-caption mb-2">Category: {item.category}</p>}
        {memberPublicArea && (
          <p className="text-caption mb-4">Area: {memberPublicArea}</p>
        )}
        <ItemInterestActions
          itemId={item.id}
          itemStatus={item.status}
          ownerId={item.owner_id}
          userId={user?.id}
          authSettled={settled}
        />
        <ItemOwnerReservation
          itemId={item.id}
          itemStatus={item.status}
          isOwner={isOwner}
        />
        <ItemOwnerArchivedActions
          itemId={item.id}
          itemTitle={item.title}
          itemStatus={item.status}
          isOwner={isOwner}
          archiveKind={archiveKind}
          archiveKindLoading={archiveKindLoading}
        />
        <ItemInterestQueue
          itemId={item.id}
          itemStatus={item.status}
          isOwner={isOwner}
        />
        <div className="text-caption mt-4">
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
            ownerArchiveItem.reset?.()
          }
        }}
        title={
          confirmAction === 'archive-owner' || confirmAction === 'archive-admin'
            ? 'Archive item'
            : 'Delete item'
        }
      >
        <div className="space-y-4">
          {(confirmAction === 'archive-owner' || confirmAction === 'archive-admin') && (
            <p className="text-body text-ink-500">
              Archive <strong className="text-ink-400">"{item.title}"</strong>? It will be
              hidden from the feed and will no longer accept interest.
              {item.status === 'reserved' && (
                <>
                  {' '}
                  Any active reservation will be cancelled.
                </>
              )}
            </p>
          )}
          {(confirmAction === 'delete-owner' || confirmAction === 'delete-admin') && (
            <>
              <p className="text-body text-ink-500">
                Permanently delete{' '}
                <strong className="text-ink-400">"{item.title}"</strong>?
              </p>
              <p className="text-caption text-red-400">
                All images and associated data will be removed. This cannot be undone.
              </p>
            </>
          )}

          {mutationError && (
            <p className="text-caption text-red-400">Error: {mutationError}</p>
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
              variant={
                confirmAction === 'archive-owner' || confirmAction === 'archive-admin'
                  ? 'primary'
                  : 'danger'
              }
              onClick={handleConfirm}
              disabled={isMutating}
            >
              {isMutating
                ? confirmAction === 'archive-owner' || confirmAction === 'archive-admin'
                  ? 'Archiving…'
                  : 'Deleting…'
                : confirmAction === 'archive-owner' || confirmAction === 'archive-admin'
                  ? 'Archive'
                  : 'Delete permanently'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
