/**
 * PATCH  /api/admin/artworks/:id — 修改元数据（title/medium/notes/sort_order/tags）。
 * DELETE /api/admin/artworks/:id — 删除 D1 记录 + 关联 + R2 对象。
 * 鉴权：由 functions/api/admin/_middleware.js 统一处理。
 */

export async function onRequestPatch({ request, params, env }) {
  if (!env.DB) {
    return Response.json({ error: 'D1 binding "DB" 未配置' }, { status: 500 });
  }
  const { id } = params;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '需要 JSON 请求体' }, { status: 400 });
  }

  const { title, medium, notes, sort_order, tags } = body || {};
  const sets = [];
  const vals = [];
  if (title !== undefined) {
    if (!String(title).trim()) return Response.json({ error: 'title 不能为空' }, { status: 400 });
    sets.push('title = ?'); vals.push(String(title).trim().slice(0, 200));
  }
  if (medium !== undefined) { sets.push('medium = ?'); vals.push(medium?.trim() || null); }
  if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes?.trim() || null); }
  if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(Number(sort_order) || 0); }
  if (!sets.length && !Array.isArray(tags)) {
    return Response.json({ error: '没有可更新的字段' }, { status: 400 });
  }

  const stmts = [];
  if (sets.length) {
    stmts.push(env.DB.prepare(`UPDATE artworks SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id));
  }
  if (Array.isArray(tags)) {
    // 整体替换标签
    const tagList = [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 10);
    stmts.push(env.DB.prepare('DELETE FROM artwork_tags WHERE artwork_id = ?').bind(id));
    for (const name of tagList) {
      stmts.push(
        env.DB.prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING').bind(name),
        env.DB.prepare(
          'INSERT INTO artwork_tags (artwork_id, tag_id) SELECT ?, id FROM tags WHERE name = ?'
        ).bind(id, name)
      );
    }
  }

  const results = await env.DB.batch(stmts);
  const changed = results.reduce((n, r) => n + (r.meta?.changes || 0), 0);
  if (!changed && !(await env.DB.prepare('SELECT 1 FROM artworks WHERE id = ?').bind(id).first())) {
    return Response.json({ error: '画作不存在' }, { status: 404 });
  }
  return Response.json({ ok: true });
}

export async function onRequestDelete({ params, env }) {
  if (!env.DB) {
    return Response.json({ error: 'D1 binding "DB" 未配置' }, { status: 500 });
  }
  const { id } = params;

  const row = await env.DB.prepare('SELECT image_key FROM artworks WHERE id = ?').bind(id).first();
  if (!row) {
    return Response.json({ error: '画作不存在' }, { status: 404 });
  }

  // 先删 D1（外键级联清 artwork_tags），再删 R2 对象
  await env.DB.prepare('DELETE FROM artworks WHERE id = ?').bind(id);
  if (env.IMAGES) {
    await env.IMAGES.delete(row.image_key);
  }
  return Response.json({ ok: true, deleted_image_key: row.image_key });
}
