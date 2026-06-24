import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const ROUTE_TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'video_link', label: 'Video Link' },
  { value: 'video_file', label: 'Video File' },
  { value: 'redirect', label: 'Redirect' },
]

const FILE_TYPES = ['pdf', 'image', 'video_file']

const ACCEPT_MAP = {
  pdf: '.pdf',
  image: 'image/*',
  video_file: 'video/*',
}

export default function RouteForm() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { apiFetch } = useAuth()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    slug: '',
    title: '',
    type: 'pdf',
    content_url: '',
    enabled: true,
    disabled_template_id: '',
    disabled_message: '',
  })
  const [file, setFile] = useState(null)
  const [existingFile, setExistingFile] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [dragOver, setDragOver] = useState(false)

  const fetchRoute = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/admin/routes/${id}`)
      if (res.ok) {
        const data = await res.json()
        setForm({
          slug: data.slug || '',
          title: data.title || '',
          type: data.type || 'pdf',
          content_url: data.content_url || '',
          enabled: data.enabled !== false,
          disabled_template_id: data.disabled_template_id || '',
          disabled_message: data.disabled_message || '',
        })
        if (data.original_filename) {
          setExistingFile({
            name: data.original_filename,
            path: data.file_path,
          })
        }
      } else {
        navigate('/manage', { replace: true })
      }
    } catch {
      navigate('/manage', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [id, apiFetch, navigate])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch {
      // Ignore
    }
  }, [apiFetch])

  useEffect(() => {
    fetchTemplates()
    if (isEditing) fetchRoute()
  }, [isEditing, fetchRoute, fetchTemplates])

  const validateSlug = (slug) => {
    if (!slug) return 'Slug is required'
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'Slug can only contain lowercase letters, numbers, and hyphens'
    }
    if (slug === 'admin' || slug === 'manage' || slug === 'api') {
      return 'This slug is reserved'
    }
    return null
  }

  const validate = () => {
    const newErrors = {}
    const slugErr = validateSlug(form.slug)
    if (slugErr) newErrors.slug = slugErr
    if (FILE_TYPES.includes(form.type) && !file && !existingFile) {
      newErrors.file = 'A file is required'
    }
    if (form.type === 'video_link' && !form.content_url) {
      newErrors.content_url = 'Video URL is required'
    }
    if (form.type === 'redirect' && !form.content_url) {
      newErrors.content_url = 'Redirect URL is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    setErrors({})

    try {
      const formData = new FormData()
      formData.append('slug', form.slug)
      formData.append('title', form.title)
      formData.append('type', form.type)
      formData.append('enabled', form.enabled)

      if (form.type === 'video_link' || form.type === 'redirect') {
        formData.append('content_url', form.content_url)
      }

      if (file) {
        formData.append('file', file)
      }

      if (!form.enabled) {
        if (form.disabled_template_id) {
          formData.append('disabled_template_id', form.disabled_template_id)
        }
        if (form.disabled_message) {
          formData.append('disabled_message', form.disabled_message)
        }
      }

      const url = isEditing ? `/api/admin/routes/${id}` : '/api/admin/routes'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await apiFetch(url, {
        method,
        body: formData,
      })

      if (res.ok) {
        navigate('/manage', { replace: true })
      } else {
        const data = await res.json()
        if (data.errors) {
          setErrors(data.errors)
        } else {
          setErrors({ general: data.error || 'Failed to save route' })
        }
      }
    } catch {
      setErrors({ general: 'Failed to save route' })
    } finally {
      setSaving(false)
    }
  }

  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setExistingFile(null)
    }
  }

  const handleFileSelect = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      setExistingFile(null)
    }
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const getVideoPreviewUrl = (url) => {
    if (!url) return null
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
    // Vimeo
    const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-indigo-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/manage')}
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Routes
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditing ? 'Edit Route' : 'Create Route'}
        </h1>
      </div>

      {errors.general && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Slug */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Route Details</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="slug">Slug</label>
              <input
                id="slug"
                type="text"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="my-route"
                className={`w-full ${errors.slug ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
              {form.slug && !errors.slug && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Preview: <span className="font-mono text-indigo-600">yourdomain.com/{form.slug}</span>
                </p>
              )}
              {errors.slug && <p className="mt-1.5 text-xs text-red-600">{errors.slug}</p>}
            </div>

            <div>
              <label htmlFor="title">Title</label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="My Route Title"
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="type">Type</label>
              <select
                id="type"
                value={form.type}
                onChange={(e) => {
                  updateField('type', e.target.value)
                  setFile(null)
                  setExistingFile(null)
                  updateField('content_url', '')
                }}
                className="w-full"
              >
                {ROUTE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content - file upload */}
        {FILE_TYPES.includes(form.type) && (
          <div className="card">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              {form.type === 'pdf' ? 'PDF File' : form.type === 'image' ? 'Image File' : 'Video File'}
            </h2>

            {existingFile && !file && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <svg className="h-5 w-5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{existingFile.name}</p>
                  <p className="text-xs text-slate-500">Current file</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExistingFile(null)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50'
                  : errors.file
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_MAP[form.type]}
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div>
                  <svg className="mx-auto h-8 w-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-slate-700">{file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    className="mt-2 text-xs text-red-600 hover:text-red-800"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drop your file here, or <span className="text-indigo-600">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {form.type === 'pdf' && 'PDF files only'}
                    {form.type === 'image' && 'PNG, JPG, GIF, WebP, SVG'}
                    {form.type === 'video_file' && 'MP4, WebM, MOV'}
                  </p>
                </div>
              )}
            </div>
            {errors.file && <p className="mt-2 text-xs text-red-600">{errors.file}</p>}
          </div>
        )}

        {/* Content - video link */}
        {form.type === 'video_link' && (
          <div className="card">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Video URL</h2>
            <div>
              <label htmlFor="content_url">YouTube or Vimeo URL</label>
              <input
                id="content_url"
                type="url"
                value={form.content_url}
                onChange={(e) => updateField('content_url', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className={`w-full ${errors.content_url ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
              {errors.content_url && <p className="mt-1.5 text-xs text-red-600">{errors.content_url}</p>}
            </div>
            {form.content_url && getVideoPreviewUrl(form.content_url) && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Preview</p>
                <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={getVideoPreviewUrl(form.content_url)}
                    className="absolute inset-0 h-full w-full"
                    allowFullScreen
                    title="Video preview"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content - redirect */}
        {form.type === 'redirect' && (
          <div className="card">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Redirect URL</h2>
            <div>
              <label htmlFor="content_url">Destination URL</label>
              <input
                id="content_url"
                type="url"
                value={form.content_url}
                onChange={(e) => updateField('content_url', e.target.value)}
                placeholder="https://example.com"
                className={`w-full ${errors.content_url ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
              {errors.content_url && <p className="mt-1.5 text-xs text-red-600">{errors.content_url}</p>}
            </div>
          </div>
        )}

        {/* Status */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Status</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Enabled</p>
              <p className="text-xs text-slate-500">When disabled, visitors will see a custom page or message</p>
            </div>
            <button
              type="button"
              onClick={() => updateField('enabled', !form.enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 ${
                form.enabled ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={form.enabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  form.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {!form.enabled && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              <div>
                <label htmlFor="disabled_template_id">Disabled Page Template</label>
                <select
                  id="disabled_template_id"
                  value={form.disabled_template_id}
                  onChange={(e) => updateField('disabled_template_id', e.target.value)}
                  className="w-full"
                >
                  <option value="">None (use custom message instead)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {!form.disabled_template_id && (
                <div>
                  <label htmlFor="disabled_message">Custom Message</label>
                  <textarea
                    id="disabled_message"
                    rows={3}
                    value={form.disabled_message}
                    onChange={(e) => updateField('disabled_message', e.target.value)}
                    placeholder="This page is currently unavailable..."
                    className="w-full resize-y"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end pb-8">
          <button
            type="button"
            onClick={() => navigate('/manage')}
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
              isEditing ? 'Update Route' : 'Create Route'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
