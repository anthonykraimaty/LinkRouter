const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Load .env for local development; in Docker env vars are passed directly
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const analyticsRoutes = require('./routes/analytics');
const usersRoutes = require('./routes/users');
const honeypotRoutes = require('./routes/honeypot');

const PORT = parseInt(process.env.PORT, 10) || 4000;
const DATABASE_URL = process.env.DATABASE_URL;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// PostgreSQL connection pool
// ---------------------------------------------------------------------------
const pool = new Pool({
  connectionString: DATABASE_URL,
  // Retry-friendly settings for Docker startup ordering
  connectionTimeoutMillis: 5000,
  max: 20,
});

// ---------------------------------------------------------------------------
// Run database migrations
// ---------------------------------------------------------------------------
async function runMigrations() {
  const migrationPath = path.join(__dirname, 'migrations', 'init.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  let retries = 10;
  while (retries > 0) {
    try {
      await pool.query(sql);
      console.log('Database migrations completed successfully');
      return;
    } catch (err) {
      retries -= 1;
      if (retries === 0) {
        console.error('Failed to run migrations after all retries:', err.message);
        throw err;
      }
      console.log(`Database not ready, retrying in 2s... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// Trust the reverse proxy (Nginx) so req.ip reflects the real client IP
// from X-Forwarded-For rather than the proxy's address.
app.set('trust proxy', true);

// Make the database pool available to route handlers
app.set('db', pool);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
app.use('/api/admin/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/honeypot', honeypotRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function start() {
  try {
    await runMigrations();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`RoutesMapper backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
