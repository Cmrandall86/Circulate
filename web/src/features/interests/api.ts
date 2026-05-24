import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminItemKeys, type AdminItemDetail } from '@/features/admin-items/api'
import { itemKeys } from '@/features/items/api'
import { getAvatarDisplayUrl } from '@/lib/avatar'
import { supabase } from '@/lib/supabaseClient'
import type { Interest, InterestLevel, InterestQueueEntry, Item, ItemStatus, OwnerReservation, Reservation } from '@/lib/types'

export const INTEREST_LEVELS: Record<InterestLevel, string> = {
  need: 'I need this',
  like: "I'd like this",
  take: 'I can take it',
}

export const INTEREST_LEVEL_ORDER: InterestLevel[] = ['need', 'like', 'take']

const INTEREST_LEVEL_RANK: Record<InterestLevel, number> = {
  need: 0,
  like: 1,
  take: 2,
}

export function sortInterestQueue(entries: Interest[]): Interest[] {
  return [...entries].sort((a, b) => {
    const rankDiff = INTEREST_LEVEL_RANK[a.state] - INTEREST_LEVEL_RANK[b.state]
    if (rankDiff !== 0) return rankDiff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export const interestKeys = {
  all: ['interests'] as const,
  mine: (itemId: string) => [...interestKeys.all, 'mine', itemId] as const,
  queue: (itemId: string) => [...interestKeys.all, 'queue', itemId] as const,
  ownerIndicators: ['interests', 'owner-indicators'] as const,
}

export type OwnerInterestIndicator = {
  item_id: string
  interest_count: number
  has_unread: boolean
}

export const reservationKeys = {
  all: ['reservations'] as const,
  active: (itemId: string) => [...reservationKeys.all, 'active', itemId] as const,
  ownerActive: (itemId: string) => [...reservationKeys.all, 'owner-active', itemId] as const,
}

export async function recoverExpiredReservations(): Promise<void> {
  const { error } = await supabase.rpc('recover_expired_reservations')
  if (error) throw error
}

function patchCachedItemStatus(
  qc: ReturnType<typeof useQueryClient>,
  itemId: string,
  status: ItemStatus
) {
  qc.setQueryData<Item & { item_visibility_groups?: unknown[] }>(
    itemKeys.one(itemId),
    (old) => (old ? { ...old, status } : old)
  )

  qc.setQueryData<AdminItemDetail>(
    adminItemKeys.one(itemId),
    (old) => (old ? { ...old, item: { ...old.item, status } } : old)
  )
}

async function invalidateItemHandoffQueries(
  qc: ReturnType<typeof useQueryClient>,
  itemId: string
) {
  await Promise.all([
    qc.refetchQueries({ queryKey: itemKeys.one(itemId) }),
    qc.refetchQueries({ queryKey: adminItemKeys.one(itemId) }),
  ])
  qc.invalidateQueries({ queryKey: interestKeys.mine(itemId) })
  qc.invalidateQueries({ queryKey: interestKeys.queue(itemId) })
  qc.invalidateQueries({ queryKey: reservationKeys.active(itemId) })
  qc.invalidateQueries({ queryKey: reservationKeys.ownerActive(itemId) })
  qc.invalidateQueries({ queryKey: interestKeys.ownerIndicators })
  qc.invalidateQueries({ queryKey: ['feed'] })
}

export function useItemInterestQueue(itemId: string, enabled: boolean) {
  return useQuery({
    queryKey: interestKeys.queue(itemId),
    enabled: enabled && !!itemId,
    queryFn: async (): Promise<InterestQueueEntry[]> => {
      const { data: interests, error: interestsError } = await supabase
        .from('interests')
        .select('id, item_id, user_id, state, created_at')
        .eq('item_id', itemId)

      if (interestsError) throw interestsError
      if (!interests?.length) return []

      const sorted = sortInterestQueue(interests as Interest[])
      const userIds = sorted.map((row) => row.user_id)

      const [{ data: item, error: itemError }, { data: profiles, error: profilesError }] =
        await Promise.all([
          supabase.from('items').select('owner_id').eq('id', itemId).single(),
          supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', userIds),
        ])

      if (itemError) throw itemError
      if (profilesError) throw profilesError

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [profile.id, profile])
      )

      const mutualGroupsByUserId = new Map<string, string[]>()

      const { data: ownerMemberships, error: ownerMembershipsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', item.owner_id)

      if (ownerMembershipsError) throw ownerMembershipsError

      const ownerGroupIds = (ownerMemberships ?? []).map((row) => row.group_id)

      if (ownerGroupIds.length > 0) {
        const { data: sharedMemberships, error: sharedMembershipsError } = await supabase
          .from('group_members')
          .select('user_id, groups(name)')
          .in('group_id', ownerGroupIds)
          .in('user_id', userIds)

        if (sharedMembershipsError) throw sharedMembershipsError

        for (const row of sharedMemberships ?? []) {
          const groupName = (row.groups as { name: string } | null)?.name
          if (!groupName) continue

          const existing = mutualGroupsByUserId.get(row.user_id) ?? []
          if (!existing.includes(groupName)) {
            mutualGroupsByUserId.set(row.user_id, [...existing, groupName])
          }
        }

        for (const [userId, names] of mutualGroupsByUserId) {
          mutualGroupsByUserId.set(
            userId,
            [...names].sort((a, b) => a.localeCompare(b))
          )
        }
      }

      return Promise.all(
        sorted.map(async (row) => {
          const profile = profileMap.get(row.user_id)
          const avatar_display_url = await getAvatarDisplayUrl(profile?.avatar_url)

          return {
            ...row,
            display_name: profile?.display_name ?? null,
            avatar_display_url,
            mutual_group_names: mutualGroupsByUserId.get(row.user_id) ?? [],
          }
        })
      )
    },
  })
}

export function useOwnerInterestIndicators(enabled: boolean) {
  return useQuery({
    queryKey: interestKeys.ownerIndicators,
    enabled,
    staleTime: 0,
    queryFn: async (): Promise<OwnerInterestIndicator[]> => {
      const { data, error } = await supabase.rpc('get_owner_interest_indicators')
      if (error) throw error
      return (data ?? []) as OwnerInterestIndicator[]
    },
  })
}

export function useMarkItemInterestsViewed(itemId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('mark_item_interests_viewed', {
        p_item_id: itemId,
      })

      if (error) throw error
      return data as Item
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interestKeys.ownerIndicators })
    },
  })
}

