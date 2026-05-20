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
      // Generated types reflect the DB column type (string); cast to the
      // narrower Feedback interface whose type/status fields mirror the
      // check constraints enforced at the database level.
      return (data ?? []) as Feedback[]
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
