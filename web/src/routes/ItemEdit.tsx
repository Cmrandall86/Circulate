import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import ItemForm from '@/features/items/ItemForm'
import type { Item } from '@/lib/types'
import { useAdminItem, useAdminUpdateItem } from '@/features/admin-items/api'
import { itemKeys } from '@/features/items/api'
import { canEditItem } from '@/features/items/status'
import { useArchivedItemKind } from '@/hooks/useFeed'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import type { ItemFormData } from '@/features/items/types'

export default function ItemEdit() {
  const { id } = useParams({ from: '/item/$id/edit' })
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { data: role, isLoading: roleLoading } = useRole()

  const isAdmin = role === 'admin'

  // Wait for auth + role to settle before enabling either fetch
  const settled = !authLoading && (!user || !roleLoading)
  const adminQueryEnabled = settled && isAdmin
  const normalQueryEnabled = settled && !isAdmin

  // Admin fetch — bypasses RLS via Edge Function
  const adminItemQuery = useAdminItem(id, { enabled: adminQueryEnabled })

  // Normal fetch — subject to RLS
  const normalItemQuery = useQuery({
    queryKey: itemKeys.one(id),
    enabled: normalQueryEnabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('items').select('*').eq('id', id).single()
      if (error) throw error
      return data as Item
    },
  })

  const adminUpdateItem = useAdminUpdateItem()

  const item = isAdmin ? adminItemQuery.data?.item : normalItemQuery.data
  const isLoading = isAdmin ? adminItemQuery.isLoading : normalItemQuery.isLoading
  const error = isAdmin ? adminItemQuery.error : normalItemQuery.error

  const { data: archiveKind, isLoading: archiveKindLoading } = useArchivedItemKind(
    id,
    item?.status ?? '',
    settled && !!item && item.status === 'archived'
  )

  if (!settled || isLoading || (!!item && item.status === 'archived' && archiveKindLoading)) {
    return (
      <div className="max-w-5xl mx-auto py-6">
        <div className="text-ink-500">Loading...</div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="max-w-5xl mx-auto py-6">
        <div className="text-red-500">
          Error loading item: {(error as Error | null)?.message ?? 'Item not found'}
        </div>
      </div>
    )
  }

  const isOwner = !!user && item.owner_id === user.id
  const isAdminEdit = isAdmin && !isOwner

  // Non-admin, non-owner: deny access
  if (!isOwner && !isAdmin) {
    return (
      <div className="max-w-5xl mx-auto py-6">
        <div className="card p-6">
          <p className="text-ink-500">You do not have permission to edit this item.</p>
          <button
            className="mt-4 text-mint-400 underline text-sm"
            onClick={() => navigate({ to: `/item/${id}` })}
          >
            Back to item
          </button>
        </div>
      </div>
    )
  }

  if (!canEditItem(item.status, archiveKind)) {
    return (
      <div className="max-w-5xl mx-auto py-6">
        <div className="card p-6">
          <p className="text-ink-500">
            This item is locked because the handoff is complete. Completed giveaways
            cannot be edited.
          </p>
          <button
            className="mt-4 text-mint-400 underline text-sm"
            onClick={() => navigate({ to: `/item/${id}` })}
          >
            Back to item
          </button>
        </div>
      </div>
    )
  }

  /**
   * When an admin is editing another user's item, route the save through the Edge
   * Function (service-role) so that RLS does not block the UPDATE.
   */
  async function handleAdminUpdate(data: ItemFormData): Promise<{ id: string }> {
    const result = await adminUpdateItem.mutateAsync({ id, data })
    return { id: result.id }
  }

  return (
    <div className="max-w-5xl mx-auto py-6">
      <ItemForm
        itemId={id}
        item={item}
        isAdminEdit={isAdminEdit}
        onUpdate={isAdminEdit ? handleAdminUpdate : undefined}
        ownerPublicArea={
          isAdminEdit ? adminItemQuery.data?.item.owner_public_area ?? null : undefined
        }
      />
    </div>
  )
}
