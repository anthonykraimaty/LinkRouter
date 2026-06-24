import { useState, useEffect, useCallback, Fragment } from 'react'
import { useAuth } from '../../contexts/AuthContext'

function formatDate(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

function gpsMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export default function Honeypot() {
  const { apiFetch } = useAuth()
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [showClear, setShowClear] = useState(false)

  const fetchAttempts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/honeypot/attempts')
      if (res.ok) {
        setAttempts(await res.json())
      } else {
        setError('Failed to load honeypot log')
      }
    } catch {
      setError('Failed to load honeypot log')
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    fetchAttempts()
  }, [fetchAttempts])

  const handleDelete = async (id) => {
    try {
      const res = await apiFetch(`/api/honeypot/attempts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setAttempts((prev) => prev.filter((a) => a.id !== id))
      }
    } catch {
      /* ignore */
    }
  }

  const handleClearAll = async () => {
    setClearing(true)
    try {
      const res = await apiFetch('/api/honeypot/attempts', { method: 'DELETE' })
      if (res.ok) {
        setAttempts([])
        setShowClear(false)
      }
    } catch {
      /* ignore */
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Honeypot</h1>
          <p className="mt-1 text-sm text-slate-500">
            Captured login attempts against the decoy <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/admin</code> page.
          </p>
        </div>
        {attempts.length > 0 && (
          <button onClick={() => setShowClear(true)} className="btn-danger">
            Clear log
          </button>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        These records are people who tried to log in at <strong>/admin</strong> — the real panel
        lives at <strong>/manage</strong>. GPS is only present when the visitor accepted the browser
        location prompt.
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-slate-500">Loading…</div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-600">{error}</div>
      ) : attempts.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-base font-medium text-slate-700">No attempts yet</p>
          <p className="mt-1 text-sm text-slate-500">
            When someone tries the decoy <code>/admin</code> login, they'll show up here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Credentials tried</th>
                  <th className="px-4 py-3">GPS</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attempts.map((a) => {
                  const hasGps = a.gps_latitude != null && a.gps_longitude != null
                  const isOpen = expanded === a.id
                  return (
                    <Fragment key={a.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(a.attempted_at)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{a.ip_address || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {[a.city, a.country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-800">{a.username_tried || '—'}</span>
                          <span className="mx-1 text-slate-300">/</span>
                          <span className="font-mono text-xs text-slate-500">{a.password_tried || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          {hasGps ? (
                            <a
                              href={gpsMapsUrl(a.gps_latitude, a.gps_longitude)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-indigo-600 hover:underline"
                            >
                              View map
                            </a>
                          ) : (
                            <span className="text-slate-400">declined</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setExpanded(isOpen ? null : a.id)}
                            className="text-xs font-medium text-slate-500 hover:text-slate-800"
                          >
                            {isOpen ? 'Hide' : 'Details'}
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            className="ml-3 text-xs font-medium text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">User agent</p>
                                <p className="break-all font-mono text-xs text-slate-600">{a.user_agent || '—'}</p>
                                {hasGps && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    GPS: {a.gps_latitude}, {a.gps_longitude}
                                    {a.gps_accuracy != null && ` (±${Math.round(a.gps_accuracy)}m)`}
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Device / browser signals</p>
                                <pre className="max-h-48 overflow-auto rounded bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
{a.client_meta ? JSON.stringify(a.client_meta, null, 2) : 'none'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clear-all confirm modal */}
      {showClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Clear the entire log?</h3>
            <p className="mt-2 text-sm text-slate-500">
              This permanently deletes all {attempts.length} captured attempts. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowClear(false)} className="btn-secondary" disabled={clearing}>
                Cancel
              </button>
              <button onClick={handleClearAll} className="btn-danger" disabled={clearing}>
                {clearing ? 'Clearing…' : 'Clear all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
