/**
 * /api/admin/* 统一鉴权中间件（P2：双通道过渡）。
 * 1) Cloudflare Access JWT（主鉴权）：请求经 Access 应用保护后携带 Cf-Access-Jwt-Assertion
 * 2) Bearer UPLOAD_TOKEN（兜底）：Access 上线并验证后移除
 */
import { verifyAccessJWT } from './_access.js';

export async function onRequest(context) {
  const { request, env } = context;

  // 通道 1：Cloudflare Access JWT
  if (env.CF_ACCESS_TEAM && env.CF_ACCESS_AUD) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (token && await verifyAccessJWT(token, env.CF_ACCESS_TEAM, env.CF_ACCESS_AUD).catch(() => null)) {
      return context.next();
    }
  }

  // 通道 2（过渡期）：Bearer token
  const auth = request.headers.get('Authorization') || '';
  if (env.UPLOAD_TOKEN && auth === `Bearer ${env.UPLOAD_TOKEN}`) {
    return context.next();
  }

  return Response.json({ error: '未授权' }, { status: 401 });
}
