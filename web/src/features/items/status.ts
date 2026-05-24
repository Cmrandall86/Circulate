export type ItemStatus = 'available' | 'reserved' | 'claimed' | 'archived'

const LABELS: Record<ItemStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  claimed: 'Claimed',
  archived: 'Archived',
}

export function itemStatusLabel(status: string): string {
  if (status in LABELS) return LABELS[status as ItemStatus]
  return status
}

export function itemStatusBadgeVariant(
  status: string
): 'success' | 'warning' | 'default' {
  if (status === 'available') return 'success'
  if (status === 'reserved') return 'warning'
  return 'default'
}
