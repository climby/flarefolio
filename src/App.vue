<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import GalleryView from './components/GalleryView.vue';
import AdminView from './components/AdminView.vue';

// 极简 hash 路由：#/ → 画廊，#/admin → 上传页（免 vue-router 依赖）
const route = ref(location.hash.replace('#', '') || '/');
function syncRoute() {
  route.value = location.hash.replace('#', '') || '/';
  window.scrollTo(0, 0);
}
onMounted(() => window.addEventListener('hashchange', syncRoute));
onUnmounted(() => window.removeEventListener('hashchange', syncRoute));

const view = computed(() => (route.value === '/admin' ? AdminView : GalleryView));
</script>

<template>
  <header class="sticky top-0 z-20 flex items-center gap-4 border-b border-gray-200 bg-white/85 px-6 py-3 backdrop-blur">
    <a class="text-lg font-extrabold tracking-wide text-gray-900 no-underline" href="#/">Flarefolio</a>
    <a
      class="ml-auto rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white no-underline transition-colors hover:bg-blue-700"
      href="#/admin"
    >＋ 上传</a>
  </header>
  <component :is="view" />
</template>
