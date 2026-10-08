<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import VueEasyLightbox from 'vue-easy-lightbox';
import { MasonryWall } from '@yeger/vue-masonry-wall';
import { loadArtworks, imgUrl, srcset, ratioOf, matches } from '../lib/gallery.js';
import { config } from '../config.js';

const items = ref([]);
const query = ref('');
const activeTag = ref('');        // '' = 全部
const lbVisible = ref(false);
const lbIndex = ref(0);
const initialSlug = ref('');     // /art/:slug 深链接进入时自动开灯箱

// 响应式列宽：手机 2 列，桌面按 280px 自动分列
const isMobile = ref(window.matchMedia('(max-width: 640px)').matches);
let mediaQuery;
function onMediaChange(e) { isMobile.value = e.matches; }
const columnWidth = computed(() => (isMobile.value ? 170 : 280));
onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 640px)');
  mediaQuery.addEventListener('change', onMediaChange);
});
onUnmounted(() => mediaQuery?.removeEventListener('change', onMediaChange));

const allTags = computed(() => {
  const counts = new Map();
  for (const it of items.value) {
    for (const t of it.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return items.value.filter((it) =>
    matches(it, q) && (!activeTag.value || (it.tags || []).includes(activeTag.value))
  );
});

// 灯箱图片列表（transformations 大图档）
const lbImgs = computed(() => filtered.value.map((it) => ({
  src: imgUrl(it.image_key, config.LIGHTBOX_WIDTH, 85),
  title: it.title
})));

onMounted(async () => {
  items.value = await loadArtworks();
  // /art/:slug 深链接：滚动到该作品并打开灯箱
  const m = location.pathname.match(/^\/art\/(.+?)\/?$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    const idx = items.value.findIndex((it) => it.slug === slug);
    if (idx >= 0) {
      initialSlug.value = slug;
      setTimeout(() => {
        lbIndex.value = filteredIndexFor(idx);
        lbVisible.value = true;
      }, 300);
    }
  }
});

function filteredIndexFor(itemIdx) {
  const key = items.value[itemIdx]?.image_key;
  return Math.max(0, filtered.value.findIndex((it) => it.image_key === key));
}

function openLightbox(i) {
  lbIndex.value = i;
  lbVisible.value = true;
}

function onImgError(e, key) {
  // transformations 超量（9422）时回退原图
  const fallback = `${config.IMG_BASE}/${key}`;
  if (e.target.src !== fallback) e.target.src = fallback;
}
</script>

<template>
  <main class="mx-auto max-w-[1400px] p-6">
    <!-- 搜索 + 标签筛选 -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
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
    <div v-if="allTags.length" class="mb-5 flex flex-wrap gap-2">
      <button
        class="rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors"
        :class="activeTag === ''
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-200 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600'"
        @click="activeTag = ''"
      >全部</button>
      <button
        v-for="[tag, n] in allTags"
        :key="tag"
        class="rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors"
        :class="activeTag === tag
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-200 bg-white text-gray-500 hover:border-blue-400 hover:text-blue-600'"
        @click="activeTag = activeTag === tag ? '' : tag"
      >{{ tag }} <span class="opacity-60">{{ n }}</span></button>
    </div>

    <!-- 瀑布流（aspect-ratio 占位防闪烁；手机 2 列） -->
    <MasonryWall :items="filtered" :column-width="columnWidth" :gap="12" :padding="0" :ssr-columns="1">
      <template #default="{ item, index }">
        <button
          class="group relative mb-3 block w-full cursor-zoom-in overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200"
          :style="{ aspectRatio: ratioOf(item) }"
          @click="openLightbox(index)"
        >
          <img
            :src="imgUrl(item.image_key, config.THUMB_WIDTHS[0])"
            :srcset="srcset(item.image_key)"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            :alt="item.title"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-300 group-hover:scale-[1.02]"
            @load="$event.target.classList.remove('opacity-0')"
            @error="(e) => onImgError(e, item.image_key)"
          >
          <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
            <p class="truncate text-left text-sm font-medium text-white">{{ item.title }}</p>
            <p v-if="item.medium" class="mt-0.5 text-left text-xs text-white/70">
              {{ item.medium }}<span v-if="item.tags?.length"> · {{ item.tags.join(' / ') }}</span>
            </p>
          </div>
        </button>
      </template>
    </MasonryWall>

    <div v-if="!filtered.length" class="py-20 text-center text-[15px] text-gray-400">
      还没有画作。先去 <a href="/admin" class="text-blue-600 hover:underline">上传</a> 几张吧。
    </div>

    <!-- 手势灯箱：双指缩放 / 拖动 / 双击放大 / 旋转 / 键盘翻页 -->
    <VueEasyLightbox
      :visible="lbVisible"
      :imgs="lbImgs"
      :index="lbIndex"
      @hide="lbVisible = false"
    />
  </main>
</template>