export function useMyInterest(itemId: string, enabled: boolean) {
  return useQuery({
    queryKey: interestKeys.mine(itemId),
    enabled: enabled && !!itemId,
    queryFn: async (): Promise<Interest | null> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('interests')
        .select('id, item_id, user_id, state, created_at')
        .eq('item_id', itemId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      return data as Interest | null
    },
  })
}

export function useSetInterest(itemId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (level: InterestLevel) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('interests')
        .upsert(
          {
            item_id: itemId,
            user_id: user.id,
            state: level,
          },
          { onConflict: 'item_id,user_id' }
        )
        .select('id, item_id, user_id, state, created_at')
        .single()

      if (error) throw error
      return data as Interest
    },
    onSuccess: () => {
      void invalidateItemHandoffQueries(qc, itemId)
    },
  })
}

export function useActiveReservation(itemId: string, enabled: boolean) {
  return useQuery({
    queryKey: reservationKeys.active(itemId),
    enabled: enabled && !!itemId,
    queryFn: async (): Promise<Reservation | null> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('reservations')
        .select('id, item_id, claimer_id, reserved_at, expires_at, status')
        .eq('item_id', itemId)
        .eq('status', 'active')
        .maybeSingle()

      if (error) throw error
      if (!data || data.claimer_id !== user.id) return null
      return data as Reservation
    },
  })
}

export function useOwnerActiveReservation(itemId: string, enabled: boolean) {
  return useQuery({
    queryKey: reservationKeys.ownerActive(itemId),
    enabled: enabled && !!itemId,
    queryFn: async (): Promise<OwnerReservation | null> => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, item_id, claimer_id, reserved_at, expires_at, status')
        .eq('item_id', itemId)
        .eq('status', 'active')
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', data.claimer_id)
        .maybeSingle()

      if (profileError) throw profileError

      return {
        ...(data as Reservation),
        claimer_display_name: profile?.display_name ?? null,
      }
    },
  })
}

export type ReservationExpiryPreset = '2d' | '7d' | '14d' | 'none' | 'custom'

