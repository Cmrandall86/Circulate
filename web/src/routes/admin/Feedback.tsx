import { useState } from 'react'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import {
  useFeedbackList,
  useUpdateFeedbackStatus,
  useDeleteFeedback,
} from '@/features/feedback/api'
import { FEEDBACK_TYPE_LABELS, type Feedback, type FeedbackType } from '@/features/feedback/types'

type ViewMode = 'active' | 'handled'

function typeBadgeVariant(type: FeedbackType): 'error' | 'warning' | 'default' {
  if (type === 'bug') return 'error'
  if (type === 'feature_request') return 'warning'
  return 'default'
}

function statusBadgeVariant(status: Feedback['status']): 'success' | 'warning' | 'default' {
  if (status === 'completed') return 'success'
  if (status === 'archived') return 'warning'
  return 'default'
}

function statusLabel(status: Feedback['status']): string {
  if (status === 'new') return 'New'
  if (status === 'completed') return 'Completed'
  return 'Archived'
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

function shortUserId(id: string | null): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

function FeedbackActions({
  item,
  viewMode,
  onComplete,
  onArchive,
  onDeleteRequest,
  loading,
  variant,
}: {
  item: Feedback
  viewMode: ViewMode
  onComplete: (id: string) => void
  onArchive: (id: string) => void
  onDeleteRequest: (id: string) => void
  loading: boolean
  variant: 'table' | 'card'
}) {
  const btnClass = variant === 'card' ? 'min-h-11 w-full' : ''

  if (viewMode === 'active') {
    if (item.status === 'new') {
      return (
        <Button
          type="button"
          variant={variant === 'card' ? 'secondary' : 'ghost'}
          className={btnClass}
          disabled={loading}
          onClick={() => onComplete(item.id)}
        >
          Mark Completed
        </Button>
      )
    }
    return null
  }

  // Handled view
  return (
    <div className={variant === 'card' ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>
      {item.status === 'completed' && (
        <Button
          type="button"
          variant={variant === 'card' ? 'secondary' : 'ghost'}
          className={btnClass}
          disabled={loading}
          onClick={() => onArchive(item.id)}
        >
          Archive
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        className={`text-red-400 hover:text-red-300 ${btnClass}`}
        disabled={loading}
        onClick={() => onDeleteRequest(item.id)}
      >
        Delete
      </Button>
    </div>
  )
}

function FeedbackMobileCard({
  item,
  viewMode,
  onComplete,
  onArchive,
  onDeleteRequest,
  loading,
}: {
  item: Feedback
  viewMode: ViewMode
  onComplete: (id: string) => void
  onArchive: (id: string) => void
  onDeleteRequest: (id: string) => void
  loading: boolean
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={typeBadgeVariant(item.type)}>
          {FEEDBACK_TYPE_LABELS[item.type]}
        </Badge>
        <Badge variant={statusBadgeVariant(item.status)}>
          {statusLabel(item.status)}
        </Badge>
      </div>
      <p className="text-ink-400 text-sm">{item.message}</p>
      <div className="text-xs text-ink-600 space-y-1">
        {item.page_url && <p>Page: {item.page_url}</p>}
        <p>User: {item.display_name ?? shortUserId(item.user_id)}</p>
        <p>{new Date(item.created_at).toLocaleDateString()}</p>
      </div>
      <FeedbackActions
        item={item}
        viewMode={viewMode}
        onComplete={onComplete}
        onArchive={onArchive}
        onDeleteRequest={onDeleteRequest}
        loading={loading}
        variant="card"
      />
    </Card>
  )
}

export function AdminFeedbackContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('active')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data, isLoading, error } = useFeedbackList(viewMode)
  const updateStatus = useUpdateFeedbackStatus()
  const deleteFeedback = useDeleteFeedback()

  const items: Feedback[] = data ?? []
  const mutating = updateStatus.isPending || deleteFeedback.isPending

  const handleAction = (id: string, status: 'completed' | 'archived') => {
    const label = status === 'completed' ? 'marked as completed' : 'archived'
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Feedback ${label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Update failed'),
      }
    )
  }

  const handleDeleteConfirm = () => {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    deleteFeedback.mutate(id, {
      onSuccess: () => toast.success('Feedback deleted'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Delete failed'),
    })
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header + view toggle */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-400">Feedback</h1>
          <p className="text-sm text-ink-600 mt-1">
            {viewMode === 'active'
              ? 'Showing new feedback that needs attention.'
              : 'Showing completed and archived feedback.'}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setViewMode(viewMode === 'active' ? 'handled' : 'active')}
        >
          {viewMode === 'active' ? 'View archived feedback' : 'Back to active feedback'}
        </Button>
      </div>

      {isLoading && <div className="text-ink-500">Loading feedback…</div>}
      {error && (
        <div className="text-red-400 mb-4">
          Error: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {!isLoading && !error && (
        <>
          {items.length === 0 ? (
            <div className="py-8 text-center text-ink-600">
              {viewMode === 'active' ? 'No new feedback' : 'No archived feedback'}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {items.map((item) => (
                  <FeedbackMobileCard
                    key={item.id}
                    item={item}
                    viewMode={viewMode}
                    onComplete={(id) => handleAction(id, 'completed')}
                    onArchive={(id) => handleAction(id, 'archived')}
                    onDeleteRequest={setConfirmDeleteId}
                    loading={mutating}
                  />
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-base-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Type</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Message</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">User</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Page</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Date</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-base-700 hover:bg-base-700/50">
                        <td className="px-4 py-3">
                          <Badge variant={typeBadgeVariant(item.type)}>
                            {FEEDBACK_TYPE_LABELS[item.type]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <span className="text-ink-400 text-sm">{truncate(item.message, 80)}</span>
                        </td>
                        <td className="px-4 py-3 text-ink-600 text-sm">
                          {item.display_name ?? shortUserId(item.user_id)}
                        </td>
                        <td className="px-4 py-3 max-w-[10rem]">
                          <span className="block truncate text-sm text-ink-600">
                            {truncate(item.page_url, 40)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-600 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusBadgeVariant(item.status)}>
                            {statusLabel(item.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <FeedbackActions
                            item={item}
                            viewMode={viewMode}
                            onComplete={(id) => handleAction(id, 'completed')}
                            onArchive={(id) => handleAction(id, 'archived')}
                            onDeleteRequest={setConfirmDeleteId}
                            loading={mutating}
                            variant="table"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete feedback"
      >
        <p className="text-ink-400 mb-6">
          Permanently delete this feedback entry? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmDeleteId(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="bg-red-600 hover:bg-red-500 border-red-600 hover:border-red-500"
            disabled={deleteFeedback.isPending}
            onClick={handleDeleteConfirm}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default function AdminFeedback() {
  return <AdminFeedbackContent />
}
