<script setup>
import { ref } from 'vue';

const token = ref(localStorage.getItem('gallery_upload_token') || '');
const file = ref(null);           // 当前待上传文件（单张，逐张填元数据）
const title = ref('');
const medium = ref('');
const notes = ref('');
const tagsInput = ref('');
const aspectRatio = ref(null);
const log = ref([]);
const uploading = ref(false);
const dragOver = ref(false);
const fileInput = ref(null);

const MEDIUMS = ['', '水彩', '丙烯', '速写', '板绘', '素描', '摄影'];

function saveToken() {
  localStorage.setItem('gallery_upload_token', token.value.trim());
}

function push(html, cls) {
  log.value.unshift({ html, cls });
}

function setFile(f) {
  if (!f) return;
  file.value = f;
  title.value = f.name.replace(/\.[^.]+$/, '').slice(0, 200) || '未命名画作';
  aspectRatio.value = null;
  // 本地读宽高（不经过网络），瀑布流占位用
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => {
    aspectRatio.value = img.naturalWidth / img.naturalHeight || null;
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function resetForm() {
  file.value = null;
  title.value = '';
  medium.value = '';
  notes.value = '';
  tagsInput.value = '';
  aspectRatio.value = null;
}

async function upload() {
  if (!token.value.trim()) return push('请先填写 upload token', 'err');
  if (!file.value) return push('请先选择图片', 'err');
  uploading.value = true;
  const auth = { Authorization: `Bearer ${token.value.trim()}` };
  try {
    // 第 1 步：文件 → R2
    const fd = new FormData();
    fd.append('file', file.value, file.value.name);
    const up = await fetch('/api/admin/upload', { method: 'POST', headers: auth, body: fd });
    const upData = await up.json().catch(() => ({}));
    if (!up.ok) throw new Error(`上传失败：${upData.error || up.status}`);
    push(`✓ 已存储 → ${upData.key}`, 'ok');

    // 第 2 步：元数据 → D1
    const meta = {
      image_key: upData.key,
      title: title.value.trim() || upData.title,
      medium: medium.value,
      notes: notes.value.trim(),
      tags: tagsInput.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      aspect_ratio: aspectRatio.value
    };
    const metaRes = await fetch('/api/admin/artworks', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(meta)
    });
    const metaData = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok) throw new Error(`元数据保存失败：${metaData.error || metaRes.status}（图已上传，可重试补录）`);
    push(`✓ 已发布：${metaData.title ?? meta.title}`, 'ok');
    resetForm();
  } catch (e) {
    push(`✕ ${e.message}`, 'err');
  }
  uploading.value = false;
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-10">
    <h1 class="text-2xl font-bold text-gray-900">上传画作</h1>
    <p class="mt-1 text-sm text-gray-400">
      鉴权：Cloudflare Access（邮箱验证码）优先；未配置 Access 时使用 UPLOAD_TOKEN，token 只保存在本浏览器 localStorage。
    </p>

    <div class="mt-5">
      <label class="mb-1.5 block text-[13px] text-gray-400">Upload token</label>
      <input
        v-model="token"
        type="password"
        placeholder="Bearer token"
        autocomplete="off"
        class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-blue-600"
        @change="saveToken"
      >
    </div>

    <!-- 拖拽/选择图片（单张：每张单独填元数据） -->
    <div
      class="mt-5 cursor-pointer rounded-xl border-2 border-dashed border-gray-200 bg-white p-10 text-center text-gray-400 transition-colors hover:border-blue-500 hover:text-blue-600"
      :class="{ 'border-blue-600! text-blue-600!': dragOver }"
      @click="fileInput.click()"
      @dragover.prevent="dragOver = true"
      @dragenter.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="dragOver = false; setFile($event.dataTransfer.files[0])"
    >
      {{ file ? '点击可重新选择图片' : '把图片拖到这里，或点击选择' }}
    </div>
    <input ref="fileInput" type="file" accept="image/*" hidden @change="setFile($event.target.files[0])">

    <div v-if="file" class="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
      <p class="text-sm font-medium text-gray-700">
        {{ file.name }}
        <span class="ml-2 text-xs text-gray-400">
          {{ (file.size / 1048576).toFixed(1) }}MB{{ aspectRatio ? ` · ${aspectRatio.toFixed(2)}:1` : '' }}
        </span>
      </p>
      <div class="mt-3 grid gap-3">
        <div>
          <label class="mb-1.5 block text-[13px] text-gray-400">标题</label>
          <input
            v-model="title"
            class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
          >
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1.5 block text-[13px] text-gray-400">材质</label>
            <select
              v-model="medium"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
            >
              <option v-for="m in MEDIUMS" :key="m" :value="m">{{ m || '（不填）' }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-[13px] text-gray-400">标签（逗号分隔）</label>
            <input
              v-model="tagsInput"
              placeholder="练习打卡, 人物"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
            >
          </div>
        </div>
        <div>
          <label class="mb-1.5 block text-[13px] text-gray-400">心得 / 备注</label>
          <textarea
            v-model="notes"
            rows="3"
            placeholder="获多福300g纯棉，高光提白液有些堆积…"
            class="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
          />
        </div>
      </div>
    </div>

    <button
      :disabled="uploading"
      class="mt-6 rounded-full bg-blue-600 px-8 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-default disabled:opacity-50"
      @click="upload"
    >
      {{ uploading ? '发布中…' : '发布' }}
    </button>

    <div class="mt-6 space-y-1 text-[13px] leading-7">
      <div v-for="(l, i) in log" :key="i" :class="l.cls === 'ok' ? 'text-green-700' : 'text-red-700'" v-html="l.html"></div>
    </div>
  </div>
</template>
