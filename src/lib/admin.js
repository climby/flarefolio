/**
 * 管理员共享状态（App 顶栏开关 ↔ GalleryView 管理按钮）。
 * editMode 默认关闭：画廊保持纯净观感，切换后才显示旋转/删除按钮。
 */
import { ref } from 'vue';

export const adminState = {
  isAdmin: ref(false),
  editMode: ref(false)
};

export async function probeAdmin() {
  try {
    const r = await fetch('/api/admin/whoami', { cache: 'no-store' });
    const ct = r.headers.get('content-type') || '';
    // 未登录 → Access 302 到登录页（HTML）；已登录 → 本接口 JSON
    adminState.isAdmin.value = ct.includes('application/json') && r.ok;
  } catch {
    /* 非管理员 */
  }
}
