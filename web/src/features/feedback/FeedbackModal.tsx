import { useState } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useSubmitFeedback } from './api'
import { FEEDBACK_TYPE_LABELS, type FeedbackType } from './types'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

const FEEDBACK_TYPES = Object.entries(FEEDBACK_TYPE_LABELS) as [FeedbackType, string][]

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { user } = useAuth()
  const submitFeedback = useSubmitFeedback()
  const [type, setType] = useState<FeedbackType>('general')
  const [message, setMessage] = useState('')

  const handleClose = () => {
    setType('general')
    setMessage('')
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    submitFeedback.mutate(
      {
        user_id: user.id,
        type,
        message,
        page_url: window.location.pathname + window.location.search,
        user_agent: navigator.userAgent,
      },
      {
        onSuccess: () => {
          toast.success('Feedback submitted — thank you!')
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to submit feedback')
        },
      }
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Feedback">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-ink-500 mb-2">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FeedbackType)}
            className="w-full px-4 py-2 bg-base-700 border border-base-600 rounded-2xl text-ink-400 focus:outline-none focus:ring-2 focus:ring-mint-400"
            required
          >
            {FEEDBACK_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-ink-500 mb-2">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            placeholder="Describe the issue, idea, or question…"
            className="w-full px-4 py-2 bg-base-700 border border-base-600 rounded-2xl text-ink-400 focus:outline-none focus:ring-2 focus:ring-mint-400 resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" className="btn-accent" disabled={submitFeedback.isPending}>
            {submitFeedback.isPending ? 'Sending…' : 'Send Feedback'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
