-- ============================================================
-- RoutesMapper: Database initialization migration
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------
-- users table
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin'
    CHECK (role IN ('admin', 'link_manager', 'analyst')),
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add role/must_change_password columns to pre-existing databases
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Ensure the role CHECK constraint exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'link_manager', 'analyst'));
  END IF;
END $$;

-- -----------------------------------------------------------
-- templates table (for disabled route pages)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL DEFAULT '',
  css_content TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- routes table
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('pdf', 'image', 'video_link', 'video_file', 'redirect')),
  title VARCHAR(255) NOT NULL DEFAULT '',
  content_url TEXT,
  file_path TEXT,
  original_filename VARCHAR(255),
  enabled BOOLEAN DEFAULT true,
  disabled_template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  disabled_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- route_views table (analytics: one row per public link open)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  country VARCHAR(100),
  city VARCHAR(150),
  user_agent TEXT
);

-- Index to speed up per-route lookups and time-bucketed aggregations
CREATE INDEX IF NOT EXISTS idx_route_views_route_id ON route_views (route_id);
CREATE INDEX IF NOT EXISTS idx_route_views_viewed_at ON route_views (viewed_at);
CREATE INDEX IF NOT EXISTS idx_route_views_route_viewed ON route_views (route_id, viewed_at);

-- -----------------------------------------------------------
-- Seed default templates (only if they don't already exist)
-- -----------------------------------------------------------
INSERT INTO templates (name, html_content, css_content, is_default)
SELECT
  'Page Not Found',
  '<div class="error-page">
  <div class="error-container">
    <h1 class="error-code">404</h1>
    <h2 class="error-title">Page Not Found</h2>
    <p class="error-message">The page you are looking for does not exist or has been removed.</p>
    <a href="/" class="error-link">Go Home</a>
  </div>
</div>',
  '.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 20px;
}
.error-container {
  text-align: center;
  max-width: 500px;
}
.error-code {
  font-size: 120px;
  font-weight: 800;
  color: #dee2e6;
  margin: 0;
  line-height: 1;
}
.error-title {
  font-size: 28px;
  color: #343a40;
  margin: 16px 0 8px;
}
.error-message {
  font-size: 16px;
  color: #6c757d;
  margin: 0 0 32px;
  line-height: 1.5;
}
.error-link {
  display: inline-block;
  padding: 12px 32px;
  background: #343a40;
  color: #fff;
  text-decoration: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}
.error-link:hover {
  background: #495057;
}',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE name = 'Page Not Found' AND is_default = true
);

INSERT INTO templates (name, html_content, css_content, is_default)
SELECT
  'Under Maintenance',
  '<div class="maintenance-page">
  <div class="maintenance-container">
    <div class="maintenance-icon">&#9881;</div>
    <h1 class="maintenance-title">Under Maintenance</h1>
    <p class="maintenance-message">We are currently performing scheduled maintenance. We will be back online shortly.</p>
    <div class="maintenance-divider"></div>
    <p class="maintenance-sub">Thank you for your patience.</p>
  </div>
</div>',
  '.maintenance-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 20px;
}
.maintenance-container {
  text-align: center;
  max-width: 520px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 48px 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.maintenance-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: spin 4s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.maintenance-title {
  font-size: 32px;
  color: #2d3748;
  margin: 0 0 12px;
  font-weight: 700;
}
.maintenance-message {
  font-size: 16px;
  color: #4a5568;
  margin: 0 0 24px;
  line-height: 1.6;
}
.maintenance-divider {
  width: 60px;
  height: 3px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin: 0 auto 24px;
  border-radius: 2px;
}
.maintenance-sub {
  font-size: 14px;
  color: #718096;
  margin: 0;
  font-style: italic;
}',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE name = 'Under Maintenance' AND is_default = true
);
