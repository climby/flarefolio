# Flarefolio — Cloudflare Pages + R2 画作画廊（Vue 3）

[English](README.md) | 简体中文

Vue 3（Vite + 组合式 API）版本的画作画廊：**R2 存原图、D1 存元数据、Pages 托管前端、Image Transformations 按需出图、Zero Trust Access 保护后台**。

**线上地址**：<https://pic.5201688.xyz>

## 功能

- 画作元数据：标题、材质、心得、标签（存 D1），宽高比占位防闪烁
- 响应式网格（`srcset` 多档位 + 懒加载），hover 显示元信息
- 按标题 / 材质 / 标签搜索
- 灯箱浏览（键盘 ←/→/Esc）
- `#/admin` 上传页**由 Cloudflare Access 保护**（邮箱验证码登录——无密码、无 token）
- 两步发布：文件 → R2，元数据 → D1
- Tailwind CSS v4
- `/api/artworks` 公开清单（D1，60 秒缓存），`/api/images` R2 回退

## 实际部署配置

| 项目 | 值 |
|---|---|
| 站点 | `https://pic.5201688.xyz`（Pages 自定义域名） |
| R2 bucket | `img01`，公开域名 `https://s3img01.5201688.xyz` |
| D1 数据库 | `gallery-db`（表：`artworks` / `tags` / `artwork_tags`，见 `schema.sql`） |
| 后台鉴权 | Cloudflare Access（团队 `mdengfeng`），保护 `/admin` 与 `/api/admin` |
| Transformations | 已对 zone `5201688.xyz` 启用（免费 5000 次 unique/月） |

## 快速开始

### 1. 开通 Cloudflare 资源

```bash
npx wrangler r2 bucket create <your-bucket>        # 并在 Dashboard 绑定公开域名
npx wrangler d1 create gallery-db                  # 记下 database_id
npx wrangler d1 execute gallery-db --remote --file=./schema.sql
```

### 2. 配置

- `wrangler.toml`：`bucket_name`、`pages_build_output_dir = "dist"`、`database_id`、`CF_ACCESS_TEAM` / `CF_ACCESS_AUD`
- `src/config.js`：`IMG_BASE` 改成你的 R2 自定义域名

### 3. 配置 Zero Trust Access（后台鉴权，替代 token）

1. 打开 <https://one.dash.cloudflare.com> → **Access → Applications → Add → Self-hosted**
2. Public hostnames 加**两条**（**Path 必须填——留空等于保护整个域名**）：
   | Domain | Path |
   |---|---|
   | `yourdomain.com` | `/admin` |
   | `yourdomain.com` | `/api/admin` |
3. Policy：Allow → Include → Emails → 你的常用邮箱
4. 把应用配置页的 **Application ID (AUD)** 填进 `wrangler.toml`

> Access 必须配在**自定义域名**上——配 `*.pages.dev` 会登录死循环。

### 4. 部署

推送到 GitHub，Pages 自动构建（`npm run build` → `dist`；R2/D1 binding 与变量来自 `wrangler.toml`）。

```bash
npm run dev          # 纯前端
npm run pages:dev    # 全栈本地开发
```

## 鉴权工作原理

- `/admin` 与 `/api/admin/*` 由 Cloudflare Access 应用拦截（邮箱验证码，设备级会话长期免登录）
- `functions/api/admin/_middleware.js` 对每个 admin 请求校验 `Cf-Access-Jwt-Assertion` JWT（JWKS + RS256 签名 + iss/aud/exp）
- 中间件保留旧版 Bearer `UPLOAD_TOKEN` 通道作为应急兜底

## 排障

| 症状 | 原因 / 解决 |
|---|---|
| 构建报 `Missing entry-point` | `wrangler.toml` 缺 `pages_build_output_dir`；或项目建成了 Worker 而非 Pages |
| 加了 `[vars]` 后部署失败 | `[vars]` 会覆盖 Dashboard 的 secret——加 `keep_vars = true` 或删掉 Dashboard 里的 secret |
| push 不再触发构建 | GitHub App 丢了仓库授权——GitHub → Settings → Applications → Cloudflare Pages → 重新授权 |
| `/admin` 不出 Access 登录页 | Access 应用 path 为空（= 保护整站）或配在 `*.pages.dev` 上；用自定义域名 + 明确的 `/admin` 路径 |
| 整站都跳登录页 | 某条 Access hostname 的 **path 为空**——删掉它，只留 `/admin` 和 `/api/admin` 两条 |
| 上传页还是旧界面 | 浏览器缓存了旧 bundle——Ctrl+Shift+R 强刷 |
| 发布时报 `R2 bucket '...' not found` | `wrangler.toml` 的 `bucket_name` 与实际 bucket 不符 |

## 目录结构

```
flarefolio/
├── README.md                # 英文（默认）
├── README.zh-CN.md          # 简体中文
├── schema.sql               # D1 建表
├── wrangler.toml            # bindings + vars + pages_build_output_dir
├── src/
│   ├── config.js            # IMG_BASE 等
│   ├── lib/gallery.js       # 数据加载 / 图片 URL
│   └── components/
│       ├── GalleryView.vue  # 网格 + 搜索 + 灯箱
│       ├── Lightbox.vue
│       └── AdminView.vue    # 元数据表单 + 两步发布
├── functions/api/
│   ├── artworks.js          # GET 公开清单（D1）
│   ├── images.js           # GET R2 回退清单
│   └── admin/
│       ├── _middleware.js  # Access JWT 验证
│       ├── _access.js       # JWT/JWKS 工具（不生成路由）
│       ├── upload.js        # POST 文件 → R2
│       └── artworks/         # POST 新增 · PATCH/DELETE 按 id
└── scripts/gen-manifest.mjs
```
