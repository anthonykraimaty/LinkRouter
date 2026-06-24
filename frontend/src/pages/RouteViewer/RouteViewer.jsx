import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  PdfViewer,
  ImageViewer,
  VideoLinkViewer,
  VideoFileViewer,
  DisabledView,
  NotFoundView,
} from '../../components/ContentViewer'

export default function RouteViewer({ rootSlug }) {
  const params = useParams()
  // On the root path "/" there is no :slug param — fall back to rootSlug ("home")
  const slug = params.slug || rootSlug
  const [route, setRoute] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'disabled' | 'notfound' | 'error'

  useEffect(() => {
    if (!slug) {
      setStatus('notfound')
      return
    }

    let cancelled = false

    const fetchRoute = async () => {
      try {
        const res = await fetch(`/api/public/${slug}`)

        if (cancelled) return

        if (res.status === 404) {
          setStatus('notfound')
          return
        }

        // If the response was a redirect that the browser followed,
        // we won't reach here for 3xx — the browser handles it.
        // But if the backend returns redirect info as JSON:
        if (res.redirected) {
          // Browser already followed the redirect, nothing to render.
          window.location.href = res.url
          return
        }

        if (!res.ok) {
          setStatus('error')
          return
        }

        const data = await res.json()

        if (data.disabled) {
          setRoute(data)
          setStatus('disabled')
          return
        }

        // Handle redirect type returned as JSON
        if (data.type === 'redirect' && data.content_url) {
          window.location.href = data.content_url
          return
        }

        setRoute(data)
        setStatus('ok')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    fetchRoute()

    return () => {
      cancelled = true
    }
  }, [slug])

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-indigo-600" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    )
  }

  // 404
  if (status === 'notfound') {
    return <NotFoundView />
  }

  // Error
  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-3 text-base text-slate-600">
            We were unable to load this page. Please try again later.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Disabled route
  if (status === 'disabled' && route) {
    return <DisabledView template={route.template} message={route.message} />
  }

  // Active route - render based on type
  if (status === 'ok' && route) {
    const fileUrl = route.file_path ? `/uploads/${route.file_path}` : null

    switch (route.type) {
      case 'pdf':
        return <PdfViewer url={fileUrl} title={route.title} />

      case 'image':
        return <ImageViewer url={fileUrl} title={route.title} />

      case 'video_link':
        return <VideoLinkViewer url={route.content_url} title={route.title} />

      case 'video_file':
        return <VideoFileViewer url={fileUrl} title={route.title} />

      case 'redirect':
        // Should not reach here — redirects are handled above or by the backend.
        // Fallback: redirect client-side.
        if (route.content_url) {
          window.location.href = route.content_url
          return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
              <p className="text-sm text-slate-500">Redirecting...</p>
            </div>
          )
        }
        return <NotFoundView />

      default:
        return <NotFoundView />
    }
  }

  return <NotFoundView />
}
