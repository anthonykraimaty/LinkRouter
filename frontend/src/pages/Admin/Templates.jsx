import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Templates() {
  const { apiFetch } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      } else {
        setError('Failed to load templates')
      }
    } catch {
      setError('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/admin/templates/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== deleteId))
        setDeleteId(null)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete template')
      }
    } catch {
      setError('Failed to delete template')
    } finally {
      setDeleting(false)
    }
  }

  const renderPreview = (template) => {
    const doc = `<!DOCTYPE html><html><head><style>${template.css_content || ''}</style></head><body>${template.html_content || ''}</body></html>`
    return (
      <iframe
        srcDoc={doc}
        sandbox="allow-same-origin"
        className="pointer-events-none h-40 w-full rounded-lg border border-slate-200 bg-white"
        title={`Preview: ${template.name}`}
      />
    )
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
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage disabled page templates for your routes
          </p>
        </div>
        <Link to="/manage/templates/new" className="btn-primary shrink-0">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="mb-4 rounded-full bg-slate-100 p-4">
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No templates yet</h3>
          <p className="mt-1 text-sm text-slate-500">Create a template for disabled route pages.</p>
          <Link to="/manage/templates/new" className="btn-primary mt-6">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Template
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="card group relative overflow-hidden p-0">
              {/* Preview */}
              <div className="relative">
                {renderPreview(template)}
                {/* Overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-t-xl bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                  <Link
                    to={`/manage/templates/${template.id}/edit`}
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-transform hover:bg-slate-50"
                  >
                    Edit
                  </Link>
                  {!template.is_default && (
                    <button
                      onClick={() => setDeleteId(template.id)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-transform hover:bg-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {/* Info */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100">
                <p className="flex-1 truncate text-sm font-medium text-slate-900">{template.name}</p>
                {template.is_default && (
                  <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Default
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Delete Template</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete this template? Routes using it will fall back to their custom message.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
