/**
 * POST /api/admin/artworks — 上传完成后写入元数据（D1）。
 * 鉴权：由 functions/api/admin/_middleware.js 统一处理（Bearer UPLOAD_TOKEN）。
 * 入参 JSON：{ image_key, title, medium?, notes?, tags?: string[], aspect_ratio? }
 */
const ALLOWED_FIELDS = ['medium', 'notes', 'aspect_ratio'];

function slugify(title) {
  const base = String(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'artwork';
}

/** 校验并归一化标签：去空白、去重、限 10 个 */
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 10);
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return Response.json({ error: 'D1 binding "DB" 未配置' }, { status: 500 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '需要 JSON 请求体' }, { status: 400 });
  }

  const { image_key, title, medium, notes, tags, aspect_ratio } = body || {};
  if (!image_key || typeof image_key !== 'string') {
    return Response.json({ error: '缺少 image_key' }, { status: 400 });
  }
  if (!title || !String(title).trim()) {
    return Response.json({ error: '缺少 title' }, { status: 400 });
  }

  // 确认 R2 对象存在，防止悬空引用
  if (!env.IMAGES || !(await env.IMAGES.head(image_key))) {
    return Response.json({ error: `R2 中不存在对象：${image_key}` }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const cleanTitle = String(title).trim().slice(0, 200);
  const slug = `${slugify(cleanTitle)}-${id.slice(0, 6)}`; // 带随机后缀，免冲突检测
  const tagList = normalizeTags(tags);
  const ratio = Number.isFinite(+aspect_ratio) && +aspect_ratio > 0 ? +aspect_ratio : null;

  const stmts = [
    env.DB.prepare(
      `INSERT INTO artworks (id, title, slug, image_key, medium, notes, aspect_ratio)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, cleanTitle, slug, image_key, medium?.trim() || null, notes?.trim() || null, ratio)
  ];
  for (const name of tagList) {
    stmts.push(
      env.DB.prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING').bind(name),
      env.DB.prepare(
        `INSERT INTO artwork_tags (artwork_id, tag_id)
         SELECT ?, id FROM tags WHERE name = ?`
      ).bind(id, name)
    );
  }
  await env.DB.batch(stmts);

  return Response.json({ ok: true, id, slug }, { status: 201 });
}
