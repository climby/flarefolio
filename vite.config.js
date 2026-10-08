import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// 构建产物输出到 dist/，部署时 `npx wrangler pages deploy dist`
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    outDir: 'dist'
  }
});
