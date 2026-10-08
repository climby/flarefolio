import { createApp } from 'vue';
import App from './App.vue';
import './assets/tailwind.css'; // Tailwind v4（新 UI）
import './assets/styles.css';   // 旧样式（Lightbox 等，P4 迁完后清理）

createApp(App).mount('#app');
