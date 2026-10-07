# Flarefolio — Cloudflare Pages + R2 图片画廊（Vue 3）

Vue 3（Vite + 组合式 API）版本的图片画廊：**R2 存原图、Pages 托管前端、Image Transformations 按需出图**。

## 功能

- 响应式图片网格（`srcset` 多档位 + 懒加载 + 骨架屏）
- 灯箱浏览（键盘 ←/→/Esc）
- 按文件名搜索（含计数）
- `#/admin` 上传页（token 鉴权，token 存浏览器 localStorage，拖拽上传）
- 极简 hash 路由（`#/` 画廊、`#/admin` 上传，无需 vue-router）
- `/api/images` 动态清单（R2 binding，60 秒缓存）
- `/api/upload` 鉴权上传（10MB 上限，可调）
- `scripts/gen-manifest.mjs` 静态清单方案（免运行时 list，省 Class A 操作）

## 快速开始

### 1. 创建 R2 bucket

```bash
npx wrangler r2 bucket create gallery-images
```

在 Dashboard → R2 → bucket → Settings 里打开 **Public access**，绑定自定义域名（如 `img.example.com`）。

### 2. 安装依赖

```bash
cd flarefolio
npm install
```

### 3. 配置

- `wrangler.toml`：`bucket_name` 改成你的 bucket 名
- `src/config.js`：`IMG_BASE` 改成你的 R2 自定义域名
- 设置上传 token：
  ```bash
  npx wrangler pages secret put UPLOAD_TOKEN
  ```

### 4. 图片清单（二选一）

**方案 A（推荐，动态）**：什么都不用做，前端优先请求 `/api/images`。

**方案 B（静态，更省）**：构建时生成 `public/images.json`（Vite 会原样拷贝到 `dist/`）：

```bash
R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx \
R2_BUCKET=gallery-images npm run manifest
```

### 5. 构建与部署

```bash
npm run deploy   # vite build + wrangler pages deploy dist
```

本地开发：
```bash
npm run dev          # 纯前端，Vite dev server
npm run pages:dev    # 全栈（含 Functions），需先 wrangler login
```

Git 集成部署：构建命令 `npm run build`，输出目录 `dist`。

## 说明

- `/cdn-cgi/image/` 需要站点走**自定义域名**；`*.pages.dev` 预览域名下可能不生效，此时把 `src/config.js` 里 `USE_TRANSFORMATIONS` 设为 `false`
- Transformations 免费版每月 5000 次 unique transformation，超量新变换报 9422（前端已内置回退原图）
- 大文件直传、EXIF、私有画廊等进阶话题见原版 README

## 目录结构

```
flarefolio/
├── wrangler.toml
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
├── functions/api/           # images.js / upload.js（同原版）
└── scripts/gen-manifest.mjs
```
