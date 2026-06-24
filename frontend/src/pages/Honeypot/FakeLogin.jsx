import { useState, useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// DECOY LOGIN PAGE — served at /admin.
//
// This is a honeypot. It is intentionally made to look like a real admin
// login so that anyone probing the obvious /admin path is recorded. It never
// authenticates anyone: every submission is logged and answered with a
// generic "invalid credentials" error.
//
// Data captured is limited to what the browser exposes to any web page, plus
// GPS coordinates ONLY if the visitor explicitly accepts the location prompt.
// Nothing is collected covertly or without the browser's normal consent flow,
// and nothing is cross-referenced against any external/third-party source.
// ---------------------------------------------------------------------------

// User-Agent Client Hints — high-entropy values incl. device model.
// Android Chrome exposes a real model string here; iOS exposes none.
async function getClientHints(nav) {
  try {
    if (!nav.userAgentData?.getHighEntropyValues) return null
    const h = await nav.userAgentData.getHighEntropyValues([
      'platform',
      'platformVersion',
      'architecture',
      'bitness',
      'model',
      'uaFullVersion',
      'fullVersionList',
    ])
    return {
      brands: nav.userAgentData.brands || null,
      mobile: nav.userAgentData.mobile ?? null,
      platform: h.platform || null,
      platformVersion: h.platformVersion || null,
      architecture: h.architecture || null,
      bitness: h.bitness || null,
      model: h.model || null, // <-- phone/device model (Android)
      uaFullVersion: h.uaFullVersion || null,
      fullVersionList: h.fullVersionList || null,
    }
  } catch {
    return null
  }
}

// WebGL renderer/vendor often reveals the exact GPU (a strong device signal).
function getWebGl() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return null
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      unmaskedVendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null,
      unmaskedRenderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
    }
  } catch {
    return null
  }
}

// Canvas fingerprint — a stable hash derived from how this device renders text.
function getCanvasHash() {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.textBaseline = 'top'
    ctx.font = '16px "Arial"'
    ctx.fillStyle = '#f60'
    ctx.fillRect(10, 10, 100, 30)
    ctx.fillStyle = '#069'
    ctx.fillText('Honeypot \u{1F50D} fingerprint', 12, 18)
    const data = canvas.toDataURL()
    // Cheap 32-bit string hash — we only need a stable device discriminator.
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i)
      hash |= 0
    }
    return (hash >>> 0).toString(16)
  } catch {
    return null
  }
}

// Network info (Chrome/Android): effective connection type & link speed.
function getNetwork(nav) {
  try {
    const c = nav.connection || nav.mozConnection || nav.webkitConnection
    if (!c) return null
    return {
      effectiveType: c.effectiveType || null,
      downlink: c.downlink ?? null,
      rtt: c.rtt ?? null,
      saveData: c.saveData ?? null,
      type: c.type || null,
    }
  } catch {
    return null
  }
}

// Battery (where exposed): level + charging state.
async function getBattery(nav) {
  try {
    if (!nav.getBattery) return null
    const b = await nav.getBattery()
    return {
      level: b.level ?? null,
      charging: b.charging ?? null,
    }
  } catch {
    return null
  }
}

// Gather everything the browser exposes to any page. Async because some
// signals (client hints, battery) return promises.
async function collectClientMeta() {
  try {
    const nav = window.navigator || {}
    const scr = window.screen || {}
    const [clientHints, battery] = await Promise.all([
      getClientHints(nav),
      getBattery(nav),
    ])
    return {
      userAgent: nav.userAgent || null,
      clientHints, // device model, platform version, architecture
      language: nav.language || null,
      languages: Array.isArray(nav.languages) ? nav.languages.slice(0, 10) : null,
      platform: nav.platform || null,
      vendor: nav.vendor || null,
      hardwareConcurrency: nav.hardwareConcurrency ?? null,
      deviceMemory: nav.deviceMemory ?? null,
      maxTouchPoints: nav.maxTouchPoints ?? null,
      cookieEnabled: nav.cookieEnabled ?? null,
      doNotTrack: nav.doNotTrack ?? null,
      pdfViewerEnabled: nav.pdfViewerEnabled ?? null,
      timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || null,
      timezoneOffset: new Date().getTimezoneOffset(),
      screen: {
        width: scr.width ?? null,
        height: scr.height ?? null,
        availWidth: scr.availWidth ?? null,
        availHeight: scr.availHeight ?? null,
        colorDepth: scr.colorDepth ?? null,
        pixelRatio: window.devicePixelRatio ?? null,
        orientation: scr.orientation?.type || null,
      },
      network: getNetwork(nav),
      battery,
      webgl: getWebGl(),
      canvasHash: getCanvasHash(),
      touchSupport: 'ontouchstart' in window || (nav.maxTouchPoints ?? 0) > 0,
      referrer: document.referrer || null,
      pageUrl: window.location.href || null,
    }
  } catch {
    return null
  }
}

// Ask the browser for GPS. Resolves to coords if granted, or null otherwise.
// We never throw — a declined prompt (or insecure origin) simply yields null.
function requestGps() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null)
      return
    }
    let settled = false
    const done = (val) => {
      if (!settled) {
        settled = true
        resolve(val)
      }
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        done({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude ?? null,
          heading: pos.coords.heading ?? null,
          speed: pos.coords.speed ?? null,
        })
      },
      () => done(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
    // Safety net in case the callback never fires.
    setTimeout(() => done(null), 12000)
  })
}

async function sendCapture(payload) {
  try {
    await fetch('/api/honeypot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Swallow — the decoy must behave normally even if logging fails.
  }
}

export default function FakeLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const loadCaptured = useRef(false)

  // On first load: collect the device fingerprint AND fire the GPS prompt
  // immediately (framed as a security check). This logs a first record even
  // if the visitor never submits the form.
  useEffect(() => {
    if (loadCaptured.current) return
    loadCaptured.current = true
    ;(async () => {
      const [meta, gps] = await Promise.all([collectClientMeta(), requestGps()])
      await sendCapture({ stage: 'load', gps, meta })
    })()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Re-request GPS on submit too — if they declined on load they may accept
    // now, and a fresh fix is logged alongside the credentials they typed.
    const [meta, gps] = await Promise.all([collectClientMeta(), requestGps()])
    await sendCapture({ stage: 'submit', username, password, gps, meta })

    // Gate sign-in on location: if GPS was not granted, refuse to proceed and
    // tell the visitor location is required. This pressures them to accept the
    // prompt (so we get a precise fix) rather than dismiss it.
    if (!gps) {
      setTimeout(() => {
        setSubmitting(false)
        setError(
          'Location access is required to sign in. Please enable location for this site and try again.'
        )
      }, 500)
      return
    }

    // Location granted → run the normal "wrong credentials" deception.
    setTimeout(() => {
      setSubmitting(false)
      setError('Invalid username or password')
      setPassword('')
    }, 600)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand — mirrors the real login so the decoy is believable */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-500/30">
            R
          </div>
          <h1 className="text-2xl font-bold text-slate-900">RoutesMapper</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your admin panel</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Sign In</h2>
          <p className="mb-6 text-xs text-slate-400">
            For your security, location access is <span className="font-semibold text-slate-500">required</span> to
            verify this device before signing in.
          </p>

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

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="w-full"
              />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
