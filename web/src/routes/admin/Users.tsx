import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { AdminFeedbackContent } from './Feedback'

interface User {
  id: string
  email?: string
  role?: 'member' | 'admin'
  user_metadata?: { display_name?: string }
  created_at?: string
  banned_until?: string
  display_name?: string
}

function isUserBanned(user: User) {
  return !!user.banned_until
}

function userDisplayName(user: User) {
  return user.display_name || user.user_metadata?.display_name || 'N/A'
}

function userRoleLabel(user: User) {
  return user.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'Member'
}

function userCreatedLabel(user: User) {
  return user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'
}

function UserRoleBadge({ user }: { user: User }) {
  return (
    <Badge variant={user.role === 'admin' ? 'success' : 'default'}>
      {userRoleLabel(user)}
    </Badge>
  )
}

function UserBannedBadge() {
  return (
    <Badge variant="error" className="text-xs">
      Banned
    </Badge>
  )
}

function UserActions({
  user,
  isSelf,
  onEdit,
  onDisable,
  onEnable,
  onDelete,
  variant = 'table',
}: {
  user: User
  isSelf: boolean
  onEdit: (user: User) => void
  onDisable: (user: User) => void
  onEnable: (user: User) => void
  onDelete: (user: User) => void
  variant?: 'table' | 'card'
}) {
  const banned = isUserBanned(user)

  const editButton = (
    <Button type="button" variant={variant === 'card' ? 'secondary' : 'ghost'} onClick={() => onEdit(user)}>
      Edit
    </Button>
  )

  const disableButton = !isSelf && !banned && (
    <Button
      type="button"
      variant={variant === 'card' ? 'secondary' : 'ghost'}
      onClick={() => onDisable(user)}
    >
      Disable Account
    </Button>
  )

  const enableButton = !isSelf && banned && (
    <Button
      type="button"
      variant={variant === 'card' ? 'secondary' : 'ghost'}
      onClick={() => onEnable(user)}
    >
      Enable Account
    </Button>
  )

  const deleteButton = !isSelf && (
    <Button
      type="button"
      variant={variant === 'card' ? 'secondary' : 'ghost'}
      className="text-red-400 hover:text-red-300"
      onClick={() => onDelete(user)}
    >
      Delete Permanently
    </Button>
  )

  if (variant === 'card') {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full"
          onClick={() => onEdit(user)}
        >
          Edit
        </Button>
        {!isSelf && !banned && (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full"
            onClick={() => onDisable(user)}
          >
            Disable Account
          </Button>
        )}
        {!isSelf && banned && (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full"
            onClick={() => onEnable(user)}
          >
            Enable Account
          </Button>
        )}
        {!isSelf && (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full text-red-400 hover:text-red-300"
            onClick={() => onDelete(user)}
          >
            Delete Permanently
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {editButton}
      {disableButton}
      {enableButton}
      {deleteButton}
    </div>
  )
}

function UserMobileCard({
  user,
  isSelf,
  onEdit,
  onDisable,
  onEnable,
  onDelete,
}: {
  user: User
  isSelf: boolean
  onEdit: (user: User) => void
  onDisable: (user: User) => void
  onEnable: (user: User) => void
  onDelete: (user: User) => void
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink-400">{user.email || 'N/A'}</p>
        <p className="truncate text-sm text-ink-500">{userDisplayName(user)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <UserRoleBadge user={user} />
        {isUserBanned(user) && <UserBannedBadge />}
      </div>
      <p className="text-sm text-ink-600">Created {userCreatedLabel(user)}</p>
      <UserActions
        user={user}
        isSelf={isSelf}
        onEdit={onEdit}
        onDisable={onDisable}
        onEnable={onEnable}
        onDelete={onDelete}
        variant="card"
      />
    </Card>
  )
}

function AdminUsersContent() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'users' | 'feedback'>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [disableModalOpen, setDisableModalOpen] = useState(false)
  const [enableModalOpen, setEnableModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const base = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id && !currentUserId) {
      setCurrentUserId(session.user.id)
    }
    return session?.access_token ?? ''
  }

  const closeUserModals = () => {
    setEditModalOpen(false)
    setDisableModalOpen(false)
    setEnableModalOpen(false)
    setDeleteModalOpen(false)
    setSelectedUser(null)
  }

  const fetchUsers = async () => {
    const token = await getToken()
    const url = new URL(`${base}/functions/v1/admin-users`)
    url.searchParams.set('page', String(page))
    url.searchParams.set('perPage', '20')
    if (searchQuery) url.searchParams.set('query', searchQuery)

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon,
        'content-type': 'application/json',
      },
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('Admin users fetch error:', { status: res.status, errorData })
      if (res.status === 401) throw new Error('Unauthorized')
      if (res.status === 403) {
        const details = errorData.details || errorData.error || 'Forbidden (admin only)'
        console.error('403 Forbidden details:', details, 'User ID:', errorData.userId)
        throw new Error(`Forbidden: ${details}`)
      }
      throw new Error(errorData.error || errorData.details || `Request failed: ${res.status}`)
    }
    return res.json()
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', page, searchQuery],
    queryFn: fetchUsers,
  })

  const createUserMutation = useMutation({
    mutationFn: async (userData: {
      email: string
      password: string
      display_name: string
      role: 'member' | 'admin'
    }) => {
      const token = await getToken()
      const res = await fetch(`${base}/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anon,
          'content-type': 'application/json',
        },
        body: JSON.stringify(userData),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create user')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setCreateModalOpen(false)
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string
      display_name?: string
      role?: 'member' | 'admin'
      password?: string
    }) => {
      if (currentUserId && id === currentUserId && updates.role && updates.role !== 'admin') {
        throw new Error('Cannot remove your own admin privileges')
      }

      const token = await getToken()
      const res = await fetch(`${base}/functions/v1/admin-users/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anon,
          'content-type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update user')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      closeUserModals()
    },
  })

  const disableUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      const res = await fetch(`${base}/functions/v1/admin-users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anon,
          'content-type': 'application/json',
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to disable user')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      closeUserModals()
    },
  })

  const enableUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      const res = await fetch(`${base}/functions/v1/admin-users/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anon,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ banned: false }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to enable user')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      closeUserModals()
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      const url = new URL(`${base}/functions/v1/admin-users/${id}`)
      url.searchParams.set('hard', 'true')

      const res = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anon,
          'content-type': 'application/json',
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete user')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      closeUserModals()
    },
  })

  const users: User[] = data?.users || []

  const openEdit = (user: User) => {
    setSelectedUser(user)
    setEditModalOpen(true)
  }

  const openDisable = (user: User) => {
    setSelectedUser(user)
    setDisableModalOpen(true)
  }

  const openEnable = (user: User) => {
    setSelectedUser(user)
    setEnableModalOpen(true)
  }

  const openDelete = (user: User) => {
    setSelectedUser(user)
    setDeleteModalOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Admin section tabs ── */}
      <div className="flex border-b border-base-700 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-mint-400 text-mint-400'
              : 'border-transparent text-ink-600 hover:text-ink-400'
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
            activeTab === 'feedback'
              ? 'border-mint-400 text-mint-400'
              : 'border-transparent text-ink-600 hover:text-ink-400'
          }`}
        >
          Feedback
        </button>
      </div>

      {activeTab === 'feedback' ? <AdminFeedbackContent /> : (
      <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink-400">User Management</h1>
        <Button className="btn-accent w-full sm:w-auto" onClick={() => setCreateModalOpen(true)}>
          Create User
        </Button>
      </div>

      <Card className="p-4 mb-4">
        <Input
          label="Search"
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setPage(1)
          }}
          placeholder="Search by email or name..."
        />
      </Card>

      {isLoading && <div className="text-ink-500">Loading users...</div>}
      {error && (
        <div className="text-red-400 mb-4">
          Error: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {!isLoading && !error && (
        <>
          {users.length === 0 ? (
            <div className="py-8 text-center text-ink-600">No users found</div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {users.map((user) => (
                  <UserMobileCard
                    key={user.id}
                    user={user}
                    isSelf={user.id === currentUserId}
                    onEdit={openEdit}
                    onDisable={openDisable}
                    onEnable={openEnable}
                    onDelete={openDelete}
                  />
                ))}
              </div>

              <div className="hidden md:block card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-base-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Email</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Name</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Role</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Created</th>
                      <th className="px-4 py-3 text-left text-ink-400 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-base-700 hover:bg-base-700/50">
                        <td className="max-w-[12rem] px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-ink-400">{user.email || 'N/A'}</span>
                            {isUserBanned(user) && <UserBannedBadge />}
                          </div>
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-3 text-ink-500">
                          {userDisplayName(user)}
                        </td>
                        <td className="px-4 py-3">
                          <UserRoleBadge user={user} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-600">
                          {userCreatedLabel(user)}
                        </td>
                        <td className="px-4 py-3">
                          <UserActions
                            user={user}
                            isSelf={user.id === currentUserId}
                            onEdit={openEdit}
                            onDisable={openDisable}
                            onEnable={openEnable}
                            onDelete={openDelete}
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

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-center text-ink-600">Page {page}</span>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={users.length < 20}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}

      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={(data) => createUserMutation.mutate(data)}
        loading={createUserMutation.isPending}
      />

      {selectedUser && (
        <EditUserModal
          isOpen={editModalOpen}
          onClose={closeUserModals}
          user={selectedUser}
          isCurrentUser={selectedUser.id === currentUserId}
          onSubmit={(data) => updateUserMutation.mutate({ id: selectedUser.id, ...data })}
          loading={updateUserMutation.isPending}
        />
      )}

      {selectedUser && (
        <DisableAccountModal
          isOpen={disableModalOpen}
          onClose={closeUserModals}
          user={selectedUser}
          onConfirm={() => disableUserMutation.mutate(selectedUser.id)}
          loading={disableUserMutation.isPending}
        />
      )}

      {selectedUser && (
        <EnableAccountModal
          isOpen={enableModalOpen}
          onClose={closeUserModals}
          user={selectedUser}
          onConfirm={() => enableUserMutation.mutate(selectedUser.id)}
          loading={enableUserMutation.isPending}
        />
      )}

      {selectedUser && (
        <DeletePermanentlyModal
          isOpen={deleteModalOpen}
          onClose={closeUserModals}
          user={selectedUser}
          onConfirm={() => deleteUserMutation.mutate(selectedUser.id)}
          loading={deleteUserMutation.isPending}
        />
      )}
      </>
      )}
    </div>
  )
}

function DisableAccountModal({
  isOpen,
  onClose,
  user,
  onConfirm,
  loading,
}: {
  isOpen: boolean
  onClose: () => void
  user: User
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Disable Account">
      <div className="space-y-4">
        <p className="text-ink-500">
          Disable <strong>{user.email}</strong>? They will not be able to sign in until the account is enabled again.
        </p>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="secondary" onClick={onConfirm} disabled={loading}>
            {loading ? 'Disabling...' : 'Disable Account'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function EnableAccountModal({
  isOpen,
  onClose,
  user,
  onConfirm,
  loading,
}: {
  isOpen: boolean
  onClose: () => void
  user: User
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enable Account">
      <div className="space-y-4">
        <p className="text-ink-500">
          Re-enable <strong>{user.email}</strong>? They will be able to sign in again.
        </p>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" className="btn-accent" onClick={onConfirm} disabled={loading}>
            {loading ? 'Enabling...' : 'Enable Account'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DeletePermanentlyModal({
  isOpen,
  onClose,
  user,
  onConfirm,
  loading,
}: {
  isOpen: boolean
  onClose: () => void
  user: User
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Permanently">
      <div className="space-y-4">
        <p className="text-ink-500">
          Permanently delete <strong>{user.email}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onConfirm}
            disabled={loading}
            className="text-red-400 hover:text-red-300"
          >
            {loading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
  loading,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { email: string; password: string; display_name: string; role: 'member' | 'admin' }) => void
  loading: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ email, password, display_name: displayName, role })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Input label="Display Name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <div>
          <label className="block text-ink-500 mb-2">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
            className="w-full px-4 py-2 bg-base-700 border border-base-600 rounded-2xl text-ink-400"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="btn-accent" disabled={loading}>{loading ? 'Creating...' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({
  isOpen,
  onClose,
  user,
  onSubmit,
  loading,
  isCurrentUser,
}: {
  isOpen: boolean
  onClose: () => void
  user: User
  onSubmit: (data: { display_name?: string; role?: 'member' | 'admin'; password?: string }) => void
  loading: boolean
  isCurrentUser: boolean
}) {
  const [displayName, setDisplayName] = useState(user.display_name || user.user_metadata?.display_name || '')
  const [role, setRole] = useState<'member' | 'admin'>(user.role || 'member')
  const [newPassword, setNewPassword] = useState('')
  const [resetPassword, setResetPassword] = useState(false)

  const isAttemptingSelfDemotion = isCurrentUser && role !== 'admin' && user.role === 'admin'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: { display_name?: string; role?: 'member' | 'admin'; password?: string } = {
      display_name: displayName,
      role,
    }
    if (resetPassword && newPassword) data.password = newPassword
    onSubmit(data)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Display Name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <div>
          <label className="block text-ink-500 mb-2">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
            className="w-full px-4 py-2 bg-base-700 border border-base-600 rounded-2xl text-ink-400"
            disabled={isCurrentUser && user.role === 'admin'}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          {isCurrentUser && user.role === 'admin' && (
            <p className="text-xs text-yellow-400 mt-2">
              You cannot remove your own admin privileges
            </p>
          )}
        </div>
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={resetPassword} onChange={(e) => setResetPassword(e.target.checked)} className="rounded" />
            <span className="text-ink-500">Reset Password</span>
          </label>
          {resetPassword && (
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2" />
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="btn-accent" disabled={loading || isAttemptingSelfDemotion}>
            {loading ? 'Updating...' : 'Update'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminUsers() {
  return <AdminUsersContent />
}
