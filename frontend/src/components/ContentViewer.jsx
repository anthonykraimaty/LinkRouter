/**
 * Reusable content viewer components for the public RouteViewer page.
 */
import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Parse a YouTube or Vimeo URL and return an embed URL, or null.
 */
function getEmbedUrl(url) {
  if (!url) return null

  // YouTube variants
  // https://www.youtube.com/watch?v=VIDEO_ID
  // https://youtu.be/VIDEO_ID
  // https://www.youtube.com/embed/VIDEO_ID
  // https://www.youtube.com/watch?v=VIDEO_ID&t=120
  const ytPatterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of ytPatterns) {
    const match = url.match(pattern)
    if (match) return `https://www.youtube.com/embed/${match[1]}`
  }

  // Vimeo variants
  // https://vimeo.com/123456789
  // https://player.vimeo.com/video/123456789
  const vimeoPatterns = [
    /(?:vimeo\.com\/)(\d+)/,
    /(?:player\.vimeo\.com\/video\/)(\d+)/,
  ]
  for (const pattern of vimeoPatterns) {
    const match = url.match(pattern)
    if (match) return `https://player.vimeo.com/video/${match[1]}`
  }

  return null
}

/**
 * Full-page PDF viewer.
 * Desktop: native object/iframe embed.
 * Mobile: prominent open/download button since most mobile browsers
 * cannot render PDFs inline via object/iframe.
 */
