/**
 * /api/admin/* 统一鉴权中间件。
 * P1：沿用 Bearer UPLOAD_TOKEN（P2 将替换为 Zero Trust Access / Cf-Access-Jwt-Assertion）。
 */
export async function onRequest(context) {
  const auth = context.request.headers.get('Authorization') || '';
  if (!context.env.UPLOAD_TOKEN || auth !== `Bearer ${context.env.UPLOAD_TOKEN}`) {
    return Response.json({ error: '未授权' }, { status: 401 });
  }
  return context.next();
}
