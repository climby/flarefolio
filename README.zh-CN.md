# Flarefolio — Cloudflare Pages + R2 图片画廊（Vue 3）

[English](README.md) | 简体中文

Vue 3（Vite + 组合式 API）版本的图片画廊：**R2 存原图、Pages 托管前端、Image Transformations 按需出图**。

**线上地址**：<https://pic.5201688.xyz>

## 功能

- 响应式图片网格（`srcset` 多档位 + 懒加载 + 骨架屏）
- 灯箱浏览（键盘 ←/→/Esc）
- 按文件名搜索（含计数）
- `#/admin` 上传页（token 鉴权，token 存浏览器 localStorage，拖拽上传）
- 极简 hash 路由（`#/` 画廊、`#/admin` 上传，无需 vue-router）
- `/api/images` 动态清单（R2 binding，60 秒缓存）
- `/api/upload` 鉴权上传（10MB 上限，可调）
- `scripts/gen-manifest.mjs` 静态清单方案（免运行时 list，省 Class A 操作）

## 实际部署配置

| 项目 | 值 |
|---|---|
| 站点 | `https://pic.5201688.xyz`（Pages 自定义域名） |
| R2 bucket | `img01` |
| R2 公开域名 | `https://s3img01.5201688.xyz`（原图直链） |
| R2 binding | `IMAGES`（由 `wrangler.toml` 声明，Git 构建自动应用） |
| 上传密钥 | `UPLOAD_TOKEN`（Pages production secret） |
| Transformations | 已对 zone `5201688.xyz` 启用（免费额度每月 5000 次 unique） |

## 快速开始

### 1. 创建 R2 bucket

```bash
npx wrangler r2 bucket create <your-bucket>
```

在 Dashboard → R2 → bucket → Settings 里打开 **Public access**，绑定自定义域名（如 `img.example.com`）。

### 2. 安装依赖

```bash
cd flarefolio
npm install
```

### 3. 配置

- `wrangler.toml`：`bucket_name` 改成你的 bucket 名；保留 `pages_build_output_dir = "dist"`（必需，见排障表）
- `src/config.js`：`IMG_BASE` 改成你的 R2 自定义域名
- 设置上传 token：
  ```bash
  npx wrangler pages secret put UPLOAD_TOKEN --project-name flarefolio
  ```

### 4. 图片清单（二选一）

**方案 A（推荐，动态）**：什么都不用做，前端优先请求 `/api/images`。

**方案 B（静态，更省）**：构建时生成 `public/images.json`（Vite 会原样拷贝到 `dist/`）：

```bash
R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx \
R2_BUCKET=<your-bucket> npm run manifest
```

### 5. 构建与部署

**Git 集成（推荐）**：推送到 GitHub 后，在 Dashboard → Workers & Pages → Create → **Pages** → Connect to Git 连接仓库。构建命令 `npm run build`，输出目录 `dist`。`wrangler.toml` 声明了 `pages_build_output_dir` 后，R2 binding 会在每次构建自动应用。

之后每次 `git push` 自动部署。

**直传部署**（不走 Git 集成）：

```bash
npm run deploy   # vite build + wrangler pages deploy dist
```

本地开发：

```bash
npm run dev          # 纯前端，Vite dev server
npm run pages:dev    # 全栈（含 Functions），需先 wrangler login
```

## 说明

- `/cdn-cgi/image/` 需要站点走**自定义域名**；`*.pages.dev` 预览域名下可能不生效，此时把 `src/config.js` 里 `USE_TRANSFORMATIONS` 设为 `false`
- Transformations 需按 zone 开启一次：Dashboard → **Images → Transformations** → 为你的 zone 启用。免费版每月 5000 次 unique transformation，超量新变换报 9422（前端已内置回退原图）
- Pages 的 secret 只对**设置之后的新部署**生效。更换 `UPLOAD_TOKEN` 后需触发新部署，并清除浏览器旧 token（`localStorage.removeItem('gallery_upload_token')`）

## 排障

| 症状 | 原因 / 解决 |
|---|---|
| 构建报 `Missing entry-point to Worker script` | `wrangler.toml` 缺 `pages_build_output_dir`；并确认项目是 **Pages** 而非 Worker |
| 发布时报 `R2 bucket '...' not found` | `wrangler.toml` 的 `bucket_name` 与实际 bucket 不符 |
| `No build command specified. Skipping build step.` | Pages → Settings → Build 里补构建命令 `npm run build` |
| 明明设置了 secret，上传仍报 `UPLOAD_TOKEN 未设置` | secret 设在当前部署之后（或设到了 Preview 环境）——对 Production 重设并重新部署 |
| curl 鉴权通过但 `#/admin` 上传报 `未授权` | 浏览器 localStorage 残留旧 token——清除后在 `#/admin` 重新输入 |
| 缩略图 404 | Transformations 未对 zone 启用，或站点经 `*.pages.dev` 访问——用自定义域名并在 Images → Transformations 启用 |

## 目录结构

```
flarefolio/
├── README.md                # 英文（GitHub 默认显示）
├── README.zh-CN.md          # 简体中文
├── wrangler.toml            # R2 binding + pages_build_output_dir
├── vite.config.js
├── index.html
├── src/
│   ├── main.js
│   ├── config.js            # 改这里：IMG_BASE 等
│   ├── App.vue              # 顶栏 + hash 路由
│   ├── lib/gallery.js       # 图片 URL / 清单加载
│   ├── assets/styles.css
│   └── components/
│       ├── GalleryView.vue  # 网格 + 搜索 + 灯箱
│       ├── Lightbox.vue
│       └── AdminView.vue    # 上传页
├── public/images.json       # 静态清单（方案 B）
├── functions/api/           # images.js / upload.js
└── scripts/gen-manifest.mjs
```
