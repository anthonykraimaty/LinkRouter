const express = require('express');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// All user-management routes require an authenticated admin
router.use(authMiddleware, requireRole('admin'));

const VALID_ROLES = ['admin', 'link_manager', 'analyst'];

function getPool(req) {
  return req.app.get('db');
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

// GET /users — List all users
router.get('/', async (req, res) => {
  try {
    const pool = getPool(req);
    const result = await pool.query(
      'SELECT id, username, role, must_change_password, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(result.rows.map(publicUser));
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users — Create a user (temp password, must change on first login)
router.post('/', async (req, res) => {
  try {
    const pool = getPool(req);
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: `Username "${username}" is already taken` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, true)
       RETURNING id, username, role, must_change_password, created_at`,
      [username, passwordHash, role]
    );

    res.status(201).json(publicUser(result.rows[0]));
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /users/:id/role — Change a user's role
router.patch('/:id/role', async (req, res) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const existing = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent demoting the last remaining admin
    if (existing.rows[0].role === 'admin' && role !== 'admin') {
      const adminCount = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
      if (adminCount.rows[0].count <= 1) {
        return res.status(409).json({ error: 'Cannot demote the last remaining admin' });
      }
    }

    const result = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, username, role, must_change_password, created_at`,
      [role, id]
    );

    res.json(publicUser(result.rows[0]));
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /users/:id/password — Admin resets a user's password (forces change on next login)
router.patch('/:id/password', async (req, res) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2',
      [passwordHash, id]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset user password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /users/:id — Delete a user
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(409).json({ error: 'You cannot delete your own account' });
    }

    const existing = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the last remaining admin
    if (existing.rows[0].role === 'admin') {
      const adminCount = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
      if (adminCount.rows[0].count <= 1) {
        return res.status(409).json({ error: 'Cannot delete the last remaining admin' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
