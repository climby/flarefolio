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
  <header class="topbar">
    <a class="brand" href="#/">Flarefolio</a>
    <a class="admin-link" href="#/admin">＋ 上传</a>
  </header>
  <component :is="view" />
</template>
