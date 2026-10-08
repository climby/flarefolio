<script setup>
import { ref, computed, onMounted } from 'vue';
import Lightbox from './Lightbox.vue';
import { loadArtworks, imgUrl, srcset, ratioOf, matches } from '../lib/gallery.js';
import { config } from '../config.js';

const items = ref([]);
const query = ref('');
const lbIndex = ref(-1);

const filtered = computed(() => items.value.filter((it) => matches(it, query.value.trim().toLowerCase())));

onMounted(async () => {
  items.value = await loadArtworks();
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
  <main class="mx-auto max-w-[1400px] p-6">
    <!-- 搜索栏 -->
    <div class="mb-5 flex items-center gap-3">
      <input
        v-model="query"
        type="search"
        placeholder="搜索标题 / 材质 / 标签…"
        autocomplete="off"
        class="w-56 max-w-[40vw] rounded-full border border-gray-200 bg-white px-4 py-2 text-sm outline-none transition-colors focus:border-blue-600"
      >
      <span v-if="items.length" class="text-[13px] text-gray-400">
        {{ filtered.length }} / {{ items.length }}
      </span>
    </div>

    <!-- 画作网格 -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      <button
        v-for="(it, i) in filtered"
        :key="it.image_key"
        class="group relative cursor-zoom-in overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200"
        :style="{ aspectRatio: ratioOf(it) }"
        @click="lbIndex = i"
      >
        <!-- 卡片背景即骨架屏；图片加载后淡入覆盖 -->
        <img
          :src="imgUrl(it.image_key, config.THUMB_WIDTHS[0])"
          :srcset="srcset(it.image_key)"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          :alt="it.title"
          loading="lazy"
          decoding="async"
          class="h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-300 group-hover:scale-[1.03]"
          @load="$event.target.classList.remove('opacity-0')"
          @error="(e) => onImgError(e, it.image_key)"
        >
        <!-- 底部渐变遮罩：标题 / 材质 -->
        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
          <p class="truncate text-left text-sm font-medium text-white">{{ it.title }}</p>
          <p v-if="it.medium" class="mt-0.5 text-left text-xs text-white/70">
            {{ it.medium }}<span v-if="it.notes"> · {{ it.notes.slice(0, 40) }}{{ it.notes.length > 40 ? '…' : '' }}</span>
          </p>
        </div>
      </button>
    </div>

    <div v-if="!filtered.length" class="py-20 text-center text-[15px] text-gray-400">
      还没有画作。先去 <a href="#/admin" class="text-blue-600 hover:underline">上传</a> 几张吧。
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
