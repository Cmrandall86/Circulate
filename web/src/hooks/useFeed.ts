import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Item, ItemImage } from '../lib/types'

type ItemWithImages = Item & {
  item_images?: (ItemImage & { signed_url?: string })[]
}

export function useFeed() {
  return useQuery({
    queryKey: ['feed'] as const,
    queryFn: async (): Promise<ItemWithImages[]> => {
      const { data, error } = await supabase
        .from('items')
        .select(`
          id, title, description, status, created_at, category,
          item_images ( id, path, sort_order )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Generate a signed URL for the first image of each item
      return Promise.all(
        (data || []).map(async (item) => {
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
        })
      ) as Promise<ItemWithImages[]>
    },
  })
}
