import { config } from '../config.js';

/** 拼 transformation URL；关闭时直接返回原图 */
export function imgUrl(key, width, quality = 80) {
  const src = `${config.IMG_BASE}/${key}`;
  if (!config.USE_TRANSFORMATIONS) return src;
  return `${location.origin}/cdn-cgi/image/width=${width},quality=${quality},format=auto/${src}`;
}

export function srcset(key) {
  return config.THUMB_WIDTHS.map((w) => `${imgUrl(key, w)} ${w}w`).join(', ');
}

export function fileName(key) {
  return String(key).split('/').pop();
}

/** 旧数据源：/api/images 或静态 images.json（仅回退用） */
async function loadImages() {
  for (const u of [config.API_URL, config.MANIFEST_URL]) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) continue;
      const data = await r.json();
      const list = Array.isArray(data) ? data : data.images;
      if (Array.isArray(list)) {
        return list.sort((a, b) => String(a.key).localeCompare(String(b.key)));
      }
    } catch {
      /* 尝试下一个来源 */
    }
  }
  return [];
}

/**
 * P1 主数据源：GET /api/artworks（D1，含标题/材质/心得/标签）。
 * 失败时回退到旧图片清单（映射成最小元数据结构），保证画廊不空。
 */
export async function loadArtworks() {
  try {
    const r = await fetch(config.ARTWORKS_URL, { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data.artworks)) return data.artworks;
    }
  } catch {
    /* 回退到旧清单 */
  }
  return (await loadImages()).map((it) => ({
    image_key: it.key,
    title: fileName(it.key).replace(/\.[^.]+$/, ''),
    medium: null,
    notes: null,
    tags: []
  }));
}

/** 宽高比缺省 4:3（瀑布流占位防闪烁） */
export function ratioOf(it) {
  return it.aspect_ratio || 4 / 3;
}

/** 搜索匹配：标题 + 材质 + 标签 */
export function matches(it, q) {
  if (!q) return true;
  const hay = [it.title, it.medium, ...(it.tags || [])].join(' ').toLowerCase();
  return hay.includes(q);
}
