import type { QueryClient } from '@tanstack/react-query'

/**
 * Refetch item detail caches after a mutation that changes item metadata,
 * images, or visibility. Item detail uses two query keys depending on role:
 * - Normal client: `itemKeys.one(id)` → `['items', id]`
 * - Admin client:  `adminItemKeys.one(id)` → `['admin-items', 'detail', id]`
 *
 * Always refresh BOTH keys. `invalidateQueries` alone is not enough when
 * `staleTime` is set — prefer `refetchQueries` and await before navigating.
 *
 * Keep key shapes aligned with `features/items/api.ts` and
 * `features/admin-items/api.ts`.
 */
export async function refreshItemDetailCaches(
  qc: QueryClient,
  itemId: string
): Promise<void> {
  await Promise.all([
    qc.refetchQueries({ queryKey: ['items', itemId] }),
    qc.refetchQueries({ queryKey: ['admin-items', 'detail', itemId] }),
    qc.refetchQueries({ queryKey: ['items', itemId, 'images'] }),
    qc.refetchQueries({ queryKey: ['items', itemId, 'visibility-groups'] }),
  ])
  qc.invalidateQueries({ queryKey: ['feed'] })
  qc.invalidateQueries({ queryKey: ['items', itemId, 'archive-kind'] })
}
