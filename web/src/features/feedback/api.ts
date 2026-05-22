import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Feedback, FeedbackType } from './types'

export const feedbackKeys = {
  all: ['feedback'] as const,
  list: (mode: 'active' | 'handled') => [...feedbackKeys.all, 'list', mode] as const,
}

interface SubmitFeedbackInput {
  user_id: string
  type: FeedbackType
  message: string
  page_url: string
  user_agent: string
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async (input: SubmitFeedbackInput) => {
      const { error } = await supabase.from('feedback').insert(input)
      if (error) throw error
    },
  })
}

export function useFeedbackList(mode: 'active' | 'handled') {
  const statusFilter = mode === 'active' ? ['new'] : ['completed', 'archived']
  return useQuery({
    queryKey: feedbackKeys.list(mode),
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .in('status', statusFilter)
        .order('created_at', { ascending: false })
      if (error) throw error

      const rows = (data ?? []) as Feedback[]

      // Enrich with display_name from profiles.
      // feedback.user_id == profiles.id (both reference auth.users.id).
      const userIds = [...new Set(rows.flatMap(r => (r.user_id ? [r.user_id] : [])))]
      if (userIds.length === 0) return rows

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)

      const nameMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

      return rows.map(r => ({
        ...r,
        display_name: r.user_id ? (nameMap.get(r.user_id) ?? null) : null,
      }))
    },
  })
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'completed' | 'archived' }) => {
      const { error } = await supabase
        .from('feedback')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all })
    },
  })
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from('feedback')
        .delete({ count: 'exact' })
        .eq('id', id)
      if (error) throw error
      if (count === 0) throw new Error('Delete was blocked — check that the admin delete policy is applied in Supabase.')
    },
    onSuccess: (_data, id) => {
      // Immediately remove the deleted row from the handled view cache so the
      // table updates without waiting for the background refetch.
      queryClient.setQueryData<Feedback[]>(feedbackKeys.list('handled'), (old) =>
        (old ?? []).filter((item) => item.id !== id)
      )
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all })
    },
  })
}
