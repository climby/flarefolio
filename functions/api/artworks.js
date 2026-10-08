/**
 * GET /api/artworks — 公开读画作列表（含标签），D1 查询。
 * 需要 wrangler.toml 里配置 [[d1_databases]] binding = "DB"。
 * 按 sort_order（手动置顶）+ created_at（新→旧）排序，缓存 60 秒。
 */
export async function onRequestGet({ env }) {
  if (!env.DB) {
    return Response.json({ error: 'D1 binding "DB" 未配置' }, { status: 500 });
  }
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.title, a.slug, a.image_key, a.medium, a.notes, a.aspect_ratio,
            a.sort_order, a.created_at,
            COALESCE((
              SELECT json_group_array(t.name)
              FROM tags t JOIN artwork_tags at ON at.tag_id = t.id
              WHERE at.artwork_id = a.id
            ), '[]') AS tags
     FROM artworks a
     ORDER BY a.sort_order DESC, a.created_at DESC`
  ).all();

  const artworks = (results || []).map((r) => ({ ...r, tags: JSON.parse(r.tags || '[]') }));
  return Response.json({ artworks }, {
    headers: { 'Cache-Control': 'public, max-age=60' }
  });
}
