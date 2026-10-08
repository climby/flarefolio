/**
 * POST /api/admin/upload — 鉴权后把图片写入 R2（P2：从 /api/upload 迁入，由 admin 中间件统一鉴权）。
 * 入参 multipart/form-data：file 字段。
 * 注意：超大文件建议改用 R2 presigned URL 直传（见 README）。
 */
const MAX_BYTES = 10 * 1024 * 1024; // 单文件 10MB，可按需调整

function safeName(name) {
  return name
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.\-()[\]{} ]+/g, '')
    .trim()
    .slice(0, 120) || 'image';
}

export async function onRequestPost({ request, env }) {
  if (!env.IMAGES) {
    return Response.json({ error: 'R2 binding "IMAGES" 未配置' }, { status: 500 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: '需要 multipart/form-data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return Response.json({ error: '缺少 file 字段' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return Response.json({ error: `不支持的文件类型：${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `文件过大（${(file.size / 1048576).toFixed(1)}MB），上限 10MB` },
      { status: 413 }
    );
  }

  const d = new Date();
  const ymd = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  const key = `${ymd}/${Date.now()}-${safeName(file.name)}`;

  await env.IMAGES.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      // 文件名带时间戳，内容不可变，可放心长缓存
      cacheControl: 'public, max-age=31536000, immutable'
    }
  });

  // 默认标题：文件名去扩展名，前端表单可修改
  const title = String(file.name).replace(/\.[^.]+$/, '').slice(0, 200) || '未命名画作';
  return Response.json({ ok: true, key, size: file.size, title }, { status: 201 });
}
