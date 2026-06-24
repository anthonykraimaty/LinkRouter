const express = require('express');
const geoip = require('geoip-lite');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

function getPool(req) {
  return req.app.get('db');
}

// Resolve the real client IP behind the reverse proxy (same approach as
// the public route view tracker). `trust proxy` is enabled in index.js.
function getClientIp(req) {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// POST /api/honeypot — PUBLIC. The decoy /admin login posts here on submit.
// Records the attempt and always responds as if credentials were wrong, so
// the visitor keeps trying and never learns it is a decoy. This endpoint
// performs NO authentication and never returns a token.
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const pool = getPool(req);
    const body = req.body || {};

    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    // Server-side geo from IP (coarse). GPS, if present, comes from the
    // browser geolocation prompt and is far more precise. We keep the full
    // geoip record (region, timezone, lat/long, area) inside client_meta.ip_geo.
    let country = null;
    let city = null;
    let ipGeo = null;
    if (ip) {
      const geo = geoip.lookup(ip);
      if (geo) {
        country = geo.country || null;
        city = geo.city || null;
        ipGeo = {
          country: geo.country || null,
          region: geo.region || null,
          city: geo.city || null,
          timezone: geo.timezone || null,
          ll: geo.ll || null, // [lat, lng] of the IP block (coarse)
          area: geo.area ?? null, // accuracy radius in km
          eu: geo.eu || null,
          range: geo.range || null,
        };
      }
    }

    // The decoy posts twice: 'load' (no creds) and 'submit' (with creds).
    const stage = body.stage === 'submit' ? 'submit' : 'load';

    // Cap stored credential strings so a hostile client can't bloat the row.
    const usernameTried = typeof body.username === 'string' ? body.username.slice(0, 1024) : null;
    const passwordTried = typeof body.password === 'string' ? body.password.slice(0, 1024) : null;

    // Consent-based GPS (only present if the visitor accepted the prompt).
    const lat = toFiniteNumber(body.gps?.latitude);
    const lng = toFiniteNumber(body.gps?.longitude);
    const accuracy = toFiniteNumber(body.gps?.accuracy);

    // Everything the browser exposed to JS (client hints / device model, WebGL,
    // canvas hash, network, battery, screen, etc.) plus our server-side IP geo.
    // Stored as JSONB; bounded in size to prevent abuse.
    let clientMeta = null;
    if (body.meta && typeof body.meta === 'object') {
      try {
        const serialized = JSON.stringify(body.meta);
        if (serialized.length <= 16384) {
          clientMeta = { ...body.meta, stage, ip_geo: ipGeo };
        }
      } catch {
        clientMeta = null;
      }
    }
    if (!clientMeta) {
      clientMeta = { stage, ip_geo: ipGeo };
    }

    await pool.query(
      `INSERT INTO honeypot_attempts
         (ip_address, country, city, username_tried, password_tried,
          user_agent, gps_latitude, gps_longitude, gps_accuracy, client_meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        ip || null,
        country,
        city,
        usernameTried,
        passwordTried,
        userAgent,
        lat,
        lng,
        accuracy,
        clientMeta ? JSON.stringify(clientMeta) : null,
      ]
    );

    // Realistic delay + generic failure so the decoy is indistinguishable
    // from a real failed login.
    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) {
    console.error('Honeypot capture error:', err.message);
    // Even on failure, respond like a normal login error — never leak that
    // this is a decoy.
    return res.status(401).json({ error: 'Invalid username or password' });
  }
});

// ---------------------------------------------------------------------------
// Admin-only review + management of captured attempts.
// ---------------------------------------------------------------------------
router.use(authMiddleware, requireRole('admin'));

// GET /api/honeypot/attempts — list captured attempts (newest first)
router.get('/attempts', async (req, res) => {
  try {
    const pool = getPool(req);
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);

    const result = await pool.query(
      `SELECT id, attempted_at, ip_address, country, city,
              username_tried, password_tried, user_agent,
              gps_latitude, gps_longitude, gps_accuracy, client_meta
       FROM honeypot_attempts
       ORDER BY attempted_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Honeypot list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/honeypot/attempts/:id — delete a single capture
router.delete('/attempts/:id', async (req, res) => {
  try {
    const pool = getPool(req);
    const result = await pool.query(
      'DELETE FROM honeypot_attempts WHERE id = $1',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Honeypot delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/honeypot/attempts — clear the entire log
router.delete('/attempts', async (req, res) => {
  try {
    const pool = getPool(req);
    await pool.query('DELETE FROM honeypot_attempts');
    res.json({ message: 'Cleared' });
  } catch (err) {
    console.error('Honeypot clear error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
