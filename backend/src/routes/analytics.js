const express = require('express');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// Analytics is available to admins and analysts (read-only viewers)
router.use(authMiddleware, requireRole('admin', 'analyst'));

function getPool(req) {
  return req.app.get('db');
}

// Clamp a requested day-range to a sane window. Defaults to 30 days.
function parseDays(value) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1) return 30;
  return Math.min(n, 365);
}

// Build a continuous daily series (zero-filled) from grouped DB rows so the
// bar graph shows every day in the window, including days with no views.
function buildDailySeries(rows, days) {
  const counts = new Map();
  for (const row of rows) {
    // row.day is a 'YYYY-MM-DD' string (date column cast to text)
    counts.set(row.day, parseInt(row.count, 10));
  }

  const series = [];
  // Work in UTC to stay consistent with the DB's date_trunc.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, count: counts.get(key) || 0 });
  }
  return series;
}

// ---------------------------------------------------------------------------
// GET /overview — Aggregate analytics across all routes
// ---------------------------------------------------------------------------
router.get('/overview', async (req, res) => {
  try {
    const pool = getPool(req);
    const days = parseDays(req.query.days);

    const since = `NOW() - INTERVAL '${days} days'`;

    // Totals: all-time and within the window. Content views exclude hits that
    // landed on a disabled route (those are counted separately below).
    const totalsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE NOT was_disabled)::int AS total_views,
         COUNT(*) FILTER (WHERE NOT was_disabled AND viewed_at >= ${since})::int AS window_views,
         COUNT(DISTINCT route_id) FILTER (WHERE NOT was_disabled)::int AS routes_viewed,
         COUNT(*) FILTER (WHERE was_disabled)::int AS total_disabled_views,
         COUNT(*) FILTER (WHERE was_disabled AND viewed_at >= ${since})::int AS window_disabled_views
       FROM route_views`
    );

    // Daily view counts within the window (content views only)
    const dailyResult = await pool.query(
      `SELECT to_char(date_trunc('day', viewed_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS count
       FROM route_views
       WHERE NOT was_disabled AND viewed_at >= ${since}
       GROUP BY day
       ORDER BY day`
    );

    // Top routes by view count within the window (content views only)
    const topRoutesResult = await pool.query(
      `SELECT r.id, r.slug, r.title, r.type, COUNT(rv.id)::int AS views
       FROM routes r
       JOIN route_views rv ON rv.route_id = r.id
       WHERE rv.viewed_at >= ${since} AND NOT rv.was_disabled
       GROUP BY r.id, r.slug, r.title, r.type
       ORDER BY views DESC
       LIMIT 10`
    );

    // Top countries within the window (content views only)
    const countriesResult = await pool.query(
      `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*)::int AS count
       FROM route_views
       WHERE NOT was_disabled AND viewed_at >= ${since}
       GROUP BY COALESCE(country, 'Unknown')
       ORDER BY count DESC
       LIMIT 10`
    );

    // Top disabled routes hit within the window (visitors who reached a
    // disabled page).
    const disabledRoutesResult = await pool.query(
      `SELECT r.id, r.slug, r.title, r.type, COUNT(rv.id)::int AS views
       FROM routes r
       JOIN route_views rv ON rv.route_id = r.id
       WHERE rv.viewed_at >= ${since} AND rv.was_disabled
       GROUP BY r.id, r.slug, r.title, r.type
       ORDER BY views DESC
       LIMIT 10`
    );

    // Missing-route hits: slugs requested that map to no route (404s).
    const missingTotalsResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_missing,
         COUNT(*) FILTER (WHERE hit_at >= ${since})::int AS window_missing,
         COUNT(DISTINCT slug) FILTER (WHERE hit_at >= ${since})::int AS distinct_missing_slugs
       FROM missing_route_hits`
    );

    const topMissingResult = await pool.query(
      `SELECT slug, COUNT(*)::int AS hits, MAX(hit_at) AS last_hit
       FROM missing_route_hits
       WHERE hit_at >= ${since}
       GROUP BY slug
       ORDER BY hits DESC, last_hit DESC
       LIMIT 10`
    );

    const totals = totalsResult.rows[0];
    const missingTotals = missingTotalsResult.rows[0];

    res.json({
      days,
      totals: {
        total_views: totals.total_views,
        window_views: totals.window_views,
        routes_viewed: totals.routes_viewed,
        total_disabled_views: totals.total_disabled_views,
        window_disabled_views: totals.window_disabled_views,
        total_missing: missingTotals.total_missing,
        window_missing: missingTotals.window_missing,
        distinct_missing_slugs: missingTotals.distinct_missing_slugs,
      },
      daily: buildDailySeries(dailyResult.rows, days),
      top_routes: topRoutesResult.rows,
      countries: countriesResult.rows,
      disabled_routes: disabledRoutesResult.rows,
      missing_routes: topMissingResult.rows,
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /routes/:id — Per-link analytics detail
// ---------------------------------------------------------------------------
router.get('/routes/:id', async (req, res) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const days = parseDays(req.query.days);

    const routeResult = await pool.query(
      'SELECT id, slug, title, type, created_at FROM routes WHERE id = $1',
      [id]
    );
    if (routeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const since = `NOW() - INTERVAL '${days} days'`;

    const totalsResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_views,
         COUNT(*) FILTER (WHERE viewed_at >= ${since})::int AS window_views,
         COUNT(DISTINCT ip_address) FILTER (WHERE viewed_at >= ${since})::int AS unique_visitors,
         MAX(viewed_at) AS last_viewed
       FROM route_views
       WHERE route_id = $1`,
      [id]
    );

    const dailyResult = await pool.query(
      `SELECT to_char(date_trunc('day', viewed_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS count
       FROM route_views
       WHERE route_id = $1 AND viewed_at >= ${since}
       GROUP BY day
       ORDER BY day`,
      [id]
    );

    const countriesResult = await pool.query(
      `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*)::int AS count
       FROM route_views
       WHERE route_id = $1 AND viewed_at >= ${since}
       GROUP BY COALESCE(country, 'Unknown')
       ORDER BY count DESC
       LIMIT 10`,
      [id]
    );

    const citiesResult = await pool.query(
      `SELECT COALESCE(city, 'Unknown') AS city,
              COALESCE(country, '') AS country,
              COUNT(*)::int AS count
       FROM route_views
       WHERE route_id = $1 AND viewed_at >= ${since}
       GROUP BY COALESCE(city, 'Unknown'), COALESCE(country, '')
       ORDER BY count DESC
       LIMIT 10`,
      [id]
    );

    const totals = totalsResult.rows[0];

    res.json({
      route: routeResult.rows[0],
      days,
      totals: {
        total_views: totals.total_views,
        window_views: totals.window_views,
        unique_visitors: totals.unique_visitors,
        last_viewed: totals.last_viewed,
      },
      daily: buildDailySeries(dailyResult.rows, days),
      countries: countriesResult.rows,
      cities: citiesResult.rows,
    });
  } catch (err) {
    console.error('Analytics route detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
