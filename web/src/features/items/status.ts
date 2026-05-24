export type ItemStatus = 'available' | 'reserved' | 'claimed' | 'archived'

export type ArchivedItemKind = 'handoff_complete' | 'removed'

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

export function archivedItemLabel(kind: ArchivedItemKind): string {
  return kind === 'handoff_complete' ? 'Handoff complete' : 'Removed'
}

export function itemStatusBadgeVariant(
  status: string
): 'success' | 'warning' | 'default' {
  if (status === 'available') return 'success'
  if (status === 'reserved') return 'warning'
  return 'default'
}

export function archivedItemBadgeVariant(
  kind: ArchivedItemKind
): 'success' | 'default' {
  return kind === 'handoff_complete' ? 'success' : 'default'
}

/** Archived items with a fulfilled reservation are locked; removed archives stay editable. */
export function canEditItem(
  status: string,
  archiveKind?: ArchivedItemKind
): boolean {
  if (status !== 'archived') return true
  return archiveKind === 'removed'
}
