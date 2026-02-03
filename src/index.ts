import { Hono } from "hono";
import type { Env } from "./env";
import { collections } from "./config/collections";
import { AuthError, requireBasicAuth } from "./auth";
import { renderPageHtml } from "./renderer";

type Bindings = { Bindings: Env };

const app = new Hono<Bindings>();

/**
 * 0) Static assets passthrough
 * - Blocks direct access to /_templates and /_blocks
 * - Serves anything that exists in /public first (admin, css, js, images...)
 */
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);

  // Never serve internal template/block folders publicly
  if (url.pathname.startsWith("/_templates/") || url.pathname.startsWith("/_blocks/")) {
    return c.notFound();
  }

  // Don't intercept API/media routes
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) {
    return next();
  }

  // Try serve a static asset first
  const assetRes = await c.env.ASSETS.fetch(c.req.raw);
  if (assetRes.status !== 404) return assetRes;

  return next();
});

/**
 * 1) Media serving from R2
 * - Upload API returns /media/<key>
 */
app.get("/media/*", async (c) => {
  const key = c.req.path.replace("/media/", "");
  const obj = await c.env.MEDIA_BUCKET.get(key);
  if (!obj) return c.notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);

  // A bit of caching is usually fine for media
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(obj.body, { headers });
});

/**
 * 2) Admin entry convenience
 */
app.get("/admin", (c) => c.redirect("/admin/index.html"));

/**
 * 3) Admin API (Basic Auth with SHA256)
 */
app.use("/api/*", async (c, next) => {
  try {
    const auth = c.req.header("Authorization");
    await requireBasicAuth(c.env, auth);
    return next();
  } catch (err) {
    if (err instanceof AuthError) {
      c.header("WWW-Authenticate", 'Basic realm="lightweight-cms"');
      return c.json({ error: "Unauthorized", message: err.message }, 401);
    }
    return c.json({ error: "ServerError" }, 500);
  }
});

// Config for admin UI
app.get("/api/config", (c) => {
  return c.json({ collections });
});

// List pages (for admin UI)
app.get("/api/pages", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT slug, type, status, created_at, updated_at
     FROM pages
     ORDER BY updated_at DESC`
  ).all();

  return c.json({ pages: rows.results });
});

// Get a single page by slug
app.get("/api/pages/:slug", async (c) => {
  const slug = c.req.param("slug");
  const row = await c.env.DB.prepare(
    `SELECT slug, type, status, data, created_at, updated_at
     FROM pages
     WHERE slug = ?
     LIMIT 1`
  ).bind(slug).first();

  if (!row) return c.json({ error: "NotFound" }, 404);

  return c.json({
    slug: row.slug,
    type: row.type,
    status: row.status,
    data: JSON.parse(String(row.data)),
    created_at: row.created_at,
    updated_at: row.updated_at
  });
});

/**
 * Render helpers for the editor page
 * - GET /api/render/:slug renders an existing page (draft or published) for preview
 * - POST /api/render renders unsaved edits (type + data) for live preview
 */
app.get("/api/render/:slug", async (c) => {
  const slug = c.req.param("slug");

  const row = await c.env.DB.prepare(
    `SELECT slug, type, status, data
     FROM pages
     WHERE slug = ?
     LIMIT 1`
  ).bind(slug).first<{
    slug: string;
    type: string;
    status: string;
    data: string;
  }>();

  if (!row) return c.text("Not Found", 404);

  const collection = collections[row.type];
  if (!collection) return c.text("Invalid page type", 500);

  const pageData = JSON.parse(row.data || "{}");

  const html = await renderPageHtml(c.env, {
    templateFile: collection.template,
    data: pageData
  });

  return c.html(html);
});

app.post("/api/render", async (c) => {
  const body = await c.req.json<{
    type: string;
    data?: Record<string, any>;
  }>();

  const type = (body.type || "").trim();
  if (!type) return c.json({ error: "ValidationError", message: "type is required" }, 400);

  const collection = collections[type];
  if (!collection) return c.json({ error: "ValidationError", message: "invalid type" }, 400);

  const data = body.data ?? {};

  const html = await renderPageHtml(c.env, {
    templateFile: collection.template,
    data
  });

  return c.html(html);
});

// Create/update page (UPSERT + updated_at)
app.post("/api/pages", async (c) => {
  const body = await c.req.json<{
    slug: string;
    type: string;
    status?: "draft" | "published";
    data?: Record<string, any>;
  }>();

  const slug = (body.slug || "").trim().replace(/^\/+|\/+$/g, "");
  const type = (body.type || "").trim();
  const status = body.status ?? "draft";
  const data = body.data ?? {};

  if (!slug) return c.json({ error: "ValidationError", message: "slug is required" }, 400);
  if (!type) return c.json({ error: "ValidationError", message: "type is required" }, 400);
  if (!collections[type]) return c.json({ error: "ValidationError", message: "invalid type" }, 400);
  if (status !== "draft" && status !== "published") {
    return c.json({ error: "ValidationError", message: "invalid status" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO pages (slug, type, status, data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       type = excluded.type,
       status = excluded.status,
       data = excluded.data,
       updated_at = unixepoch()`
  )
    .bind(slug, type, status, JSON.stringify(data))
    .run();

  return c.json({ success: true });
});

// Delete page
app.delete("/api/pages/:slug", async (c) => {
  const slug = c.req.param("slug");
  await c.env.DB.prepare("DELETE FROM pages WHERE slug = ?").bind(slug).run();
  return c.json({ success: true });
});

// Upload to R2
app.put("/api/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"] as File | undefined;

  if (!file) return c.json({ error: "ValidationError", message: "file is required" }, 400);

  const safeName = (file.name || "file").replace(/[^\w.\-]+/g, "_");
  const key = `uploads/${Date.now()}_${safeName}`;

  await c.env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" }
  });

  return c.json({ url: `/media/${key}` });
});

/**
 * 4) Public renderer
 * - Only renders published pages
 * - Template is resolved from collections[type].template
 */
app.get("/:slug?", async (c) => {
  const slug = (c.req.param("slug") || "home").trim();

  const row = await c.env.DB.prepare(
    `SELECT slug, type, status, data
     FROM pages
     WHERE slug = ?
     LIMIT 1`
  ).bind(slug).first<{
    slug: string;
    type: string;
    status: string;
    data: string;
  }>();

  if (!row) return c.text("404 Not Found", 404);
  if (row.status !== "published") return c.text("404 Not Found", 404);

  const collection = collections[row.type];
  if (!collection) return c.text("Invalid page type", 500);

  const pageData = JSON.parse(row.data || "{}");

  const html = await renderPageHtml(c.env, {
    templateFile: collection.template,
    data: pageData
  });

  return c.html(html);
});

export default app;
