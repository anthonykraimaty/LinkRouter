import { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import ViewsBarChart from '../../components/analytics/ViewsBarChart'

const RANGES = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

const TYPE_BADGES = {
  pdf: { label: 'PDF', color: 'bg-red-100 text-red-700' },
  image: { label: 'Image', color: 'bg-green-100 text-green-700' },
  video_link: { label: 'Video Link', color: 'bg-purple-100 text-purple-700' },
  video_file: { label: 'Video File', color: 'bg-blue-100 text-blue-700' },
  redirect: { label: 'Redirect', color: 'bg-orange-100 text-orange-700' },
}

function StatCard({ label, value, hint }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function RangeSelector({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === r.value
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

function RankedList({ items, getLabel, getValue, max }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data yet</p>
  }
  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const value = getValue(item)
        const pct = max > 0 ? Math.round((value / max) * 100) : 0
        return (
          <li key={i}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-700">{getLabel(item)}</span>
              <span className="shrink-0 font-semibold text-slate-900">
                {value.toLocaleString()}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function formatLastViewed(iso) {
  if (!iso) return 'Never'
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function RouteAnalytics() {
  const { id } = useParams()
  const { apiFetch } = useAuth()
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch(`/api/admin/analytics/routes/${id}?days=${days}`)
      if (res.ok) {
        setData(await res.json())
      } else if (res.status === 404) {
        setNotFound(true)
      } else {
        setError('Failed to load analytics')
      }
    } catch {
      setError('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [apiFetch, id, days])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (notFound) {
    return (
      <div className="card py-12 text-center">
        <p className="text-slate-500">This route no longer exists.</p>
        <Link to="/admin/analytics" className="btn-secondary mt-4">
          Back to Analytics
        </Link>
      </div>
    )
  }

  const route = data?.route
  const badge = route
    ? TYPE_BADGES[route.type] || { label: route.type, color: 'bg-slate-100 text-slate-700' }
    : null
  const maxCountry = data?.countries?.[0]?.count || 0
  const maxCity = data?.cities?.[0]?.count || 0

  return (
    <div>
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <Link
          to="/admin/analytics"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Analytics
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold text-slate-900">
                {route?.title || (route ? `/${route.slug}` : 'Route analytics')}
              </h1>
              {badge && (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color}`}
                >
                  {badge.label}
                </span>
              )}
            </div>
            {route && (
              <a
                href={`/${route.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm font-medium text-indigo-600 hover:underline"
              >
                /{route.slug}
              </a>
            )}
          </div>
          <RangeSelector value={days} onChange={setDays} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-indigo-600" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={`Views (last ${days} days)`}
              value={data.totals.window_views.toLocaleString()}
            />
            <StatCard
              label="Total views (all time)"
              value={data.totals.total_views.toLocaleString()}
            />
            <StatCard
              label="Unique visitors"
              value={data.totals.unique_visitors.toLocaleString()}
              hint={`In last ${days} days`}
            />
            <StatCard
              label="Last opened"
              value={formatLastViewed(data.totals.last_viewed)}
            />
          </div>

          {/* Daily bar chart */}
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Views per day</h2>
            <ViewsBarChart data={data.daily} />
          </div>

          {/* Countries + cities */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Countries</h2>
              <RankedList
                items={data.countries}
                getLabel={(c) => c.country}
                getValue={(c) => c.count}
                max={maxCountry}
              />
            </div>
            <div className="card">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Cities</h2>
              <RankedList
                items={data.cities}
                getLabel={(c) =>
                  c.country ? `${c.city}, ${c.country}` : c.city
                }
                getValue={(c) => c.count}
                max={maxCity}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
