import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Login({ setupMode: setupModeProp = false }) {
  const { login, token, needsSetup, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isSetup = setupModeProp || location.pathname === '/admin/setup'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && token) {
      navigate('/admin', { replace: true })
    }
  }, [token, loading, navigate])

  useEffect(() => {
    if (!loading && !isSetup && needsSetup) {
      navigate('/admin/setup', { replace: true })
    }
  }, [loading, needsSetup, isSetup, navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetup = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Setup failed')
      }
      await login(username, password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Setup failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-indigo-600" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-500/30">
            R
          </div>
          <h1 className="text-2xl font-bold text-slate-900">RoutesMapper</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSetup ? 'Create your admin account to get started' : 'Sign in to your admin panel'}
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">
            {isSetup ? 'Create Admin Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          )}

          <form onSubmit={isSetup ? handleSetup : handleLogin} className="space-y-4">
            <div>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoFocus
                autoComplete="username"
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSetup ? 'Create a password (min 6 chars)' : 'Enter your password'}
                required
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                className="w-full"
              />
            </div>

            {isSetup && (
              <div>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  autoComplete="new-password"
                  className="w-full"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {isSetup ? 'Creating...' : 'Signing in...'}
                </>
              ) : (
                isSetup ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          {isSetup && (
            <p className="mt-4 text-center text-xs text-slate-400">
              This will create the first administrator account.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
