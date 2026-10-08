<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import GalleryView from './components/GalleryView.vue';
import AdminView from './components/AdminView.vue';
import { adminState, probeAdmin } from './lib/admin.js';

// 极简 history 路由（P4：/ 画廊、/admin 上传、/art/:slug 画廊深链接，
// 深链接由 Pages 的 public/_redirects 回退到 index.html）
const route = ref(location.pathname.replace(/\/$/, '') || '/');
function syncRoute() {
  route.value = location.pathname.replace(/\/$/, '') || '/';
  window.scrollTo(0, 0);
}
onMounted(() => {
  window.addEventListener('popstate', syncRoute);
  probeAdmin();
});
onUnmounted(() => {
  window.removeEventListener('popstate', syncRoute);
});

function nav(path) {
  history.pushState(null, '', path);
  syncRoute();
}

const view = computed(() => {
  if (route.value === '/admin') return AdminView;
  if (route.value === '/' || route.value.startsWith('/art/')) return GalleryView;
  return GalleryView;
});
</script>

<template>
  <header
    class="sticky top-0 z-20 flex items-center gap-4 border-b border-gray-200 bg-white/85 px-4 py-3 backdrop-blur sm:px-6"
    style="padding-top: max(0.75rem, env(safe-area-inset-top));"
  >
    <a class="text-lg font-extrabold tracking-wide text-gray-900 no-underline" href="/" @click.prevent="nav('/')">Flarefolio</a>
    <!-- 管理编辑模式开关（仅管理员会话可见；关闭时画廊保持纯净） -->
    <button
      v-if="adminState.isAdmin.value"
      class="rounded-full border px-3.5 py-2 text-sm font-medium transition-colors"
      :class="adminState.editMode.value
        ? 'border-blue-600 bg-blue-600 text-white'
        : 'border-gray-200 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600'"
      :title="adminState.editMode.value ? '退出编辑' : '管理画作'"
      @click="adminState.editMode.value = !adminState.editMode.value"
    >{{ adminState.editMode.value ? '✓ 完成' : '✎ 管理' }}</button>
    <a
      class="ml-auto rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white no-underline transition-colors hover:bg-blue-700"
      href="/admin"
      @click.prevent="nav('/admin')"
    >＋ 上传</a>
  </header>
  <component :is="view" />
</template>
