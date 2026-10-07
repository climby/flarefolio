<script setup>
import { ref } from 'vue';

const token = ref(localStorage.getItem('gallery_upload_token') || '');
const queue = ref([]);
const log = ref([]);
const uploading = ref(false);
const dragOver = ref(false);
const fileInput = ref(null);

function saveToken() {
  localStorage.setItem('gallery_upload_token', token.value.trim());
}

function setFiles(list) {
  queue.value = [...list].filter((f) => f.type.startsWith('image/'));
}

function push(html, cls) {
  log.value.unshift({ html, cls });
}

async function upload() {
  if (!token.value.trim()) return push('请先填写 upload token', 'err');
  if (!queue.value.length) return push('请先选择图片', 'err');
  uploading.value = true;
  for (const f of queue.value) {
    const fd = new FormData();
    fd.append('file', f, f.name);
    try {
      const r = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.value.trim()}` },
        body: fd
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      push(`✓ ${f.name} → ${data.key}`, 'ok');
    } catch (e) {
      push(`✕ ${f.name}：${e.message}`, 'err');
    }
  }
  uploading.value = false;
  queue.value = [];
}
</script>

<template>
  <div class="admin">
    <h1>上传图片</h1>
    <p class="hint">需要 <code>UPLOAD_TOKEN</code>（wrangler secret）。token 只保存在本浏览器 localStorage。</p>
    <div class="field">
      <label>Upload token</label>
      <input v-model="token" type="password" placeholder="Bearer token" autocomplete="off" @change="saveToken">
    </div>
    <div class="field">
      <div
        class="drop"
        :class="{ over: dragOver }"
        @click="fileInput.click()"
        @dragover.prevent="dragOver = true"
        @dragenter.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="dragOver = false; setFiles($event.dataTransfer.files)"
      >
        {{ queue.length ? `已选择 ${queue.length} 张图片` : '把图片拖到这里，或点击选择（可多选）' }}
      </div>
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="setFiles($event.target.files)">
    </div>
    <button class="primary" :disabled="uploading" @click="upload">
      {{ uploading ? '上传中…' : '开始上传' }}
    </button>
    <div id="log">
      <div v-for="(l, i) in log" :key="i" :class="l.cls" v-html="l.html"></div>
    </div>
  </div>
</template>
