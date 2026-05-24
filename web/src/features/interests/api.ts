import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAvatarDisplayUrl } from '@/lib/avatar'
import { supabase } from '@/lib/supabaseClient'
import type { Interest, InterestLevel, InterestQueueEntry } from '@/lib/types'

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

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds)

      if (profilesError) throw profilesError

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [profile.id, profile])
      )

      return Promise.all(
        sorted.map(async (row) => {
          const profile = profileMap.get(row.user_id)
          const avatar_display_url = await getAvatarDisplayUrl(profile?.avatar_url)

          return {
            ...row,
            display_name: profile?.display_name ?? null,
            avatar_display_url,
          }
        })
      )
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
      qc.invalidateQueries({ queryKey: interestKeys.mine(itemId) })
      qc.invalidateQueries({ queryKey: interestKeys.queue(itemId) })
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
      qc.invalidateQueries({ queryKey: interestKeys.mine(itemId) })
      qc.invalidateQueries({ queryKey: interestKeys.queue(itemId) })
    },
  })
}
