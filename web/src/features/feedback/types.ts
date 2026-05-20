export type FeedbackType = 'bug' | 'feature_request' | 'question' | 'general'

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature_request: 'Feature request',
  question: 'Question',
  general: 'General feedback',
}

export interface Feedback {
  id: string
  user_id: string | null
  type: FeedbackType
  message: string
  page_url: string | null
  user_agent: string | null
  status: 'new' | 'completed' | 'archived'
  created_at: string
}
