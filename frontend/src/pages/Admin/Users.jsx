import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'

const ROLES = [
  { value: 'admin', label: 'Administrator', desc: 'Create users, manage links, view analytics' },
  { value: 'link_manager', label: 'Link Manager', desc: 'Manage links & templates' },
  { value: 'analyst', label: 'Analyst', desc: 'View analytics (read-only)' },
]

export default function Users() {
  const { apiFetch, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'link_manager' })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  // Reset password modal
  const [resetUser, setResetUser] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  // Delete modal
  const [deleteUser, setDeleteUser] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/users')
      if (res.ok) {
        setUsers(await res.json())
      } else {
        setError('Failed to load users')
      }
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    setCreating(true)
    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers((prev) => [...prev, data])
        setShowCreate(false)
        setForm({ username: '', password: '', role: 'link_manager' })
      } else {
        setFormError(data.error || 'Failed to create user')
      }
    } catch {
      setFormError('Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const handleRoleChange = async (u, role) => {
    if (role === u.role) return
    setError('')
    try {
      const res = await apiFetch(`/api/admin/users/${u.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)))
      } else {
        setError(data.error || 'Failed to update role')
      }
    } catch {
      setError('Failed to update role')
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setResetError('')
    setResetting(true)
    try {
      const res = await apiFetch(`/api/admin/users/${resetUser.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: resetPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers((prev) =>
          prev.map((x) => (x.id === resetUser.id ? { ...x, must_change_password: true } : x))
        )
        setResetUser(null)
        setResetPassword('')
      } else {
        setResetError(data.error || 'Failed to reset password')
      }
    } catch {
      setResetError('Failed to reset password')
    } finally {
      setResetting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setDeleting(true)
    setError('')
    try {
      const res = await apiFetch(`/api/admin/users/${deleteUser.id}`, { method: 'DELETE' })
      if (res.ok) {
        setUsers((prev) => prev.filter((x) => x.id !== deleteUser.id))
        setDeleteUser(null)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete user')
        setDeleteUser(null)
      }
    } catch {
      setError('Failed to delete user')
      setDeleteUser(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-indigo-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage accounts and their access level
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-3 font-semibold text-slate-600">Username</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Role</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{u.username}</span>
                      {isSelf && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">You</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className="text-sm"
                        aria-label={`Role for ${u.username}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.must_change_password ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Must change password
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setResetUser(u); setResetPassword(''); setResetError('') }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          title="Reset password"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteUser(u)}
                          disabled={isSelf}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          title={isSelf ? 'You cannot delete your own account' : 'Delete'}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleCreate} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Add User</h3>
            <p className="mt-1 text-sm text-slate-500">
              The user will be prompted to change this password on first login.
            </p>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Temporary password</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setFormError('') }}
                className="btn-secondary"
                disabled={creating}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating...
                  </>
                ) : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handleReset} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Reset Password</h3>
            <p className="mt-1 text-sm text-slate-500">
              Set a new temporary password for <span className="font-medium text-slate-700">{resetUser.username}</span>.
              They will be required to change it on next login.
            </p>

            {resetError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {resetError}
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">New temporary password</label>
              <input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="w-full"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetUser(null)}
                className="btn-secondary"
                disabled={resetting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={resetting}>
                {resetting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Resetting...
                  </>
                ) : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Delete User</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-medium">{deleteUser.username}</span>? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteUser(null)} className="btn-secondary" disabled={deleting}>
                Cancel
              </button>
              <button onClick={handleDelete} className="btn-danger" disabled={deleting}>
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Deleting...
                  </>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