export type CreateReservationInput = {
  claimerId: string
  expiresAt: string | null
}

export const RESERVATION_EXPIRY_PRESETS: {
  id: ReservationExpiryPreset
  label: string
  description: string
}[] = [
  { id: '2d', label: '2 days', description: 'Quick pickup' },
  { id: '7d', label: '7 days', description: 'Default' },
  { id: '14d', label: '14 days', description: 'Flexible' },
  { id: 'none', label: 'No expiry', description: 'Trusted handoff' },
  { id: 'custom', label: 'Custom', description: 'Pick a date (max 30 days)' },
]

const DAY_MS = 24 * 60 * 60 * 1000

export function maxCustomExpiryDate(): Date {
  return new Date(Date.now() + 30 * DAY_MS)
}

export function minCustomExpiryDate(): Date {
  return new Date(Date.now() + 60 * 60 * 1000)
}

export function computePresetExpiresAt(preset: ReservationExpiryPreset): string | null {
  const now = Date.now()
  switch (preset) {
    case '2d':
      return new Date(now + 2 * DAY_MS).toISOString()
    case '7d':
      return new Date(now + 7 * DAY_MS).toISOString()
    case '14d':
      return new Date(now + 14 * DAY_MS).toISOString()
    case 'none':
      return null
    default:
      return new Date(now + 7 * DAY_MS).toISOString()
  }
}

export function resolveReservationExpiresAt(
  preset: ReservationExpiryPreset,
  customDateTime: string
): string | null {
  if (preset === 'none') return null
  if (preset === 'custom') {
    if (!customDateTime.trim()) {
      throw new Error('Choose a custom pickup deadline')
    }
    const parsed = new Date(customDateTime)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Invalid custom date')
    }
    if (parsed.getTime() <= Date.now()) {
      throw new Error('Custom deadline must be in the future')
    }
    if (parsed.getTime() > maxCustomExpiryDate().getTime()) {
      throw new Error('Custom deadline cannot be more than 30 days from now')
    }
    return parsed.toISOString()
  }
  return computePresetExpiresAt(preset)
}

export function formatReservationExpiryLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'No pickup deadline'
  return new Date(expiresAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function useCreateReservation(itemId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ claimerId, expiresAt }: CreateReservationInput) => {
      const { data, error } = await supabase.rpc('create_item_reservation', {
        p_item_id: itemId,
        p_claimer_id: claimerId,
        p_expires_at: expiresAt,
      })

      if (error) throw error
      return data as Reservation
    },
    onSuccess: async () => {
      patchCachedItemStatus(qc, itemId, 'reserved')
      await invalidateItemHandoffQueries(qc, itemId)
    },
  })
}

export function useCancelReservation(itemId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('cancel_item_reservation', {
        p_item_id: itemId,
      })

      if (error) throw error
      return data as Reservation
    },
    onSuccess: async () => {
      patchCachedItemStatus(qc, itemId, 'available')
      await invalidateItemHandoffQueries(qc, itemId)
    },
  })
}

export function useMarkItemClaimed(itemId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('mark_item_claimed', {
        p_item_id: itemId,
      })

      if (error) throw error
      return data as Item
    },
    onSuccess: async () => {
      patchCachedItemStatus(qc, itemId, 'archived')
      await invalidateItemHandoffQueries(qc, itemId)
    },
  })
}

export function useOwnerArchiveItem(itemId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('archive_item', {
        p_item_id: itemId,
      })

      if (error) throw error
      return data as Item
    },
    onSuccess: async () => {
      patchCachedItemStatus(qc, itemId, 'archived')
      await invalidateItemHandoffQueries(qc, itemId)
    },
  })
}

export function useReactivateItem(itemId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('reactivate_item', {
        p_item_id: itemId,
      })

      if (error) throw error
      return data as Item
    },
    onSuccess: async () => {
      patchCachedItemStatus(qc, itemId, 'available')
      qc.invalidateQueries({ queryKey: ['items', itemId, 'archive-kind'] })
      await invalidateItemHandoffQueries(qc, itemId)
    },
  })
}

export function useWithdrawInterest(itemId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('interests')
        .delete()
        .eq('item_id', itemId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      void invalidateItemHandoffQueries(qc, itemId)
    },
  })
}
