<script setup>
import { ref, computed, onMounted } from 'vue';
import Lightbox from './Lightbox.vue';
import { loadImages, imgUrl, srcset, fileName } from '../lib/gallery.js';
import { config } from '../config.js';

const items = ref([]);
const query = ref('');
const lbIndex = ref(-1);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return items.value.filter((it) => !q || fileName(it.key).toLowerCase().includes(q));
});

onMounted(async () => {
  items.value = await loadImages();
});

function onImgError(e, key) {
  // transformations 超量（9422）时回退原图
  const fallback = `${config.IMG_BASE}/${key}`;
  if (e.target.src !== fallback) e.target.src = fallback;
}

function nav(d) {
  lbIndex.value = (lbIndex.value + d + filtered.value.length) % filtered.value.length;
}
</script>

<template>
  <main>
    <div class="toolbar-row">
      <input v-model="query" type="search" placeholder="搜索图片…" autocomplete="off">
      <span v-if="items.length" class="count">{{ filtered.length }} / {{ items.length }}</span>
    </div>
    <div class="grid">
      <div v-for="(it, i) in filtered" :key="it.key" class="card" @click="lbIndex = i">
        <img
          :src="imgUrl(it.key, config.THUMB_WIDTHS[0])"
          :srcset="srcset(it.key)"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          :alt="fileName(it.key)"
          loading="lazy"
          decoding="async"
          @load="$event.target.classList.add('loaded')"
          @error="(e) => onImgError(e, it.key)"
        >
      </div>
    </div>
    <div v-if="!filtered.length" class="empty">
      还没有图片。先去 <a href="#/admin">上传</a> 几张吧。
    </div>
    <Lightbox
      v-if="lbIndex >= 0"
      :images="filtered"
      :index="lbIndex"
      @close="lbIndex = -1"
      @nav="nav"
    />
  </main>
</template>
