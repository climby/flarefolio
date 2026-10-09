<script setup>
import { ref } from 'vue';
import { stripPrivateMetadata, rotateQuarter } from '../lib/exif.js';

const file = ref(null);           // 当前待上传文件（单张，逐张填元数据）
const exifMode = ref('');         // lossless / baked / passthrough
const previewUrl = ref('');       // 选图预览（旋转时能看到方向）
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
const EXIF_LABELS = {
  lossless: '已剥离隐私数据（无损，像素未动）',
  baked: '已剥离隐私数据（方向已校正重编码）',
  passthrough: '（非 JPEG，未处理）'
};

function push(html, cls) {
  log.value.unshift({ html, cls });
}

/** 更新预览与宽高比 */
const previewError = ref('');
function refreshMeta() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = file.value ? URL.createObjectURL(file.value) : '';
  previewError.value = '';
  aspectRatio.value = null;
  if (!file.value) return;
  const img = new Image();
  img.onload = () => {
    aspectRatio.value = img.naturalWidth / img.naturalHeight || null;
  };
  img.src = previewUrl.value;
}

/** 预览渲染失败时显示诊断信息（文件类型/大小/魔数），便于定位相机直拍问题 */
async function onPreviewError() {
  if (!file.value) return;
  const f = file.value;
  let diag = `类型=${f.type || '(空)'}，${(f.size / 1048576).toFixed(1)}MB`;
  try {
    const head = new Uint8Array(await f.slice(0, 8).arrayBuffer());
    diag += '，文件头=' + [...head].map((x) => x.toString(16).padStart(2, '0')).join(' ');
  } catch { /* 忽略 */ }
  previewError.value = `预览不可用（${diag}）。若是 HEIC 请在相机设置改为“兼容性/高效 → 兼容”后重拍。`;
}

/** 手动旋转 90°（顺时针 quarterTurns 次；1 正转、3 逆转） */
async function rotate(dir) {
  if (!file.value || uploading.value) return;
  uploading.value = true;
  try {
    file.value = await rotateQuarter(file.value, dir);
    refreshMeta();
  } catch (e) {
    push(`✕ 旋转失败：${e.message}`, 'err');
  }
  uploading.value = false;
}

async function setFile(f) {
  if (!f) return;
  // 先剥离隐私数据（GPS/相机信息），文件不出设备
  let cleaned;
  try {
    cleaned = await stripPrivateMetadata(f);
  } catch (e) {
    push(`⚠ EXIF 剥离失败（${e.message}），改用原图上传`, 'err');
    cleaned = { file: f, mode: 'passthrough' };
  }
  file.value = cleaned.file;
  exifMode.value = cleaned.mode;
  title.value = cleaned.file.name.replace(/\.[^.]+$/, '').slice(0, 200) || '未命名画作';
  refreshMeta();
}

function resetForm() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  file.value = null;
  exifMode.value = '';
  title.value = '';
  medium.value = '';
  notes.value = '';
  tagsInput.value = '';
  aspectRatio.value = null;
}

async function upload() {
  if (!file.value) return push('请先选择图片', 'err');
  uploading.value = true;
  try {
    // 第 1 步：文件 → R2（鉴权由 Cloudflare Access 会话 cookie 自动携带）
    const fd = new FormData();
    fd.append('file', file.value, file.value.name);
    const up = await fetch('/api/admin/upload', { method: 'POST', body: fd });
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
      headers: { 'Content-Type': 'application/json' },
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
      已由 Cloudflare Access 保护（邮箱验证码登录），无需密码或 token。
    </p>

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
      <p class="mt-0.5 text-xs text-green-600">
        {{ EXIF_LABELS[exifMode] || '' }}
      </p>

      <!-- 预览 + 手动旋转（源头无 orientation 信息的照片在此纠正） -->
      <div class="mt-3 flex items-start gap-3">
        <img
          :src="previewUrl"
          alt="预览"
          class="max-h-56 rounded-lg border border-gray-200 bg-gray-50 object-contain"
          @error="onPreviewError"
        >
        <p v-if="previewError" class="max-w-[60%] self-center text-xs leading-5 text-red-600">{{ previewError }}</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition-colors hover:border-blue-500 hover:text-blue-600"
            :disabled="uploading"
            title="逆时针旋转 90°"
            @click="rotate(3)"
          >⟲</button>
          <button
            type="button"
            class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition-colors hover:border-blue-500 hover:text-blue-600"
            :disabled="uploading"
            title="顺时针旋转 90°"
            @click="rotate(1)"
          >⟳</button>
        </div>
      </div>
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
