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

/** 先尝试 /api/images，失败回退到静态 images.json */
export async function loadImages() {
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
