import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
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
      <p className="mt-2 text-3xl font-bold text-slate-900">{value.toLocaleString()}</p>
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

// Horizontal bar list used for "Top routes" and "Top countries".
function RankedList({ items, getLabel, getValue, max, renderLabel }) {
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
              <span className="min-w-0 truncate text-slate-700">
                {renderLabel ? renderLabel(item) : getLabel(item)}
              </span>
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

export default function Analytics() {
  const { apiFetch } = useAuth()
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch(`/api/admin/analytics/overview?days=${days}`)
      if (res.ok) {
        setData(await res.json())
      } else {
        setError('Failed to load analytics')
      }
    } catch {
      setError('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [apiFetch, days])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const maxRouteViews = data?.top_routes?.[0]?.views || 0
  const maxCountry = data?.countries?.[0]?.count || 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Link opens across all your routes
          </p>
        </div>
        <RangeSelector value={days} onChange={setDays} />
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label={`Views (last ${days} days)`}
              value={data.totals.window_views}
            />
            <StatCard label="Total views (all time)" value={data.totals.total_views} />
            <StatCard
              label="Routes opened"
              value={data.totals.routes_viewed}
              hint="Distinct routes with at least one view"
            />
          </div>

          {/* Daily bar chart */}
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">
              Views per day
            </h2>
            <ViewsBarChart data={data.daily} />
          </div>

          {/* Top routes + countries */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Top routes</h2>
              <RankedList
                items={data.top_routes}
                getValue={(r) => r.views}
                max={maxRouteViews}
                renderLabel={(r) => {
                  const badge = TYPE_BADGES[r.type] || {
                    label: r.type,
                    color: 'bg-slate-100 text-slate-700',
                  }
                  return (
                    <span className="flex items-center gap-2">
                      <Link
                        to={`/admin/analytics/routes/${r.id}`}
                        className="truncate font-medium text-indigo-600 hover:underline"
                      >
                        /{r.slug}
                      </Link>
                      <span
                        className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </span>
                  )
                }}
              />
            </div>

            <div className="card">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">
                Top countries
              </h2>
              <RankedList
                items={data.countries}
                getLabel={(c) => c.country}
                getValue={(c) => c.count}
                max={maxCountry}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
