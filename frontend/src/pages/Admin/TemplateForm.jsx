import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const DEFAULT_HTML = `<div class="container">
  <h1>Page Unavailable</h1>
  <p>This page is currently not available. Please check back later.</p>
</div>`

const DEFAULT_CSS = `.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
  background: #f8fafc;
  color: #334155;
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #0f172a;
}

p {
  font-size: 1.125rem;
  color: #64748b;
}`

export default function TemplateForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { apiFetch } = useAuth()

  const [name, setName] = useState('')
  const [htmlContent, setHtmlContent] = useState(isEditing ? '' : DEFAULT_HTML)
  const [cssContent, setCssContent] = useState(isEditing ? '' : DEFAULT_CSS)
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/admin/templates/${id}`)
      if (res.ok) {
        const data = await res.json()
        setName(data.name || '')
        setHtmlContent(data.html_content || '')
        setCssContent(data.css_content || '')
      } else {
        navigate('/manage/templates', { replace: true })
      }
    } catch {
      navigate('/manage/templates', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [id, apiFetch, navigate])

  useEffect(() => {
    if (isEditing) fetchTemplate()
  }, [isEditing, fetchTemplate])

  const previewDoc = useMemo(() => {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${cssContent}</style></head><body>${htmlContent}</body></html>`
  }, [htmlContent, cssContent])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!htmlContent.trim()) newErrors.html = 'HTML content is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    setErrors({})

    try {
      const url = isEditing ? `/api/admin/templates/${id}` : '/api/admin/templates'
      const method = isEditing ? 'PUT' : 'POST'
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          name: name.trim(),
          html_content: htmlContent,
          css_content: cssContent,
        }),
      })

      if (res.ok) {
        navigate('/manage/templates', { replace: true })
      } else {
        const data = await res.json()
        setErrors({ general: data.error || 'Failed to save template' })
      }
    } catch {
      setErrors({ general: 'Failed to save template' })
    } finally {
      setSaving(false)
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
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/manage/templates')}
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Templates
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditing ? 'Edit Template' : 'Create Template'}
        </h1>
      </div>

      {errors.general && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div className="mb-6">
          <label htmlFor="name">Template Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((prev) => { const n = { ...prev }; delete n.name; return n }) }}
            placeholder="e.g., Maintenance Page"
            className={`w-full max-w-md ${errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
          />
          {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
        </div>

        {/* Editor + Preview */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editors */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="html" className="mb-0">HTML</label>
                <span className="text-xs text-slate-400">Body content only</span>
              </div>
              <textarea
                id="html"
                value={htmlContent}
                onChange={(e) => { setHtmlContent(e.target.value); setErrors((prev) => { const n = { ...prev }; delete n.html; return n }) }}
                rows={14}
                spellCheck={false}
                className={`w-full font-mono text-sm leading-relaxed resize-y ${errors.html ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                placeholder="<div>Your HTML here</div>"
              />
              {errors.html && <p className="mt-1.5 text-xs text-red-600">{errors.html}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="css" className="mb-0">CSS</label>
                <span className="text-xs text-slate-400">Scoped to template</span>
              </div>
              <textarea
                id="css"
                value={cssContent}
                onChange={(e) => setCssContent(e.target.value)}
                rows={14}
                spellCheck={false}
                className="w-full font-mono text-sm leading-relaxed resize-y"
                placeholder=".container { ... }"
              />
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <div className="mb-1 flex items-center gap-2">
              <label className="mb-0">Live Preview</label>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Auto-updating
              </span>
            </div>
            <div className="sticky top-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-slate-400">Preview</span>
              </div>
              <iframe
                srcDoc={previewDoc}
                sandbox="allow-same-origin"
                className="h-[500px] w-full"
                title="Template preview"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3 justify-end border-t border-slate-200 pt-6 pb-8">
          <button
            type="button"
            onClick={() => navigate('/manage/templates')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </>
            ) : (
              isEditing ? 'Update Template' : 'Create Template'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
