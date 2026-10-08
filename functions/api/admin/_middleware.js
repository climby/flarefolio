/**
 * /api/admin/* 统一鉴权中间件（P2 完成：Cloudflare Access 唯一鉴权通道）。
 * 请求必须先经 Access 应用（pic.5201688.xyz /admin、/api/admin），
 * 携带 Cf-Access-Jwt-Assertion，此处做签名与声明的防御性校验。
 */
import { verifyAccessJWT } from './_access.js';

export async function onRequest(context) {
  const { request, env } = context;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (
    token &&
    env.CF_ACCESS_TEAM && env.CF_ACCESS_AUD &&
    await verifyAccessJWT(token, env.CF_ACCESS_TEAM, env.CF_ACCESS_AUD).catch(() => null)
  ) {
    return context.next();
  }
  return Response.json({ error: '未授权（需经 Cloudflare Access 登录）' }, { status: 401 });
}
