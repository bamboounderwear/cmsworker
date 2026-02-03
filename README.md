# lightweight-cms (Cloudflare Workers + D1 + R2)

A minimal CMS that renders static HTML templates and blocks from **Workers Static Assets** via the `ASSETS` binding,
while content lives in **D1** and media uploads go to **R2**.

## Quick start

1) Install dependencies
```bash
npm i
```

2) Create D1 + R2 (once)
```bash
wrangler d1 create my-cms-db
wrangler r2 bucket create my-cms-media
```

3) Update `wrangler.jsonc`
- Paste your D1 `database_id` into `wrangler.jsonc`.

4) Initialize schema & seed default content/user
```bash
wrangler d1 execute my-cms-db --file=./schema.sql
```

5) Run locally
```bash
npm run dev
```

Open:
- Public site: http://localhost:8787/
- Admin: http://localhost:8787/admin

## Default admin credentials
- Username: `admin`
- Password: `admin123`

The Admin uses **Basic Auth** and stores the header in localStorage.

## Deploy
```bash
npm run deploy
```

## Notes
- Password hashing is SHA-256 (as requested). This is **not recommended** for production.
- Templates/blocks are stored in `public/_templates` and `public/_blocks` and are fetched server-side via `ASSETS`.


## Editor page
- Pages list: `/admin/index.html`
- Editor: `/admin/editor.html?slug=home` or click “Open editor” from the list.
- Live preview uses `/api/render` and renders drafts without publishing.
