import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { refreshItemDetailCaches } from '@/lib/itemQueryCache'
import type { Item } from '@/lib/types'
import type { ItemFormData, ItemImageWithUrl, ItemVisibilityGroup } from '@/features/items/types'
import { itemKeys } from '@/features/items/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminItemDetail {
  item: Item & {
    display_name: string | null
    owner_public_area: string | null
    item_visibility_groups: ItemVisibilityGroup[]
  }
  images: ItemImageWithUrl[]
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const adminItemKeys = {
  all: ['admin-items'] as const,
  one: (id: string) => [...adminItemKeys.all, 'detail', id] as const,
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function getAdminToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

function adminEdgeFnBase(): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-items`
}

function adminRequestHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    'content-type': 'application/json',
  }
}

async function edgeFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAdminToken()
  const res = await fetch(`${adminEdgeFnBase()}${path}`, {
    ...init,
    headers: { ...adminRequestHeaders(token), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (res.status === 401) throw new Error('Unauthorized')
    if (res.status === 403) throw new Error(`Forbidden: ${err.details ?? err.error ?? 'admin only'}`)
    throw new Error(err.error ?? `Request failed: ${res.status}`)
  }
  return res
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetch a single item by ID via the Edge Function (bypasses RLS).
 * Use when the current user is an admin viewing any item.
 */
export function useAdminItem(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: adminItemKeys.one(id),
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<AdminItemDetail> => {
      const res = await edgeFetch(`/${id}`)
      return res.json()
    },
  })
}

/** Archive an item (set status = 'archived') via the Edge Function. */
export function useAdminArchiveItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await edgeFetch(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'archive' }),
      })
      return res.json()
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: adminItemKeys.one(id) })
      qc.invalidateQueries({ queryKey: adminItemKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.one(id) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

/**
 * Update item metadata and visibility groups via the Edge Function.
 * Used when an admin edits an item they do not own (RLS would block the normal update path).
 */
export function useAdminUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ItemFormData }) => {
      const res = await edgeFetch(`/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'update', ...data }),
      })
      return res.json() as Promise<{ ok: boolean; id: string }>
    },
    onSuccess: async (_result, { id }) => {
      await refreshItemDetailCaches(qc, id)
    },
  })
}

/** Hard-delete an item (storage + related rows + item row) via the Edge Function. */
export function useAdminDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await edgeFetch(`/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: adminItemKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.one(id) })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
