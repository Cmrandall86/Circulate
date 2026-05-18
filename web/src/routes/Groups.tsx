import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { useMyGroups, useGroupMembers, useDeleteGroup } from '@/features/groups/api'
import GroupCreateModal from '@/features/groups/components/GroupCreateModal'
import GroupEditModal from '@/features/groups/components/GroupEditModal'
import GroupMembersPanel from '@/features/groups/components/GroupMembersPanel'
import AddMemberModal from '@/features/groups/components/AddMemberModal'
import { supabase } from '@/lib/supabaseClient'
import type { Group } from '@/features/groups/types'

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-ink-600 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function memberCountLabel(count: number | undefined, loading: boolean) {
  if (loading) return '… members'
  const n = count ?? 0
  return n === 1 ? '1 member' : `${n} members`
}

export default function Groups() {
  const { data: groups, isLoading } = useMyGroups()
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null))
  }, [])

  useEffect(() => {
    if (expandedGroupId && groups && !groups.some(g => g.id === expandedGroupId)) {
      setExpandedGroupId(null)
    }
  }, [groups, expandedGroupId])

  const toggleGroup = (groupId: string) => {
    setExpandedGroupId(prev => (prev === groupId ? null : groupId))
  }

  const handleGroupCreated = (group: Group) => {
    setExpandedGroupId(group.id)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl text-ink-400">My Groups</h1>
        <Button className="btn-accent w-full sm:w-auto" onClick={() => setCreateOpen(true)}>Create Group</Button>
      </div>

      {isLoading && <div className="text-ink-600">Loading groups…</div>}

      <div className="grid gap-3">
        {groups?.map(g => (
          <GroupCard
            key={g.id}
            group={g}
            currentUserId={currentUserId}
            isExpanded={expandedGroupId === g.id}
            onToggle={() => toggleGroup(g.id)}
            onEdit={(id) => setEditId(id)}
            onAddMember={(id) => setAddMemberGroupId(id)}
            onDeleted={() => {
              if (expandedGroupId === g.id) setExpandedGroupId(null)
            }}
          />
        ))}
        {!groups?.length && !isLoading && (
          <div className="text-ink-600">You don't belong to any groups yet.</div>
        )}
      </div>

      <GroupCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleGroupCreated}
      />
      {editId && (
        <GroupEditModal groupId={editId} isOpen={!!editId} onClose={() => setEditId(null)} />
      )}
      {addMemberGroupId && (
        <AddMemberModal
          groupId={addMemberGroupId}
          isOpen={!!addMemberGroupId}
          onClose={() => setAddMemberGroupId(null)}
        />
      )}
    </div>
  )
}

function GroupCard({
  group,
  currentUserId,
  isExpanded,
  onToggle,
  onEdit,
  onAddMember,
  onDeleted,
}: {
  group: Group
  currentUserId: string | null
  isExpanded: boolean
  onToggle: () => void
  onEdit: (id: string) => void
  onAddMember: (id: string) => void
  onDeleted: () => void
}) {
  const { data: members, isLoading: membersLoading } = useGroupMembers(group.id)
  const myMembership = members?.find(m => m.user_id === currentUserId)
  const isOwner = myMembership?.role === 'owner'
  const deleteGroup = useDeleteGroup(group.id)
  const panelId = `group-panel-${group.id}`

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone.`)) {
      deleteGroup.mutate(undefined, { onSuccess: onDeleted })
    }
  }

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="flex w-full min-h-11 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-base-700/40"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink-400">{group.name}</span>
            {group.is_invite_only && (
              <Badge variant="secondary">Invite only</Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-600">
            {memberCountLabel(members?.length, membersLoading)}
          </p>
        </div>
        <ChevronIcon expanded={isExpanded} />
      </button>

      {isExpanded && (
        <div id={panelId} className="space-y-4 border-t border-base-700 px-4 pb-4 pt-4">
          <p className="text-ink-600 text-sm">{group.description || '—'}</p>

          {isOwner && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => onAddMember(group.id)}
              >
                Add Member
              </Button>
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => onEdit(group.id)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  className="w-full sm:w-auto"
                  onClick={handleDelete}
                  disabled={deleteGroup.isPending}
                >
                  {deleteGroup.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          )}

          <GroupMembersPanel groupId={group.id} />
        </div>
      )}
    </Card>
  )
}
