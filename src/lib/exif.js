/**
 * 浏览器端 EXIF 剥离（P3）：文件离开设备前去掉 GPS / 相机序列号 / 时间戳等隐私数据。
 *
 * 策略（兼顾画质与正确性）：
 * - JPEG 且 orientation 正常（1 或无 EXIF）：**无损剥离**——仅移除 APP1(EXIF)/APP13/COM 段，
 *   像素一个字节都不动
 * - JPEG 且 orientation 为 2-8（含 iPhone 竖拍）：canvas 烘焙旋转后重编码剥离
 *   （无损方案去 EXIF 会连带丢方向标签导致图片横过来，只能重编码）
 * - 非 JPEG（PNG 等）：原样返回（iPhone 照片经 Safari 上传时已转为 JPEG）
 */

/** 从 JPEG ArrayBuffer 解析 EXIF orientation；无 EXIF/解析失败返回 1 */
function readOrientation(buf) {
  const dv = new DataView(buf);
  if (dv.getUint16(0) !== 0xffd8) return 1; // 非 JPEG
  let off = 2;
  while (off + 4 <= dv.byteLength) {
    const marker = dv.getUint16(off);
    if ((marker & 0xff00) !== 0xff00) return 1;
    const size = dv.getUint16(off + 2);
    if (marker === 0xffe1 && off + 4 + 6 <= dv.byteLength) {
      // APP1，检查 "Exif\0\0"
      if (dv.getUint32(off + 4) === 0x45786966 && dv.getUint16(off + 8) === 0x0000) {
        return parseTiffOrientation(dv, off + 10);
      }
    }
    if (marker === 0xffda) break; // SOS，后面是像素流
    off += 2 + size;
  }
  return 1;
}

/** 解析 APP1 内 TIFF 头的 IFD0 orientation（tag 0x0112） */
function parseTiffOrientation(dv, tiffStart) {
  const le = dv.getUint16(tiffStart) === 0x4949; // "II" little-endian
  const u16 = (p) => dv.getUint16(p, le);
  const u32 = (p) => dv.getUint32(p, le);
  if (u16(tiffStart + 2) !== 0x002a) return 1; // TIFF magic
  const ifd0 = tiffStart + u32(tiffStart + 4);
  const count = u16(ifd0);
  for (let i = 0; i < count; i++) {
    const e = ifd0 + 2 + i * 12;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** 无损剥离：复制 JPEG 时跳过 APP1(EXIF)/APP13(IPTC)/COM(注释) 段 */
function losslessStrip(buf) {
  const dv = new DataView(buf);
  const parts = [buf.slice(0, 2)]; // SOI
  let off = 2;
  while (off + 4 <= dv.byteLength) {
    const marker = dv.getUint16(off);
    if (marker === 0xffda) break; // SOS：之后全是像素流，整体保留
    const size = dv.getUint16(off + 2);
    const isExif = marker === 0xffe1 && dv.getUint32(off + 4) === 0x45786966;
    const isIptc = marker === 0xffed;
    const isCom = marker === 0xfffe;
    if (!isExif && !isIptc && !isCom) parts.push(buf.slice(off, off + 2 + size));
    off += 2 + size;
  }
  parts.push(buf.slice(off)); // SOS 起的全部余下内容（含 EOI）
  return new Blob(parts, { type: 'image/jpeg' });
}

/** orientation → canvas transform（1-8 全覆盖，5-8 需交换宽高） */
const ORIENT_TRANSFORMS = {
  2: ['scaleX', -1], 3: ['rotate', 180], 4: ['scaleY', -1],
  5: ['rotate', 90], 6: ['rotate', 90], 7: ['rotate', 270], 8: ['rotate', 270]
};

/** 重编码剥离：按 orientation 烘焙方向 + 去掉全部元数据 */
async function bakeAndStrip(file, orientation) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const swap = orientation >= 5;
    const w = swap ? img.naturalHeight : img.naturalWidth;
    const h = swap ? img.naturalWidth : img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.translate(w / 2, h / 2);
    switch (orientation) {
      case 2: ctx.scale(-1, 1); break;
      case 3: ctx.rotate(Math.PI); break;
      case 4: ctx.scale(1, -1); break;
      case 5: ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1); break;
      case 6: ctx.rotate(0.5 * Math.PI); break;
      case 7: ctx.rotate(1.5 * Math.PI); ctx.scale(1, -1); break;
      case 8: ctx.rotate(1.5 * Math.PI); break;
    }
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 入口：处理待上传文件，返回 { file, mode }
 *   mode: 'lossless'（原像素未动）| 'baked'（方向已烘焙重编码）| 'passthrough'（非 JPEG）
 */
export async function stripPrivateMetadata(file) {
  if (file.type !== 'image/jpeg' && !/\.jpe?g$/i.test(file.name)) {
    return { file, mode: 'passthrough' };
  }
  const buf = await file.arrayBuffer();
  const orientation = readOrientation(buf);
  if (orientation >= 2 && orientation <= 8) {
    return { file: await bakeAndStrip(new Blob([buf], { type: 'image/jpeg' }), orientation), mode: 'baked' };
  }
  const cleaned = losslessStrip(buf);
  // 处理后可能比原文件还大（罕见）或没变化——都无所谓，取小的意义不大，直接用
  const out = new File([cleaned], file.name.replace(/\.heic$/i, '.jpg') || 'photo.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now()
  });
  return { file: out, mode: 'lossless' };
}

/**
 * 手动旋转 90°（用于源头就没有 orientation 信息的照片，如某些第三方相机 App）。
 * quarterTurns：顺时针 90° 的次数（1 或 3=逆时针 90°）。
 * 返回旋转后的 JPEG File。
 */
export async function rotateQuarter(file, quarterTurns = 1) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const n = ((quarterTurns % 4) + 4) % 4;
    if (n === 0) return file;
    const swap = n % 2 === 1;
    const w = swap ? img.naturalHeight : img.naturalWidth;
    const h = swap ? img.naturalWidth : img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.translate(w / 2, h / 2);
    ctx.rotate(n * 0.5 * Math.PI);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
