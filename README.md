# Flarefolio — Cloudflare Pages + R2 Image Gallery (Vue 3)

English | [简体中文](README.zh-CN.md)

A Vue 3 (Vite + Composition API) image gallery: **R2 stores originals, Pages hosts the frontend, Image Transformations serve resized images on demand**.

**Live site**: <https://pic.5201688.xyz>

## Features

- Responsive image grid (`srcset` multi-width + lazy loading + skeleton screens)
- Lightbox viewer (keyboard ←/→/Esc)
- Search by filename (with count)
- `#/admin` upload page (token auth, token kept in browser localStorage, drag & drop upload)
- Minimal hash routing (`#/` gallery, `#/admin` upload — no vue-router needed)
- `/api/images` dynamic manifest (R2 binding, 60s cache)
- `/api/upload` authenticated upload (10MB limit, configurable)
- `scripts/gen-manifest.mjs` static manifest option (no runtime `list`, saves Class A operations)

## Actual deployment configuration

| Item | Value |
|---|---|
| Site | `https://pic.5201688.xyz` (Pages custom domain) |
| R2 bucket | `img01` |
| R2 public domain | `https://s3img01.5201688.xyz` (originals) |
| R2 binding | `IMAGES` (from `wrangler.toml`, applied automatically by Git builds) |
| Upload secret | `UPLOAD_TOKEN` (Pages production secret) |
| Transformations | Enabled for zone `5201688.xyz` (free tier: 5,000 unique/month) |

## Quick start

### 1. Create an R2 bucket

```bash
npx wrangler r2 bucket create <your-bucket>
```

In Dashboard → R2 → bucket → Settings, enable **Public access** and connect a custom domain (e.g. `img.example.com`).

### 2. Install dependencies

```bash
cd flarefolio
npm install
```

### 3. Configure

- `wrangler.toml`: set `bucket_name` and keep `pages_build_output_dir = "dist"` (required — see Troubleshooting)
- `src/config.js`: set `IMG_BASE` to your R2 custom domain
- Set the upload token:
  ```bash
  npx wrangler pages secret put UPLOAD_TOKEN --project-name flarefolio
  ```

### 4. Image manifest (choose one)

**Option A (recommended, dynamic)**: do nothing — the frontend requests `/api/images` first.

**Option B (static, cheaper)**: generate `public/images.json` at build time (Vite copies it to `dist/` as-is):

```bash
R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx \
R2_BUCKET=<your-bucket> npm run manifest
```

### 5. Build & deploy

**Git integration (recommended)**: push to GitHub, connect the repo in Dashboard → Workers & Pages → Create → **Pages** → Connect to Git. Build command `npm run build`, build output directory `dist`. With `pages_build_output_dir` declared in `wrangler.toml`, the R2 binding is applied automatically on every build.

After that, every `git push` deploys automatically.

**Direct upload** (no Git integration):

```bash
npm run deploy   # vite build + wrangler pages deploy dist
```

Local development:

```bash
npm run dev         # frontend only, Vite dev server
npm run pages:dev   # full stack (with Functions), requires wrangler login
```

## Notes

- `/cdn-cgi/image/` requires the site to be served from a **custom domain**; it may not work on `*.pages.dev` preview domains. Set `USE_TRANSFORMATIONS = false` in `src/config.js` in that case.
- Enable Image Transformations once per zone: Dashboard → **Images → Transformations** → Enable for your zone. Free tier: 5,000 unique transformations/month; exceeding quota returns error 9422 (the frontend falls back to originals).
- Pages secrets only take effect on deployments created **after** the secret was set. After changing `UPLOAD_TOKEN`, trigger a new deployment and clear the old token from the browser (`localStorage.removeItem('gallery_upload_token')`).

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Build error `Missing entry-point to Worker script` | `wrangler.toml` lacks `pages_build_output_dir` — declare it, and make sure the project is a **Pages** project, not a Worker |
| `R2 bucket '...' not found` at publish | `bucket_name` in `wrangler.toml` doesn't match an existing bucket |
| `No build command specified. Skipping build step.` | Set build command `npm run build` in Pages → Settings → Build |
| Upload returns `UPLOAD_TOKEN 未设置` despite being set | Secret was set after the current deployment, or set on Preview instead of Production — re-set for Production and redeploy |
| Upload returns `未授权` in the admin page but curl works | Browser localStorage holds a stale token — clear and re-enter it on `#/admin` |
| Thumbnails 404 | Transformations not enabled for the zone, or site accessed via `*.pages.dev` — use the custom domain and enable the zone in Images → Transformations |

## Directory structure

```
flarefolio/
├── README.md                # English (default)
├── README.zh-CN.md          # 简体中文
├── wrangler.toml            # R2 binding + pages_build_output_dir
├── vite.config.js
├── index.html
├── src/
│   ├── main.js
│   ├── config.js            # IMG_BASE etc.
│   ├── App.vue              # Top bar + hash routing
│   ├── lib/gallery.js       # Image URLs / manifest loading
│   ├── assets/styles.css
│   └── components/
│       ├── GalleryView.vue  # Grid + search + lightbox
│       ├── Lightbox.vue
│       └── AdminView.vue    # Upload page
├── public/images.json       # Static manifest (Option B)
├── functions/api/           # images.js / upload.js
└── scripts/gen-manifest.mjs
```
