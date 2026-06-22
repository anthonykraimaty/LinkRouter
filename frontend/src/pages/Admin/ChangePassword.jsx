import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

function homePathForRole(role) {
  if (role === 'analyst') return '/admin/analytics'
  return '/admin'
}

export default function ChangePassword() {
  const { user, role, changePassword } = useAuth()
  const navigate = useNavigate()
  const forced = !!user?.must_change_password

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (next.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match')
      return
    }
    if (next === current) {
      setError('New password must be different from the current one')
      return
    }

    setSaving(true)
    try {
      await changePassword(current, next)
      setSuccess('Password changed successfully.')
      setCurrent('')
      setNext('')
      setConfirm('')
      // After a forced change, send the user to their home page
      if (forced) {
        navigate(homePathForRole(role), { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Change Password</h1>
        <p className="mt-1 text-sm text-slate-500">
          {forced
            ? 'For security, you must set a new password before continuing.'
            : 'Update the password for your account.'}
        </p>
      </div>

      {forced && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your password was set by an administrator. Please choose a new one to continue.
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && !forced && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Current password</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full"
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-full"
            autoComplete="new-password"
            minLength={6}
            required
          />
          <p className="mt-1 text-xs text-slate-400">At least 6 characters.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </>
            ) : 'Change Password'}
          </button>
        </div>
      </form>
    </div>
  )
}
