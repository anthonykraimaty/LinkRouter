const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = '7d';

function getPool(req) {
  return req.app.get('db');
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    must_change_password: user.must_change_password,
    created_at: user.created_at,
  };
}

// GET /api/auth/status — Public endpoint to check if setup is needed
router.get('/status', async (req, res) => {
  try {
    const pool = getPool(req);
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const needsSetup = parseInt(countResult.rows[0].count, 10) === 0;
    res.json({ needsSetup });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/setup — Create admin user (only if no users exist)
router.post('/setup', async (req, res) => {
  try {
    const pool = getPool(req);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Atomic check-and-insert: only inserts if no users exist, using a serializable transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      const countResult = await client.query('SELECT COUNT(*) FROM users');
      if (parseInt(countResult.rows[0].count, 10) > 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Setup has already been completed' });
      }

      const result = await client.query(
        `INSERT INTO users (username, password_hash, role, must_change_password)
         VALUES ($1, $2, 'admin', false)
         RETURNING id, username, role, must_change_password, created_at`,
        [username, passwordHash]
      );

      await client.query('COMMIT');

      const user = result.rows[0];
      const token = signToken(user);

      res.status(201).json({ token, user: publicUser(user) });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login — Validate credentials, return JWT
router.post('/login', async (req, res) => {
  try {
    const pool = getPool(req);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await pool.query(
      `SELECT id, username, password_hash, role, must_change_password, created_at
       FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user);

    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me — Protected route, returns user info + needsSetup
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pool = getPool(req);

    const userResult = await pool.query(
      'SELECT id, username, role, must_change_password, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const needsSetup = parseInt(countResult.rows[0].count, 10) === 0;

    const user = userResult.rows[0];

    res.json({ user: publicUser(user), needsSetup });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-password — Change own password (any authenticated user)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const pool = getPool(req);
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const userResult = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [newHash, user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
