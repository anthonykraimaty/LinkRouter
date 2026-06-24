import { useState } from 'react'

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
// Nothing is collected covertly or without the browser's normal consent flow.
// ---------------------------------------------------------------------------

// Gather the standard, non-sensitive signals the browser hands to any page.
function collectClientMeta() {
  try {
    const nav = window.navigator || {}
    const scr = window.screen || {}
    return {
      language: nav.language || null,
      languages: Array.isArray(nav.languages) ? nav.languages.slice(0, 10) : null,
      platform: nav.platform || null,
      vendor: nav.vendor || null,
      hardwareConcurrency: nav.hardwareConcurrency ?? null,
      deviceMemory: nav.deviceMemory ?? null,
      maxTouchPoints: nav.maxTouchPoints ?? null,
      timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || null,
      screen: {
        width: scr.width ?? null,
        height: scr.height ?? null,
        availWidth: scr.availWidth ?? null,
        availHeight: scr.availHeight ?? null,
        colorDepth: scr.colorDepth ?? null,
        pixelRatio: window.devicePixelRatio ?? null,
      },
      referrer: document.referrer || null,
    }
  } catch {
    return null
  }
}

// Ask the browser for GPS. Resolves to coords if granted, or null otherwise.
// We never throw — a declined prompt simply yields null.
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
        })
      },
      () => done(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
    // Safety net in case the callback never fires.
    setTimeout(() => done(null), 12000)
  })
}

export default function FakeLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const capture = async (gps) => {
    try {
      await fetch('/api/honeypot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          gps,
          meta: collectClientMeta(),
        }),
      })
    } catch {
      // Swallow — the decoy must behave normally even if logging fails.
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Frame the location prompt as part of a "security verification" so the
    // visitor is inclined to accept it. If declined, gps is null.
    const gps = await requestGps()
    await capture(gps)

    // Always fail, with a realistic delay, so the decoy is convincing.
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
            For your security, please allow location access to verify this device.
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
