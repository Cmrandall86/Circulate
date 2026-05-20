import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { useFeedbackList, useUpdateFeedbackStatus } from '@/features/feedback/api'
import { FEEDBACK_TYPE_LABELS, type Feedback, type FeedbackType } from '@/features/feedback/types'

function typeBadgeVariant(type: FeedbackType): 'error' | 'warning' | 'default' {
  if (type === 'bug') return 'error'
  if (type === 'feature_request') return 'warning'
  return 'default'
}

function statusBadgeVariant(status: Feedback['status']): 'success' | 'default' {
  return status === 'completed' ? 'success' : 'default'
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
  onComplete,
  onArchive,
  loading,
  variant,
}: {
  item: Feedback
  onComplete: (id: string) => void
  onArchive: (id: string) => void
  loading: boolean
  variant: 'table' | 'card'
}) {
  const btnClass = variant === 'card' ? 'min-h-11 w-full' : ''

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
  if (item.status === 'completed') {
    return (
      <Button
        type="button"
        variant={variant === 'card' ? 'secondary' : 'ghost'}
        className={btnClass}
        disabled={loading}
        onClick={() => onArchive(item.id)}
      >
        Archive
      </Button>
    )
  }
  return null
}

function FeedbackMobileCard({
  item,
  onComplete,
  onArchive,
  loading,
}: {
  item: Feedback
  onComplete: (id: string) => void
  onArchive: (id: string) => void
  loading: boolean
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={typeBadgeVariant(item.type)}>
          {FEEDBACK_TYPE_LABELS[item.type]}
        </Badge>
        <Badge variant={statusBadgeVariant(item.status)}>
          {item.status === 'new' ? 'New' : 'Completed'}
        </Badge>
      </div>
      <p className="text-ink-400 text-sm">{item.message}</p>
      <div className="text-xs text-ink-600 space-y-1">
        {item.page_url && <p>Page: {item.page_url}</p>}
        <p className="font-mono">User: {shortUserId(item.user_id)}</p>
        <p>{new Date(item.created_at).toLocaleDateString()}</p>
      </div>
      <FeedbackActions
        item={item}
        onComplete={onComplete}
        onArchive={onArchive}
        loading={loading}
        variant="card"
      />
    </Card>
  )
}

export function AdminFeedbackContent() {
  const { data, isLoading, error } = useFeedbackList()
  const updateStatus = useUpdateFeedbackStatus()
  const items: Feedback[] = data ?? []

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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-400">Feedback</h1>
        <p className="text-sm text-ink-600 mt-1">
          Showing new and completed feedback. Archived entries are hidden.
        </p>
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
            <div className="py-8 text-center text-ink-600">No feedback yet</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {items.map((item) => (
                  <FeedbackMobileCard
                    key={item.id}
                    item={item}
                    onComplete={(id) => handleAction(id, 'completed')}
                    onArchive={(id) => handleAction(id, 'archived')}
                    loading={updateStatus.isPending}
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
                        <td className="px-4 py-3 text-ink-600 text-sm font-mono">
                          {shortUserId(item.user_id)}
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
                            {item.status === 'new' ? 'New' : 'Completed'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <FeedbackActions
                            item={item}
                            onComplete={(id) => handleAction(id, 'completed')}
                            onArchive={(id) => handleAction(id, 'archived')}
                            loading={updateStatus.isPending}
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
    </div>
  )
}

export default function AdminFeedback() {
  return <AdminFeedbackContent />
}
