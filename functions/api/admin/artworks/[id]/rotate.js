/**
 * POST /api/admin/artworks/:id/rotate — 已上传画作的原地旋转。
 * 入参 JSON：{ quarter: 1 | 3 }（顺时针 90° 的次数；1=顺时针 90°，3=逆时针 90°）
 *
 * 实现：通过 Image Transformations（rotate=90/270）生成旋转后的 JPEG，
 * 写入 R2 新 key（避开长缓存），更新 D1（image_key + 宽高比互换），删除旧对象。
 */
export async function onRequestPost({ request, params, env }) {
  if (!env.DB || !env.IMAGES) {
    return Response.json({ error: 'DB/IMAGES binding 未配置' }, { status: 500 });
  }
  const { id } = params;
  let quarter;
  try {
    ({ quarter } = await request.json());
  } catch {
    return Response.json({ error: '需要 JSON 请求体 { quarter: 1|3 }' }, { status: 400 });
  }
  if (quarter !== 1 && quarter !== 3) {
    return Response.json({ error: 'quarter 仅支持 1（顺时针90°）或 3（逆时针90°）' }, { status: 400 });
  }

  const row = await env.DB.prepare('SELECT image_key, aspect_ratio FROM artworks WHERE id = ?').bind(id).first();
  if (!row) {
    return Response.json({ error: '画作不存在' }, { status: 404 });
  }

  // 在 R2 公开域名上做变换（同 zone、Transformations 生效），
  // 不 fetch 站点自身域名——避免 Worker 子请求自引用被平台拒绝（502）
  const base = env.R2_IMG_BASE || `https://s3img01.5201688.xyz`;
  const rotatedUrl = `${base}/cdn-cgi/image/rotate=${quarter === 1 ? 90 : 270},quality=92,format=jpeg/${row.image_key}`;
  const res = await fetch(rotatedUrl);
  if (!res.ok) {
    return Response.json({ error: `变换服务返回 ${res.status}（可能超出每月 5000 次额度）` }, { status: 502 });
  }

  // 新 key：扩展名前加 -r<时间戳>，避免命中旧长缓存
  const newKey = row.image_key.replace(/(\.[^.]+)$/, `-r${Date.now()}$1`);
  const buf = await res.arrayBuffer();
  await env.IMAGES.put(newKey, buf, {
    httpMetadata: {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable'
    }
  });

  // 宽高比互换（90° 旋转），NULL 保持 NULL
  const newRatio = row.aspect_ratio ? 1 / row.aspect_ratio : null;
  await env.DB.prepare('UPDATE artworks SET image_key = ?, aspect_ratio = ? WHERE id = ?')
    .bind(newKey, newRatio, id)
    .run();

  await env.IMAGES.delete(row.image_key);
  return Response.json({ ok: true, image_key: newKey, aspect_ratio: newRatio });
}
