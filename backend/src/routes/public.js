const express = require('express');
const geoip = require('geoip-lite');

const router = express.Router();

function getPool(req) {
  return req.app.get('db');
}

// Extract the client IP, accounting for the X-Forwarded-For chain set by the
// reverse proxy. With `trust proxy` enabled, req.ip already resolves correctly.
function getClientIp(req) {
  const ip = req.ip || req.connection?.remoteAddress || '';
  // Normalize IPv4-mapped IPv6 addresses (e.g. ::ffff:1.2.3.4)
  return ip.replace(/^::ffff:/, '');
}

// Record a view for an opened route. Fire-and-forget: failures are logged but
// never block or fail the public response.
function recordView(pool, routeId, req) {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || null;

  let country = null;
  let city = null;
  if (ip) {
    const geo = geoip.lookup(ip);
    if (geo) {
      country = geo.country || null;
      city = geo.city || null;
    }
  }

  pool
    .query(
      `INSERT INTO route_views (route_id, ip_address, country, city, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [routeId, ip || null, country, city, userAgent]
    )
    .catch((err) => {
      console.error('Failed to record route view:', err.message);
    });
}

// GET /api/public/:slug — Public route handler
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const pool = getPool(req);

    const result = await pool.query(
      `SELECT r.id, r.slug, r.type, r.title, r.content_url, r.file_path,
              r.original_filename, r.enabled, r.disabled_template_id,
              r.disabled_message
       FROM routes r
       WHERE r.slug = $1`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    const route = result.rows[0];

    // Handle disabled routes
    if (!route.enabled) {
      if (route.disabled_template_id) {
        const templateResult = await pool.query(
          'SELECT html_content, css_content FROM templates WHERE id = $1',
          [route.disabled_template_id]
        );

        if (templateResult.rows.length > 0) {
          return res.json({
            disabled: true,
            template: {
              html_content: templateResult.rows[0].html_content,
              css_content: templateResult.rows[0].css_content
            }
          });
        }
      }

      if (route.disabled_message) {
        return res.json({
          disabled: true,
          message: route.disabled_message
        });
      }

      return res.json({
        disabled: true,
        message: 'This page is currently unavailable'
      });
    }

    // Record the view for analytics (non-blocking, only for enabled routes)
    recordView(pool, route.id, req);

    // Return route data for all types (frontend handles rendering and redirects)
    res.json({
      id: route.id,
      slug: route.slug,
      type: route.type,
      title: route.title,
      content_url: route.content_url,
      file_path: route.file_path,
      original_filename: route.original_filename
    });
  } catch (err) {
    console.error('Public route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