export function PdfViewer({ url, title }) {
  const fullUrl = url?.startsWith('http') ? url : `${window.location.origin}${url}`

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-slate-900">
      {/* Header bar */}
      <div className="shrink-0 border-b border-slate-700 bg-slate-800 px-4 py-2.5 flex items-center justify-between gap-3">
        <h1 className="text-sm font-medium text-slate-200 truncate min-w-0">
          {title || 'PDF Document'}
        </h1>
        <a
          href={url}
          download
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      </div>

      {/* Desktop: native PDF embed */}
      <div className="flex-1 hidden sm:block">
        <object
          data={url}
          type="application/pdf"
          className="h-full w-full"
        >
          <iframe
            src={url}
            className="h-full w-full border-0"
            title={title || 'PDF Document'}
          />
        </object>
      </div>

      {/* Mobile: Google Docs viewer with fallback CTA */}
      <div className="flex-1 flex flex-col sm:hidden">
        <iframe
          src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fullUrl)}`}
          className="flex-1 w-full border-0"
          title={title || 'PDF Document'}
        />
        <div className="shrink-0 border-t border-slate-700 bg-slate-800 p-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open PDF in Browser
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * Centered responsive image with optional title.
 * Mobile: full-bleed with pinch-to-zoom support, minimal padding.
 */
export function ImageViewer({ url, title }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 p-2 sm:p-4">
      {title && (
        <h1 className="mb-3 sm:mb-4 text-center text-base sm:text-xl font-semibold text-slate-800 px-2">{title}</h1>
      )}
      <div className="w-full max-w-5xl overflow-auto touch-manipulation">
        <img
          src={url}
          alt={title || 'Image'}
          className="mx-auto max-h-[90dvh] sm:max-h-[85vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
        />
      </div>
      <a
        href={url}
        download
        className="mt-3 sm:hidden inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-300"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Save Image
      </a>
    </div>
  )
}

/**
 * Responsive YouTube/Vimeo iframe embed.
 * Mobile: edge-to-edge video with minimal padding, fullscreen-friendly.
 */
export function VideoLinkViewer({ url, title }) {
  const embedUrl = getEmbedUrl(url)

  if (!embedUrl) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-900 p-4">
        <div className="text-center">
          <h1 className="text-base sm:text-lg font-semibold text-white">{title || 'Video'}</h1>
          <p className="mt-2 text-sm text-slate-400">Unable to embed this video.</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Open Video Link
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-900 p-2 sm:p-4">
      {title && (
        <h1 className="mb-3 sm:mb-4 text-center text-base sm:text-lg font-semibold text-white px-2">{title}</h1>
      )}
      <div className="w-full max-w-5xl">
        <div className="relative w-full overflow-hidden rounded-lg sm:rounded-xl shadow-2xl" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title={title || 'Video'}
          />
        </div>
      </div>
    </div>
  )
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

/**
 * HTML5 video player with custom controls: speed selector, progress bar, buffering indicator.
 * Mobile: playsInline for iOS, edge-to-edge layout.
 */
export function VideoFileViewer({ url, title }) {
  const videoRef = useRef(null)
  const [speed, setSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const hideTimer = useRef(null)

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current)
    setShowControls(true)
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000)
    }
  }, [playing])

  useEffect(() => {
    scheduleHide()
    return () => clearTimeout(hideTimer.current)
  }, [playing, scheduleHide])

  const handleTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
    setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0)
  }

  const handleProgress = () => {
    const v = videoRef.current
    if (!v || !v.buffered.length) return
    const end = v.buffered.end(v.buffered.length - 1)
    setBuffered(v.duration ? (end / v.duration) * 100 : 0)
  }

  const handleLoadedMetadata = () => {
    const v = videoRef.current
    if (v) setDuration(v.duration)
  }

  const handleSeek = (e) => {
    const v = videoRef.current
    if (!v) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    v.currentTime = pct * v.duration
  }

  const changeSpeed = (s) => {
    setSpeed(s)
    const v = videoRef.current
    if (v) v.playbackRate = s
    setShowSpeedMenu(false)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play() } else { v.pause() }
  }

  const formatTime = (t) => {
    if (!t || !isFinite(t)) return '0:00'
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-900 p-2 sm:p-4"
      onClick={scheduleHide}
      onMouseMove={scheduleHide}
      onTouchStart={scheduleHide}
    >
      {title && (
        <h1 className="mb-3 sm:mb-4 text-center text-base sm:text-lg font-semibold text-white px-2">{title}</h1>
      )}
      <div className="relative w-full max-w-5xl group">
        {/* Buffering spinner overlay */}
        {buffering && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        )}

        <video
          ref={videoRef}
          src={url}
          playsInline
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleProgress}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="mx-auto max-h-[80dvh] sm:max-h-[82vh] w-full rounded-lg sm:rounded-xl shadow-2xl"
        >
          <p className="p-8 text-center text-slate-400">
            Your browser does not support the video tag.
          </p>
        </video>

        {/* Full-surface tap zone for play/pause — covers entire video */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 z-10 w-full h-full cursor-pointer flex items-center justify-center touch-manipulation"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {!playing && (
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
              <svg className="h-8 w-8 sm:h-10 sm:w-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </button>

        {/* Bottom controls overlay */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 rounded-b-lg sm:rounded-b-xl bg-gradient-to-t from-black/80 to-transparent px-3 sm:px-4 pb-2 sm:pb-3 pt-6 sm:pt-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {/* Progress bar */}
          <div
            className="relative h-2 sm:h-2 w-full cursor-pointer rounded-full bg-white/20 mb-2 sm:mb-3 touch-none"
            onClick={handleSeek}
            onTouchStart={handleSeek}
          >
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/30 pointer-events-none"
              style={{ width: `${buffered}%` }}
            />
            {/* Progress */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 pointer-events-none"
              style={{ width: `${progress}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow-md pointer-events-none"
              style={{ left: `${progress}%`, marginLeft: '-8px' }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white p-1.5 -ml-1.5 touch-manipulation">
              {playing ? (
                <svg className="h-7 w-7 sm:h-6 sm:w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="h-7 w-7 sm:h-6 sm:w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time display */}
            <span className="text-xs sm:text-sm text-white/80 font-mono tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Speed control */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="rounded-md bg-white/15 px-2.5 py-1.5 sm:px-2 sm:py-1 text-xs sm:text-sm font-medium text-white hover:bg-white/25 transition-colors touch-manipulation"
              >
                {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-slate-800 border border-slate-700 shadow-xl overflow-hidden">
                  {PLAYBACK_SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`block w-full px-5 py-2.5 sm:px-4 sm:py-2 text-left text-sm transition-colors touch-manipulation ${
                        s === speed
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={() => videoRef.current?.requestFullscreen?.() || videoRef.current?.webkitRequestFullscreen?.()}
              className="text-white p-1.5 -mr-1.5 touch-manipulation"
            >
              <svg className="h-6 w-6 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Disabled page view: renders template HTML/CSS or a custom message.
 */
export function DisabledView({ template, message }) {
  if (template && template.html_content) {
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${template.css_content || ''}</style></head><body>${template.html_content}</body></html>`
    return (
      <iframe
        srcDoc={doc}
        sandbox="allow-same-origin allow-scripts"
        className="h-screen w-full border-0"
        title="Disabled page"
      />
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-200">
          <svg className="h-8 w-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Page Unavailable</h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">
          {message || 'This page is currently not available. Please check back later.'}
        </p>
      </div>
    </div>
  )
}

/**
 * 404 Not Found page.
 */
export function NotFoundView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="max-w-lg text-center">
        <p className="text-7xl font-bold text-slate-200">404</p>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Page Not Found</h1>
        <p className="mt-3 text-base text-slate-600">
          The page you are looking for does not exist or has been removed.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
