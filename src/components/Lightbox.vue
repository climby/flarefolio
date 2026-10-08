<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { imgUrl } from '../lib/gallery.js';
import { config } from '../config.js';

const props = defineProps({
  images: { type: Array, required: true },
  index: { type: Number, required: true }
});
const emit = defineEmits(['close', 'nav']);

const current = computed(() => props.images[props.index]);

function onKey(e) {
  if (e.key === 'Escape') emit('close');
  else if (e.key === 'ArrowLeft') emit('nav', -1);
  else if (e.key === 'ArrowRight') emit('nav', 1);
}

onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
});
onUnmounted(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="lightbox" @click.self="$emit('close')">
    <button class="lb-close" aria-label="关闭" @click="$emit('close')">✕</button>
    <button class="lb-prev" aria-label="上一张" @click.stop="$emit('nav', -1)">‹</button>
    <img
      :src="imgUrl(current.image_key, config.LIGHTBOX_WIDTH, 85)"
      :alt="current.title"
    >
    <button class="lb-next" aria-label="下一张" @click.stop="$emit('nav', 1)">›</button>
    <div class="lb-caption">{{ current.title }}</div>
  </div>
</template>
