/**
 * GET /api/admin/whoami — 管理员会话探测（画廊前端用来决定是否显示管理按钮）。
 * 未登录时 Access 会 302 到登录页（HTML），已登录返回本 JSON。
 */
export async function onRequestGet() {
  return Response.json({ ok: true });
}
