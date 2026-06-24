const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// Link & template management is available to admins and link managers
router.use(authMiddleware, requireRole('admin', 'link_manager'));

// ---------------------------------------------------------------------------
// Multer configuration
// ---------------------------------------------------------------------------
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

const ALLOWED_MIMETYPES = new Set([
  // PDF
  'application/pdf',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Videos
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.mp4', '.webm', '.ogg', '.mov',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Ensure upload directory exists
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIMETYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.originalname} (${file.mimetype})`), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getPool(req) {
  return req.app.get('db');
}

// Note: 'home' is intentionally NOT reserved — the root path "/" serves the
// route with slug 'home', so it must be creatable from the panel.
const RESERVED_SLUGS = new Set([
  'admin', 'manage', 'api', 'uploads', 'favicon.ico', 'login', 'setup',
  'static', 'assets', 'public', 'health', 'status',
]);

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return 'Slug is required';
  }
  const normalized = slug.toLowerCase().trim();
  if (normalized.length < 1 || normalized.length > 255) {
    return 'Slug must be between 1 and 255 characters';
  }
  if (!SLUG_REGEX.test(normalized)) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing hyphens, no consecutive hyphens)';
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return `Slug "${normalized}" is reserved and cannot be used`;
  }
  return null;
}

function deleteFileIfExists(filePath) {
  if (!filePath) return;
  const fullPath = path.join(UPLOAD_DIR, path.basename(filePath));
  fs.unlink(fullPath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error(`Failed to delete file ${fullPath}:`, err.message);
    }
  });
}

// ---------------------------------------------------------------------------
// Routes CRUD
// ---------------------------------------------------------------------------

// GET /routes — List all routes with template info
router.get('/routes', async (req, res) => {
  try {
    const pool = getPool(req);
    const result = await pool.query(
      `SELECT r.*, t.name AS template_name, t.html_content AS template_html,
              t.css_content AS template_css
       FROM routes r
       LEFT JOIN templates t ON r.disabled_template_id = t.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List routes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /routes — Create route
router.post('/routes', upload.single('file'), async (req, res) => {
  try {
    const pool = getPool(req);
    const { slug, type, title, content_url, enabled, disabled_template_id, disabled_message } = req.body;

    // Validate type
    const validTypes = ['pdf', 'image', 'video_link', 'video_file', 'redirect'];
    if (!type || !validTypes.includes(type)) {
      if (req.file) deleteFileIfExists(req.file.filename);
      return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
    }

    // Validate slug
    const slugError = validateSlug(slug);
    if (slugError) {
      if (req.file) deleteFileIfExists(req.file.filename);
      return res.status(400).json({ error: slugError });
    }

    const normalizedSlug = slug.toLowerCase().trim();

    // Check slug uniqueness
    const existing = await pool.query('SELECT id FROM routes WHERE slug = $1', [normalizedSlug]);
    if (existing.rows.length > 0) {
      if (req.file) deleteFileIfExists(req.file.filename);
      return res.status(409).json({ error: `Slug "${normalizedSlug}" is already in use` });
    }

    // For file-based types, require a file upload
    const fileTypes = ['pdf', 'image', 'video_file'];
    let filePath = null;
    let originalFilename = null;

    if (fileTypes.includes(type)) {
      if (!req.file) {
        return res.status(400).json({ error: `File upload is required for type "${type}"` });
      }
      filePath = req.file.filename;
      originalFilename = req.file.originalname;
    }

    // For redirect and video_link types, require content_url
    if ((type === 'redirect' || type === 'video_link') && !content_url) {
      if (req.file) deleteFileIfExists(req.file.filename);
      return res.status(400).json({ error: `content_url is required for type "${type}"` });
    }

    const isEnabled = enabled === undefined || enabled === null
      ? true
      : (enabled === 'true' || enabled === true);

    const result = await pool.query(
      `INSERT INTO routes (slug, type, title, content_url, file_path, original_filename,
                           enabled, disabled_template_id, disabled_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        normalizedSlug,
        type,
        title || '',
        content_url || null,
        filePath,
        originalFilename,
        isEnabled,
        disabled_template_id || null,
        disabled_message || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (req.file) deleteFileIfExists(req.file.filename);
    console.error('Create route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /routes/:id — Get single route
router.get('/routes/:id', async (req, res) => {
  try {
    const pool = getPool(req);
    const result = await pool.query(
      `SELECT r.*, t.name AS template_name, t.html_content AS template_html,
              t.css_content AS template_css
       FROM routes r
       LEFT JOIN templates t ON r.disabled_template_id = t.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /routes/:id — Update route
router.put('/routes/:id', upload.single('file'), async (req, res) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;

    // Get existing route
    const existingResult = await pool.query('SELECT * FROM routes WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      if (req.file) deleteFileIfExists(req.file.filename);
      return res.status(404).json({ error: 'Route not found' });
    }

    const existing = existingResult.rows[0];
    const { slug, type, title, content_url, enabled, disabled_template_id, disabled_message } = req.body;

    // Validate type if provided
    const validTypes = ['pdf', 'image', 'video_link', 'video_file', 'redirect'];
    const newType = type || existing.type;
    if (type && !validTypes.includes(type)) {
      if (req.file) deleteFileIfExists(req.file.filename);
      return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
    }

    // Validate slug if provided and changed
    let normalizedSlug = existing.slug;
    if (slug !== undefined && slug !== null) {
      const slugError = validateSlug(slug);
      if (slugError) {
        if (req.file) deleteFileIfExists(req.file.filename);
        return res.status(400).json({ error: slugError });
      }
      normalizedSlug = slug.toLowerCase().trim();

      // Check slug uniqueness (exclude current route)
      if (normalizedSlug !== existing.slug) {
        const duplicateCheck = await pool.query(
          'SELECT id FROM routes WHERE slug = $1 AND id != $2',
          [normalizedSlug, id]
        );
        if (duplicateCheck.rows.length > 0) {
          if (req.file) deleteFileIfExists(req.file.filename);
          return res.status(409).json({ error: `Slug "${normalizedSlug}" is already in use` });
        }
      }
    }

    // Handle file replacement
    let filePath = existing.file_path;
    let originalFilename = existing.original_filename;

    if (req.file) {
      // Delete old file if it exists
      deleteFileIfExists(existing.file_path);
      filePath = req.file.filename;
      originalFilename = req.file.originalname;
    }

    const isEnabled = enabled === undefined || enabled === null
      ? existing.enabled
      : (enabled === 'true' || enabled === true);

    const result = await pool.query(
      `UPDATE routes SET
        slug = $1, type = $2, title = $3, content_url = $4,
        file_path = $5, original_filename = $6, enabled = $7,
        disabled_template_id = $8, disabled_message = $9,
        updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        normalizedSlug,
        newType,
        title !== undefined ? title : existing.title,
        content_url !== undefined ? (content_url || null) : existing.content_url,
        filePath,
        originalFilename,
        isEnabled,
        disabled_template_id !== undefined ? (disabled_template_id || null) : existing.disabled_template_id,
        disabled_message !== undefined ? (disabled_message || null) : existing.disabled_message,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    if (req.file) deleteFileIfExists(req.file.filename);
    console.error('Update route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /routes/:id — Delete route and associated file
router.delete('/routes/:id', async (req, res) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;

    const existing = await pool.query('SELECT * FROM routes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const route = existing.rows[0];

    // Delete the route record
    await pool.query('DELETE FROM routes WHERE id = $1', [id]);

    // Delete associated file if exists
    deleteFileIfExists(route.file_path);

    res.json({ message: 'Route deleted successfully' });
  } catch (err) {
    console.error('Delete route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /routes/:id/toggle — Toggle enabled/disabled
router.patch('/routes/:id/toggle', async (req, res) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE routes SET enabled = NOT enabled, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Toggle route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Templates CRUD
// ---------------------------------------------------------------------------

// GET /templates — List all templates
router.get('/templates', async (req, res) => {
  try {
    const pool = getPool(req);
    const result = await pool.query('SELECT * FROM templates ORDER BY is_default DESC, created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /templates — Create template
router.post('/templates', async (req, res) => {
  try {
    const pool = getPool(req);
    const { name, html_content, css_content } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const result = await pool.query(
      `INSERT INTO templates (name, html_content, css_content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), html_content || '', css_content || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /templates/:id — Get single template
router.get('/templates/:id', async (req, res) => {
  try {
    const pool = getPool(req);
    const result = await pool.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /templates/:id — Update template
router.put('/templates/:id', async (req, res) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;
    const { name, html_content, css_content } = req.body;

    const existing = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const current = existing.rows[0];

    const result = await pool.query(
      `UPDATE templates SET
        name = $1, html_content = $2, css_content = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        name !== undefined ? name : current.name,
        html_content !== undefined ? html_content : current.html_content,
        css_content !== undefined ? css_content : current.css_content,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /templates/:id — Delete template (only if not default and not in use)
router.delete('/templates/:id', async (req, res) => {
  try {
    const pool = getPool(req);
    const { id } = req.params;

    const existing = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = existing.rows[0];

    if (template.is_default) {
      return res.status(403).json({ error: 'Cannot delete a default template' });
    }

    // Check if template is in use by any route
    const inUse = await pool.query(
      'SELECT id, slug FROM routes WHERE disabled_template_id = $1 LIMIT 1',
      [id]
    );
    if (inUse.rows.length > 0) {
      return res.status(409).json({
        error: 'Cannot delete template because it is in use by one or more routes',
        route: inUse.rows[0].slug,
      });
    }

    await pool.query('DELETE FROM templates WHERE id = $1', [id]);

    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// File upload endpoint
// ---------------------------------------------------------------------------

// POST /upload — Upload file, return path info
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.status(201).json({
      filePath: req.file.filename,
      originalFilename: req.file.originalname,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Multer error handler
// ---------------------------------------------------------------------------
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File size exceeds the 500 MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message && err.message.startsWith('File type not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
