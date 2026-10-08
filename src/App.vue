<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import GalleryView from './components/GalleryView.vue';
import AdminView from './components/AdminView.vue';

// 极简 history 路由（P4：/ 画廊、/admin 上传、/art/:slug 画廊深链接，
// 深链接由 Pages 的 public/_redirects 回退到 index.html）
const route = ref(location.pathname.replace(/\/$/, '') || '/');
function syncRoute() {
  route.value = location.pathname.replace(/\/$/, '') || '/';
  window.scrollTo(0, 0);
}
onMounted(() => {
  window.addEventListener('popstate', syncRoute);
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
    <a
      class="ml-auto rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white no-underline transition-colors hover:bg-blue-700"
      href="/admin"
      @click.prevent="nav('/admin')"
    >＋ 上传</a>
  </header>
  <component :is="view" />
</template>
