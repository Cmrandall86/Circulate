import { useQuery } from '@tanstack/react-query'
import { recoverExpiredReservations } from '@/features/interests/api'
import type { ArchivedItemKind } from '@/features/items/status'
import { supabase } from '../lib/supabaseClient'
import type { Item, ItemImage } from '../lib/types'

export type ItemWithImages = Item & {
  item_images?: (ItemImage & { signed_url?: string })[]
}

export type ArchivedItemWithImages = ItemWithImages & {
  archiveKind: ArchivedItemKind
}

export const feedKeys = {
  all: ['feed'] as const,
  browse: ['feed', 'browse'] as const,
  ownerArchived: ['feed', 'owner-archived'] as const,
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

export function useFeed() {
  return useQuery({
    queryKey: feedKeys.browse,
    queryFn: async (): Promise<ItemWithImages[]> => {
      await recoverExpiredReservations()

      const { data, error } = await supabase
        .from('items')
        .select(`
          id, title, description, status, created_at, category, owner_id,
          item_images ( id, path, sort_order )
        `)
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      return Promise.all((data || []).map(attachFirstImageSignedUrl)) as Promise<ItemWithImages[]>
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
          id, title, description, status, created_at, category, updated_at,
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

      return Promise.all(
        items.map(async (item) => {
          const withImage = await attachFirstImageSignedUrl(item as ItemWithImages)
          return {
            ...withImage,
            archiveKind: handoffCompleteIds.has(item.id)
              ? 'handoff_complete'
              : 'removed',
          }
        })
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
