import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { parseCsv } from '../../utils/csvParser'

const ACCEPT_MAP = {
  pdf: '.pdf',
  image: 'image/*',
  video_file: 'video/*',
}

const TYPE_BADGES = {
  pdf: { label: 'PDF', color: 'bg-red-100 text-red-700' },
  image: { label: 'Image', color: 'bg-green-100 text-green-700' },
  video_link: { label: 'Video Link', color: 'bg-purple-100 text-purple-700' },
  video_file: { label: 'Video File', color: 'bg-blue-100 text-blue-700' },
  redirect: { label: 'Redirect', color: 'bg-orange-100 text-orange-700' },
}

const SAMPLE_CSV = `title,route,type,link
Google,google,redirect,https://google.com
My Document,my-document,pdf,
Company Logo,logo,image,
Intro Video,intro-video,video_link,https://youtube.com/watch?v=example
Promo Clip,promo-clip,video_file,`

export default function CsvImport() {
  const { apiFetch } = useAuth()
  const fileInputRef = useRef(null)

  // Step: 'upload' | 'preview' | 'import'
  const [step, setStep] = useState('upload')
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState('')

  // Preview state
  const [rows, setRows] = useState([])

  // Import state
  const [importStatus, setImportStatus] = useState({}) // idx -> { status, error }
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)

  // File upload state for file-based routes
  const [files, setFiles] = useState({}) // idx -> File
  const [fileDragOver, setFileDragOver] = useState(null) // idx of row being dragged over
  const fileRefs = useRef({})

  const handleCsvText = useCallback((text) => {
    setParseError('')
    const { rows: parsed, errors } = parseCsv(text)
    if (errors.length > 0) {
      setParseError(errors.join('. '))
      return
    }
    if (parsed.length === 0) {
      setParseError('No data rows found in CSV')
      return
    }
    setRows(parsed)
    setImportStatus({})
    setFiles({})
    setImportDone(false)
    setStep('preview')
  }, [])

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => handleCsvText(ev.target.result)
    reader.readAsText(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => handleCsvText(ev.target.result)
    reader.readAsText(f)
  }

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'routes-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- Import logic ---

  const validRows = rows.filter(r => r.validationErrors.length === 0)
  const urlRows = validRows.filter(r => !r.needsFile)
  const fileRows = validRows.filter(r => r.needsFile)
  const errorRows = rows.filter(r => r.validationErrors.length > 0)

  const startImport = async () => {
    setImporting(true)
    setStep('import')

    // Phase A: create URL-based routes
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.validationErrors.length > 0) {
        setImportStatus(prev => ({ ...prev, [i]: { status: 'skipped', error: 'Validation errors' } }))
        continue
      }
      if (row.needsFile) {
        setImportStatus(prev => ({ ...prev, [i]: { status: 'awaiting_file' } }))
        continue
      }

      setImportStatus(prev => ({ ...prev, [i]: { status: 'creating' } }))
      try {
        const formData = new FormData()
        formData.append('slug', row.slug)
        formData.append('title', row.title)
        formData.append('type', row.type)
        formData.append('content_url', row.link)
        formData.append('enabled', 'true')

        const res = await apiFetch('/api/admin/routes', { method: 'POST', body: formData })
        if (res.ok) {
          setImportStatus(prev => ({ ...prev, [i]: { status: 'done' } }))
        } else {
          const data = await res.json().catch(() => ({}))
          setImportStatus(prev => ({ ...prev, [i]: { status: 'error', error: data.error || `HTTP ${res.status}` } }))
        }
      } catch (err) {
        setImportStatus(prev => ({ ...prev, [i]: { status: 'error', error: err.message } }))
      }
    }

    setImporting(false)
  }

  const uploadFileForRow = async (idx) => {
    const row = rows[idx]
    const file = files[idx]
    if (!file || !row) return

    setImportStatus(prev => ({ ...prev, [idx]: { status: 'creating' } }))
    try {
      const formData = new FormData()
      formData.append('slug', row.slug)
      formData.append('title', row.title)
      formData.append('type', row.type)
      formData.append('enabled', 'true')
      formData.append('file', file)

      const res = await apiFetch('/api/admin/routes', { method: 'POST', body: formData })
      if (res.ok) {
        setImportStatus(prev => ({ ...prev, [idx]: { status: 'done' } }))
      } else {
        const data = await res.json().catch(() => ({}))
        setImportStatus(prev => ({ ...prev, [idx]: { status: 'error', error: data.error || `HTTP ${res.status}` } }))
      }
    } catch (err) {
      setImportStatus(prev => ({ ...prev, [idx]: { status: 'error', error: err.message } }))
    }
  }

  const handleRouteFileSelect = (idx, e) => {
    const f = e.target.files?.[0]
    if (f) setFiles(prev => ({ ...prev, [idx]: f }))
  }

  const handleRouteFileDrop = (idx, e) => {
    e.preventDefault()
    setFileDragOver(null)
    const f = e.dataTransfer.files?.[0]
    if (f) setFiles(prev => ({ ...prev, [idx]: f }))
  }

  // --- Summary counts ---
  const statusValues = Object.values(importStatus)
  const doneCount = statusValues.filter(s => s.status === 'done').length
  const errorCount = statusValues.filter(s => s.status === 'error').length
  const awaitingCount = statusValues.filter(s => s.status === 'awaiting_file').length
  const allFilesDone = fileRows.every((_, fi) => {
    const idx = rows.indexOf(fileRows[fi])
    return importStatus[idx]?.status === 'done' || importStatus[idx]?.status === 'error'
  })

  // --- Render ---

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Routes from CSV</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bulk create routes by uploading a CSV file
          </p>
        </div>
        <Link to="/manage" className="btn-secondary">Back to Routes</Link>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card max-w-2xl">
          <h2 className="mb-1 text-base font-semibold text-slate-900">Upload CSV File</h2>
          <p className="mb-4 text-sm text-slate-500">
            Format: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">title,route,type,link</code>
          </p>

          {parseError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {parseError}
            </div>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              dragOver
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <svg className="mx-auto h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-700">
              Drop your CSV file here, or <span className="text-indigo-600">browse</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">CSV files only</p>
          </div>

          <button onClick={downloadSample} className="mt-4 text-sm text-indigo-600 hover:text-indigo-800">
            Download sample CSV
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div>
          {/* Summary banner */}
          <div className="card mb-4 flex flex-wrap items-center gap-4">
            <span className="text-sm text-slate-700">
              <strong>{validRows.length}</strong> routes ready to import
            </span>
            {errorRows.length > 0 && (
              <span className="text-sm text-red-600">
                <strong>{errorRows.length}</strong> with errors (will be skipped)
              </span>
            )}
            {fileRows.length > 0 && (
              <span className="text-sm text-amber-600">
                <strong>{fileRows.length}</strong> need file uploads after import
              </span>
            )}
          </div>

          {/* Preview table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 font-semibold text-slate-600 w-10">#</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Title</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Slug</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Link</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => {
                    const hasErrors = row.validationErrors.length > 0
                    const badge = TYPE_BADGES[row.type]
                    return (
                      <tr key={idx} className={hasErrors ? 'bg-red-50/50' : ''}>
                        <td className="px-4 py-3 text-slate-400">{row.rowNumber}</td>
                        <td className="px-4 py-3 text-slate-700">{row.title || <span className="italic text-slate-400">empty</span>}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.slug || <span className="italic text-slate-400">empty</span>}</td>
                        <td className="px-4 py-3">
                          {badge ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>
                              {badge.label}
                            </span>
                          ) : (
                            <span className="text-red-600 text-xs">{row.type || 'missing'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-48 truncate">{row.link || (row.needsFile ? <span className="text-amber-600">file upload needed</span> : '-')}</td>
                        <td className="px-4 py-3">
                          {hasErrors ? (
                            <span className="text-xs text-red-600" title={row.validationErrors.join(', ')}>
                              {row.validationErrors[0]}
                              {row.validationErrors.length > 1 && ` (+${row.validationErrors.length - 1})`}
                            </span>
                          ) : (
                            <span className="text-xs text-green-600">Ready</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <button onClick={() => setStep('upload')} className="btn-secondary">Back</button>
            <button
              onClick={startImport}
              disabled={validRows.length === 0}
              className="btn-primary"
            >
              Import {validRows.length} Route{validRows.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Import progress + file uploads */}
      {step === 'import' && (
        <div>
          {/* Progress summary */}
          <div className="card mb-4 flex flex-wrap items-center gap-4">
            {importing && (
              <div className="flex items-center gap-2 text-sm text-indigo-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                Creating routes...
              </div>
            )}
            <span className="text-sm text-green-600"><strong>{doneCount}</strong> created</span>
            {errorCount > 0 && <span className="text-sm text-red-600"><strong>{errorCount}</strong> failed</span>}
            {awaitingCount > 0 && <span className="text-sm text-amber-600"><strong>{awaitingCount}</strong> awaiting file upload</span>}
          </div>

          {/* URL-based routes status */}
          {urlRows.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-base font-semibold text-slate-900">URL-based Routes</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-4 py-3 font-semibold text-slate-600">Title</th>
                        <th className="px-4 py-3 font-semibold text-slate-600">Slug</th>
                        <th className="px-4 py-3 font-semibold text-slate-600">Type</th>
                        <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => {
                        if (row.needsFile || row.validationErrors.length > 0) return null
                        const st = importStatus[idx]
                        const badge = TYPE_BADGES[row.type]
                        return (
                          <tr key={idx}>
                            <td className="px-4 py-3 text-slate-700">{row.title}</td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-700">/{row.slug}</td>
                            <td className="px-4 py-3">
                              {badge && (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}>
                                  {badge.label}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={st} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* File-based routes: upload section */}
          {fileRows.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-base font-semibold text-slate-900">File Uploads Required</h2>
              <p className="mb-4 text-sm text-slate-500">
                Upload the required files for each route below. The route will be created once you upload the file.
              </p>

              <div className="space-y-4">
                {rows.map((row, idx) => {
                  if (!row.needsFile || row.validationErrors.length > 0) return null
                  const st = importStatus[idx]
                  const file = files[idx]
                  const isDone = st?.status === 'done'
                  const isCreating = st?.status === 'creating'
                  const isError = st?.status === 'error'
                  const badge = TYPE_BADGES[row.type]

                  return (
                    <div key={idx} className={`card ${isDone ? 'border-green-200 bg-green-50/30' : ''}`}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-slate-900">{row.title}</h3>
                            {badge && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                                {badge.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-mono">/{row.slug}</p>
                        </div>
                        <StatusBadge status={st} />
                      </div>

                      {!isDone && !isCreating && (
                        <div className="mt-3">
                          {isError && (
                            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                              {st.error}
                            </div>
                          )}

                          <div
                            onDragOver={(e) => { e.preventDefault(); setFileDragOver(idx) }}
                            onDragLeave={() => setFileDragOver(null)}
                            onDrop={(e) => handleRouteFileDrop(idx, e)}
                            onClick={() => fileRefs.current[idx]?.click()}
                            className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                              fileDragOver === idx
                                ? 'border-indigo-400 bg-indigo-50'
                                : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                            }`}
                          >
                            <input
                              ref={el => fileRefs.current[idx] = el}
                              type="file"
                              accept={ACCEPT_MAP[row.type]}
                              onChange={(e) => handleRouteFileSelect(idx, e)}
                              className="hidden"
                            />
                            {file ? (
                              <div className="flex items-center justify-center gap-2">
                                <svg className="h-5 w-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-slate-700">{file.name}</span>
                                <span className="text-xs text-slate-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-slate-500">
                                  Drop file here or <span className="text-indigo-600">browse</span>
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {row.type === 'pdf' && 'PDF files only'}
                                  {row.type === 'image' && 'PNG, JPG, GIF, WebP, SVG'}
                                  {row.type === 'video_file' && 'MP4, WebM, MOV'}
                                </p>
                              </div>
                            )}
                          </div>

                          {file && (
                            <button
                              onClick={() => uploadFileForRow(idx)}
                              disabled={isCreating}
                              className="btn-primary mt-3 w-full text-sm"
                            >
                              Upload & Create Route
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Skipped rows */}
          {errorRows.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-base font-semibold text-slate-900 text-slate-500">Skipped ({errorRows.length})</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm opacity-60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, idx) => {
                        if (row.validationErrors.length === 0) return null
                        return (
                          <tr key={idx} className="bg-red-50/30">
                            <td className="px-4 py-2 text-slate-700">{row.title || '-'}</td>
                            <td className="px-4 py-2 font-mono text-xs text-slate-500">{row.slug || '-'}</td>
                            <td className="px-4 py-2 text-xs text-red-600">{row.validationErrors.join(', ')}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Done actions */}
          {!importing && (
            <div className="flex gap-3">
              <Link to="/manage" className="btn-primary">Go to Dashboard</Link>
              <button onClick={() => { setStep('upload'); setRows([]); setImportStatus({}); setFiles({}) }} className="btn-secondary">
                Import Another CSV
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-slate-400">Pending</span>
  switch (status.status) {
    case 'creating':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          Creating...
        </span>
      )
    case 'done':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Created
        </span>
      )
    case 'error':
      return (
        <span className="text-xs text-red-600" title={status.error}>
          Failed: {status.error}
        </span>
      )
    case 'awaiting_file':
      return <span className="text-xs text-amber-600">Awaiting file</span>
    case 'skipped':
      return <span className="text-xs text-slate-400">Skipped</span>
    default:
      return <span className="text-xs text-slate-400">Pending</span>
  }
}
