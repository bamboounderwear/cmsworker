-- Lightweight CMS schema (D1 / SQLite)

-- Users (Simple Auth) - SHA256 for now (not recommended for production password hashing)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL -- SHA256 hex string
);

-- Site Settings (Global Theme/Styles)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL -- JSON Blob
);

-- Pages / Content (simplified; template resolved from collection type config)
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,            -- URL path (e.g., 'about-us')
  type TEXT NOT NULL,                   -- Collection type (e.g., 'landing', 'blog')
  status TEXT NOT NULL DEFAULT 'draft'  -- 'draft' | 'published'
    CHECK (status IN ('draft', 'published')),
  data TEXT NOT NULL,                   -- JSON content blob
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
CREATE INDEX IF NOT EXISTS idx_pages_type ON pages(type);
CREATE INDEX IF NOT EXISTS idx_pages_updated_at ON pages(updated_at);

-- Optional: default home page (draft by default)
INSERT OR IGNORE INTO pages (slug, type, status, data)
VALUES (
  'home',
  'landing',
  'published',
  json_object(
    'hero_title', 'Hello from Lightweight CMS',
    'hero_subtitle', 'Edit this page in /admin',
    'hero_image', '',
    'body', 'This is a simple CMS running on Cloudflare Workers + D1 + R2.'
  )
);

-- Optional: default admin user (username: admin, password: admin123)
-- SHA-256("admin123") = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
INSERT OR IGNORE INTO users (username, password_hash)
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');
