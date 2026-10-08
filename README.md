# Flarefolio — Cloudflare Pages + R2 Art Gallery (Vue 3)

English | [简体中文](README.zh-CN.md)

A Vue 3 (Vite + Composition API) art gallery: **R2 stores originals, D1 holds metadata, Pages hosts the frontend, Image Transformations serve resized images on demand, Zero Trust Access guards the admin**.

**Live site**: <https://pic.5201688.xyz>

## Features

- Artwork metadata: title, medium, notes, tags (D1), with aspect-ratio placeholders
- Responsive image grid (`srcset` multi-width + lazy loading) with hover metadata overlay
- Search by title / medium / tag
- Lightbox viewer (keyboard ←/→/Esc)
- `#/admin` upload page **behind Cloudflare Access** (email one-time-code login — no passwords, no tokens)
- Two-step publish: file → R2, then metadata → D1
- Tailwind CSS v4
- `/api/artworks` public manifest (D1, 60s cache), `/api/images` R2 fallback

## Actual deployment configuration

| Item | Value |
|---|---|
| Site | `https://pic.5201688.xyz` (Pages custom domain) |
| R2 bucket | `img01`, public domain `https://s3img01.5201688.xyz` |
| D1 database | `gallery-db` (tables: `artworks`, `tags`, `artwork_tags` — see `schema.sql`) |
| Admin auth | Cloudflare Access (team `mdengfeng`), protects `/admin` and `/api/admin` |
| Transformations | Enabled for zone `5201688.xyz` (free tier: 5,000 unique/month) |

## Quick start

### 1. Cloudflare resources

```bash
npx wrangler r2 bucket create <your-bucket>        # + Public access custom domain
npx wrangler d1 create gallery-db                   # note the database_id
npx wrangler d1 execute gallery-db --remote --file=./schema.sql
```

### 2. Configure

- `wrangler.toml`: `bucket_name`, `pages_build_output_dir = "dist"`, `database_id`, `CF_ACCESS_TEAM` / `CF_ACCESS_AUD`
- `src/config.js`: `IMG_BASE` = your R2 custom domain

### 3. Zero Trust Access (admin auth, replaces tokens)

1. <https://one.dash.cloudflare.com> → **Access → Applications → Add → Self-hosted**
2. Public hostnames (two entries, **paths must be set — empty path protects the whole domain**):
   | Domain | Path |
   |---|---|
   | `yourdomain.com` | `/admin` |
   | `yourdomain.com` | `/api/admin` |
3. Policy: Allow → Include → Emails → your email
4. Copy the **Application ID (AUD)** into `wrangler.toml`

> Access must be on the **custom domain** — `*.pages.dev` hostnames cause a login loop.

### 4. Deploy

Push to GitHub → Pages builds automatically (`npm run build` → `dist`; R2/D1 bindings and vars come from `wrangler.toml`).

```bash
npm run dev          # frontend only
npm run pages:dev    # full stack (local)
```

## How auth works

- `/admin` and `/api/admin/*` sit behind a Cloudflare Access application (email OTP, session persists per device)
- `functions/api/admin/_middleware.js` verifies the `Cf-Access-Jwt-Assertion` JWT (JWKS + RS256 signature + iss/aud/exp) on every admin request
- A legacy Bearer `UPLOAD_TOKEN` channel remains in the middleware as an emergency fallback

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Build error `Missing entry-point` | `wrangler.toml` lacks `pages_build_output_dir`, or the project was created as a Worker instead of Pages |
| Deployment fails right after adding `[vars]` | `[vars]` overrides dashboard-set secrets — add `keep_vars = true` or remove the dashboard secret |
| Pushes stop triggering builds | GitHub App lost repository access — GitHub → Settings → Applications → Cloudflare Pages → re-grant the repo |
| `/admin` shows no Access login | Access app path is empty (= whole domain) or set on `*.pages.dev`; use the custom domain with explicit `/admin` path |
| Whole site redirects to login | An Access hostname entry has an **empty path** — delete it, keep only `/admin` and `/api/admin` |
| Upload page shows old UI | Browser cached the old bundle — hard refresh (Ctrl+Shift+R) |
| `R2 bucket '...' not found` at publish | `bucket_name` in `wrangler.toml` doesn't match an existing bucket |

## Directory structure

```
flarefolio/
├── README.md                # English (default)
├── README.zh-CN.md          # 简体中文
├── schema.sql               # D1 tables
├── wrangler.toml            # bindings + vars + pages_build_output_dir
├── src/
│   ├── config.js            # IMG_BASE etc.
│   ├── lib/gallery.js       # data loading, image URLs
│   └── components/
│       ├── GalleryView.vue  # grid + search + lightbox
│       ├── Lightbox.vue
│       └── AdminView.vue    # metadata form + two-step publish
├── functions/api/
│   ├── artworks.js          # GET public list (D1)
│   ├── images.js           # GET R2 fallback
│   └── admin/
│       ├── _middleware.js  # Access JWT verification
│       ├── _access.js       # JWT/JWKS helpers (not a route)
│       ├── upload.js        # POST file → R2
│       └── artworks/         # POST create · PATCH/DELETE by id
└── scripts/gen-manifest.mjs
```
