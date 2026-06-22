# RoutesMapper

URL route management platform — create routes that serve PDFs, images, videos, redirects, and video links, with an admin panel for management.

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS 4 + React Router 7
- **Backend**: Node.js + Express 4 + PostgreSQL (pg driver)
- **Auth**: JWT (bcryptjs for hashing, jsonwebtoken for tokens)
- **File uploads**: Multer (UUID filenames, 500MB limit)
- **Infra**: Docker Compose (Postgres 16, Nginx reverse proxy)

## Project Structure

```
backend/
  src/
    index.js              # Entry point, DB pool, migration runner, Express setup
    middleware/auth.js     # JWT Bearer token verification
    routes/auth.js        # /api/auth/* — login, setup, status, me
    routes/admin.js       # /api/admin/* — CRUD for routes & templates (auth-protected)
    routes/public.js      # /api/public/:slug — public route serving
    migrations/init.sql   # DB schema (users, templates, routes tables)
  uploads/                # Uploaded files (UUID-named)

frontend/src/
  App.jsx                 # Router: admin routes (protected) + public /:slug
  contexts/AuthContext.jsx # Auth state, JWT storage, apiFetch wrapper
  components/
    Layout.jsx            # Admin sidebar + responsive shell
    ContentViewer.jsx     # Public viewers: PdfViewer, ImageViewer, VideoLinkViewer, VideoFileViewer, DisabledView, NotFoundView
  pages/
    Login/Login.jsx       # Login + first-run setup
    Admin/Dashboard.jsx   # Route list, search, toggle, delete
    Admin/RouteForm.jsx   # Create/edit route with file upload
    Admin/CsvImport.jsx   # Bulk CSV import with file upload staging
    Admin/Templates.jsx   # Template list
    Admin/TemplateForm.jsx # HTML/CSS template editor
    RouteViewer/RouteViewer.jsx # Public route fetcher + type router
  utils/csvParser.js      # CSV parsing with slug/type validation

nginx/nginx.conf          # Reverse proxy: /api/ + /uploads/ → backend, / → frontend
```

## Route Types

- `pdf`, `image`, `video_file` — require file upload
- `video_link` — requires YouTube/Vimeo URL
- `redirect` — requires destination URL

## Local Development

Backend and frontend run separately (no Docker needed locally):

```bash
# Backend (port 3006)
cd backend && npm run dev

# Frontend (port 5173, proxies /api to backend)
cd frontend && npm run dev
```

- Backend reads `backend/.env` (PORT, DATABASE_URL, JWT_SECRET)
- Frontend Vite proxy configured in `vite.config.js` → localhost:3006
- Frontend dev server binds to 0.0.0.0 for LAN access
- Local Postgres: user `postgres`, database `routesmapper`

## Docker Deployment

```bash
docker-compose up
```

- Backend runs on port 4000 inside Docker (not 3006)
- Nginx exposes on port 80 (configurable via APP_PORT)
- Root `.env` has Docker-specific vars (POSTGRES_USER, POSTGRES_PASSWORD, etc.)

## Key Patterns

- All SQL queries use parameterized placeholders ($1, $2...) — no string concatenation
- All admin routes protected by `router.use(authMiddleware)` in admin.js
- Setup endpoint uses SERIALIZABLE transaction to prevent race conditions
- `apiFetch()` from AuthContext auto-attaches JWT and handles FormData vs JSON content types
- Slug validation: lowercase alphanumeric + hyphens, reserved words blocked
- File uploads: validated by MIME type + extension, stored with UUID filenames
- CSS classes: `btn-primary`, `btn-secondary`, `btn-danger`, `card` defined in index.css

## Database

Three tables: `users`, `templates`, `routes` — schema in `backend/src/migrations/init.sql`. Auto-migrated on backend startup. Two default templates seeded (404 page, maintenance page).

## Testing

No test framework configured. Verify manually:
1. Start backend + frontend
2. Test admin login, route CRUD, CSV import, public route viewing
3. Test on mobile for video player and PDF viewer
