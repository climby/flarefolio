/* 画廊站点配置：按你的实际情况修改 */
export const config = {
  // R2 public bucket 绑定的自定义域名（原图直链用）
  IMG_BASE: 'https://img.example.com',

  // 图片清单来源：优先走动态 API，失败自动回退到静态 images.json
  API_URL: '/api/images',
  MANIFEST_URL: '/images.json',

  // 是否启用 Cloudflare Image Transformations（需要站点走自定义域名；*.pages.dev 预览域名下可能不生效）
  USE_TRANSFORMATIONS: true,

  // 缩略图宽度档位（srcset）
  THUMB_WIDTHS: [400, 800, 1200],
  // 灯箱大图宽度
  LIGHTBOX_WIDTH: 1920
};
