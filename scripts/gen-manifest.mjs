#!/usr/bin/env node
/**
 * 从 R2 列出图片，生成 public/images.json（静态清单方案）。
 *
 * 用法：
 *   R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx \
 *   R2_BUCKET=gallery-images npm run manifest
 *
 * R2 的 API token 在 Cloudflare Dashboard → R2 → Manage R2 API Tokens 里创建。
 * 生成后随 Pages 一起部署即可；之后新增图片重新跑一次。
 * 如果用了 /api/images 动态清单，这一步可以跳过。
 */
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET })) {
  if (!v) {
    console.error(`缺少环境变量：${k}`);
    process.exit(1);
  }
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
});

const images = [];
let token;
do {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: R2_BUCKET,
    ContinuationToken: token,
    MaxKeys: 1000
  }));
  for (const o of res.Contents || []) {
    if (IMAGE_EXT.test(o.Key)) {
      images.push({
        key: o.Key,
        size: o.Size,
        uploaded: o.LastModified ? new Date(o.LastModified).toISOString() : undefined
      });
    }
  }
  token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);

images.sort((a, b) => a.key.localeCompare(b.key));

const out = { generated_at: new Date().toISOString(), images };
const outPath = join(root, 'public', 'images.json');
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`✓ 写入 ${outPath}，共 ${images.length} 张图片`);
