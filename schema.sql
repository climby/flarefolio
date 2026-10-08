-- Flarefolio D1 schema（P1 数据层）
-- 执行方式（Dashboard → D1 → gallery-db → Console 粘贴执行，或）：
--   npx wrangler d1 execute gallery-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,              -- crypto.randomUUID()
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,        -- 永久链接用（P4 history 路由），由 title 生成
  image_key TEXT NOT NULL,          -- R2 object key
  medium TEXT,                     -- 水彩 / 丙烯 / 速写 / 板绘 / 摄影…
  notes TEXT,                      -- 练习心得或创作背景
  aspect_ratio REAL,               -- width / height，瀑布流占位；NULL 时前端按 4:3
  sort_order INTEGER DEFAULT 0,    -- 手动排序，大者靠前
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS artwork_tags (
  artwork_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (artwork_id, tag_id),
  FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artwork_tags_tag ON artwork_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_artworks_created ON artworks(created_at);
