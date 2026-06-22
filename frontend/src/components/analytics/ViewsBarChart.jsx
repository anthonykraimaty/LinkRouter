import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Format a 'YYYY-MM-DD' key into a short axis label, e.g. "Jun 23".
function formatDay(key) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function TooltipContent({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null
  const value = payload[0].value
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-slate-900">{formatDay(label)}</p>
      <p className="text-slate-600">
        {value} {value === 1 ? 'view' : 'views'}
      </p>
    </div>
  )
}

export default function ViewsBarChart({ data, height = 280 }) {
  // Thin out x-axis ticks when there are many days so labels don't overlap.
  const interval = data.length > 31 ? Math.floor(data.length / 12) : 0

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          interval={interval}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<TooltipContent />} cursor={{ fill: '#eef2ff' }} />
        <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}
