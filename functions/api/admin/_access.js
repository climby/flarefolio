/**
 * Cloudflare Access JWT 验证（functions/api/admin/ 专用，下划线前缀不生成路由）。
 * 依据官方模式：https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 *
 * 需要两个非敏感环境变量（wrangler.toml [vars]）：
 *   CF_ACCESS_TEAM = <team>（即 https://<team>.cloudflareaccess.com）
 *   CF_ACCESS_AUD  = Access 应用的 AUD（应用配置页的 Application ID (AUD)）
 */

/** base64url → Uint8Array */
function b64urlToBuf(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

/** JWKS 模块级缓存（每个 isolate 一份，1 小时） */
let jwksCache = { at: 0, value: null };
async function getJWKS(team) {
  if (jwksCache.value && Date.now() - jwksCache.at < 3600e3) return jwksCache.value;
  const r = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error(`JWKS fetch failed: ${r.status}`);
  const j = await r.json();
  jwksCache = { at: Date.now(), value: j };
  return j;
}

/** 验证 Cf-Access-Jwt-Assertion；通过返回 payload，失败返回 null */
export async function verifyAccessJWT(token, team, aud) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, encSig] = parts;

  const header = JSON.parse(new TextDecoder().decode(b64urlToBuf(encHeader)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBuf(encPayload)));

  const jwks = await getJWKS(team);
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBuf(encSig),
    new TextEncoder().encode(`${encHeader}.${encPayload}`)
  );
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  const issOk = payload.iss === `https://${team}.cloudflareaccess.com`;
  const audOk = Array.isArray(payload.aud) ? payload.aud.includes(aud) : payload.aud === aud;
  if (!issOk || !audOk || !payload.exp || payload.exp <= now) return null;

  return payload;
}
