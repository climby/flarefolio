/**
 * GET /api/images — 列出 R2 bucket 中的图片，返回 JSON 清单。
 * 需要 wrangler.toml 里配置 [[r2_buckets]] binding = "IMAGES"。
 * 支持 ?limit=&cursor= 分页（R2 单次 list 最多 1000）。
 */
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i;

export async function onRequestGet({ request, env }) {
  if (!env.IMAGES) {
    return Response.json({ error: 'R2 binding "IMAGES" 未配置' }, { status: 500 });
  }
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10) || 1000, 1000);
  const cursor = url.searchParams.get('cursor') || undefined;

  const listed = await env.IMAGES.list({ limit, cursor });
  const images = listed.objects
    .filter((o) => IMAGE_EXT.test(o.key))
    .map((o) => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded,
      etag: o.etag
    }));

  const body = { images };
  if (listed.truncated) body.cursor = listed.cursor;

  return Response.json(body, {
    headers: {
      // 清单缓存 60 秒：list 属于 Class A 操作，缓存能省钱
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
