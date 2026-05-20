import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Feedback, FeedbackType } from './types'

export const feedbackKeys = {
  all: ['feedback'] as const,
  list: () => [...feedbackKeys.all, 'list'] as const,
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

export function useFeedbackList() {
  return useQuery({
    queryKey: feedbackKeys.list(),
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .in('status', ['new', 'completed'])
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
      queryClient.invalidateQueries({ queryKey: feedbackKeys.list() })
    },
  })
}
