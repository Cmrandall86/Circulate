import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { useGroup, useGroupMembers, useLeaveGroup, useRemoveMember, useUpdateMemberRole } from '../api'
import { supabase } from '@/lib/supabaseClient'
import type { Role } from '../types'

export default function GroupMembersPanel({ groupId }: { groupId: string }) {
  const { data: group } = useGroup(groupId)
  const { data: members } = useGroupMembers(groupId)
  const leave = useLeaveGroup(groupId)
  const remove = useRemoveMember(groupId)
  const updateRole = useUpdateMemberRole(groupId)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setMyUserId(user?.id ?? null)
    })
  }, [])

  const myMembership = members?.find(m => m.user_id === myUserId)
  const amOwner = myMembership?.role === 'owner'
  const amMember = !!myMembership

  const handleLeave = async () => {
    try {
      await leave.mutateAsync()
    } catch (err: any) {
      console.error('Failed to leave group:', err)
    }
  }

  const handleRemove = async (userId: string) => {
    try {
      await remove.mutateAsync(userId)
    } catch (err: any) {
      console.error('Failed to remove member:', err)
    }
  }

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await updateRole.mutateAsync({ userId, role: newRole })
    } catch (err: any) {
      console.error('Failed to update role:', err)
    }
  }

  const getRoleBadgeVariant = (role: Role) => {
    if (role === 'owner') return 'default'
    if (role === 'admin') return 'secondary'
    return 'secondary'
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h3 className="text-lg text-ink-400">Members</h3>
        {!amOwner && amMember && (
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={handleLeave}
            disabled={leave.isPending}
          >
            {leave.isPending ? 'Leaving…' : 'Leave Group'}
          </Button>
        )}
      </div>

      {leave.isError && (
        <p className="text-red-500 text-sm mb-2">
          {(leave.error as Error).message}
        </p>
      )}

      {remove.isError && (
        <p className="text-red-500 text-sm mb-2">
          {(remove.error as Error).message}
        </p>
      )}

      {updateRole.isError && (
        <p className="text-red-500 text-sm mb-2">
          {(updateRole.error as Error).message}
        </p>
      )}

      <div className="space-y-3">
        {members?.map(m => {
          const canManageRole = amOwner && m.user_id !== myUserId && m.role !== 'owner'
          const canRemove = amOwner && m.user_id !== myUserId
          const showActions = canManageRole || canRemove

          return (
            <div
              key={m.user_id}
              className="flex flex-col gap-3 border border-base-700 rounded-xl px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-2">
                {m.display_name ? (
                  <span className="truncate text-ink-400">{m.display_name}</span>
                ) : (
                  <span className="truncate text-ink-400">{m.user_id.slice(0, 8)}…</span>
                )}
                {!canManageRole && (
                  <Badge variant={getRoleBadgeVariant(m.role)} className="shrink-0">
                    {m.role}
                  </Badge>
                )}
              </div>

              {showActions && (
                <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
                  {canManageRole && (
                    <select
                      className="flex-1 min-h-11 rounded-lg border border-base-700 bg-base-900 px-3 py-2.5 text-base text-ink-400 sm:min-w-[7rem] sm:flex-initial sm:text-sm"
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value as Role)}
                      disabled={updateRole.isPending}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}

                  {canRemove && (
                    <Button
                      variant="ghost"
                      className="min-h-11 shrink-0 px-3"
                      onClick={() => handleRemove(m.user_id)}
                      disabled={remove.isPending || updateRole.isPending}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {!members?.length && <div className="text-ink-600 text-sm">No members yet.</div>}
      </div>
    </Card>
  )
}
