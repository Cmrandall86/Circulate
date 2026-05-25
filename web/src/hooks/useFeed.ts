import { useQuery } from '@tanstack/react-query'
import { recoverExpiredReservations } from '@/features/interests/api'
import type { ArchivedItemKind } from '@/features/items/status'
import { supabase } from '../lib/supabaseClient'
import type { Item, ItemImage } from '../lib/types'

export type ItemWithImages = Item & {
  item_images?: (ItemImage & { signed_url?: string })[]
  owner_public_area?: string | null
}

export type ArchivedItemWithImages = ItemWithImages & {
  archiveKind: ArchivedItemKind
}

export const feedKeys = {
  all: ['feed'] as const,
  browse: ['feed', 'browse'] as const,
  ownerReserved: ['feed', 'owner-reserved'] as const,
  ownerArchived: ['feed', 'owner-archived'] as const,
}

async function attachOwnerPublicAreas<T extends { owner_id: string }>(
  items: T[],
): Promise<(T & { owner_public_area?: string | null })[]> {
  const ownerIds = [...new Set(items.map((item) => item.owner_id))]
  if (ownerIds.length === 0) return items

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, public_area')
    .in('id', ownerIds)

  if (error) throw error

  const byOwner = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.public_area as string | null]),
  )

  return items.map((item) => ({
    ...item,
    owner_public_area: byOwner.get(item.owner_id) ?? null,
  }))
}

async function attachFirstImageSignedUrl<T extends ItemWithImages>(item: T): Promise<T> {
  if (item.item_images && item.item_images.length > 0) {
    const sorted = [...item.item_images].sort((a, b) => a.sort_order - b.sort_order)
    const first = sorted[0]
    try {
      const { data: signed } = await supabase.storage
        .from('images')
        .createSignedUrl(first.path, 3600)
      return { ...item, item_images: [{ ...first, signed_url: signed?.signedUrl }] }
    } catch {
      return { ...item, item_images: [first] }
    }
  }
  return item
}

export function useFeed(isMember: boolean) {
  return useQuery({
    queryKey: [...feedKeys.browse, isMember ? 'member' : 'visitor'] as const,
    queryFn: async (): Promise<ItemWithImages[]> => {
      await recoverExpiredReservations()

      const selectFields = isMember
        ? `id, title, description, status, created_at, category, owner_id, approx_location,
          item_images ( id, path, sort_order )`
        : `id, title, description, status, created_at, category, owner_id,
          item_images ( id, path, sort_order )`

      const { data, error } = await supabase
        .from('items')
        .select(selectFields)
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const withImages = await Promise.all(
        (data || []).map(attachFirstImageSignedUrl),
      ) as ItemWithImages[]

      if (!isMember) return withImages

      return attachOwnerPublicAreas(withImages)
    },
  })
}

export function useOwnerReservedFeed(enabled: boolean) {
  return useQuery({
    queryKey: feedKeys.ownerReserved,
    enabled,
    queryFn: async (): Promise<ItemWithImages[]> => {
      await recoverExpiredReservations()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: items, error } = await supabase
        .from('items')
        .select(`
          id, title, description, status, created_at, category, updated_at, owner_id, approx_location,
          item_images ( id, path, sort_order )
        `)
        .eq('owner_id', user.id)
        .eq('status', 'reserved')
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) throw error
      if (!items?.length) return []

      return attachOwnerPublicAreas(
        await Promise.all(
          items.map((item) => attachFirstImageSignedUrl(item as ItemWithImages)),
        ),
      )
    },
  })
}

export function useOwnerArchivedFeed(enabled: boolean) {
  return useQuery({
    queryKey: feedKeys.ownerArchived,
    enabled,
    queryFn: async (): Promise<ArchivedItemWithImages[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select(`
          id, title, description, status, created_at, category, updated_at, owner_id, approx_location,
          item_images ( id, path, sort_order )
        `)
        .eq('owner_id', user.id)
        .eq('status', 'archived')
        .order('updated_at', { ascending: false })
        .limit(50)

      if (itemsError) throw itemsError
      if (!items?.length) return []

      const itemIds = items.map((item) => item.id)
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('item_id')
        .in('item_id', itemIds)
        .eq('status', 'fulfilled')

      if (reservationsError) throw reservationsError

      const handoffCompleteIds = new Set(
        (reservations ?? []).map((row) => row.item_id)
      )

      return attachOwnerPublicAreas(
        await Promise.all(
          items.map(async (item) => {
            const withImage = await attachFirstImageSignedUrl(item as ItemWithImages)
            return {
              ...withImage,
              archiveKind: handoffCompleteIds.has(item.id)
                ? 'handoff_complete'
                : 'removed',
            }
          }),
        ),
      )
    },
  })
}

export function useArchivedItemKind(itemId: string, itemStatus: string, enabled: boolean) {
  return useQuery({
    queryKey: ['items', itemId, 'archive-kind'] as const,
    enabled: enabled && itemStatus === 'archived' && !!itemId,
    queryFn: async (): Promise<ArchivedItemKind> => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id')
        .eq('item_id', itemId)
        .eq('status', 'fulfilled')
        .maybeSingle()

      if (error) throw error
      return data ? 'handoff_complete' : 'removed'
    },
  })
}
