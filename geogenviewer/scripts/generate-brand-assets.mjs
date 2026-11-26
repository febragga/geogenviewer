import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const appDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

// Brand mark geometry: upward equilateral triangle in verified portfolio blue #3B82F6 (59, 130, 246)
const BRAND_R = 59;
const BRAND_G = 130;
const BRAND_B = 246;

const TRIANGLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="GeoGenViewer">
  <polygon points="32,9 57.4,53 6.6,53" fill="#3B82F6"/>
</svg>
`;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function renderTriangleIconPng(size, backgroundRgba = null) {
  const rgba = Buffer.alloc(size * size * 4);
  // Normalize SVG triangle coordinates (32,9), (57.4,53), (6.6,53) in 64x64 space
  const ax = (32 / 64) * size;
  const ay = (9 / 64) * size;
  const bx = (57.4 / 64) * size;
  const by = (53 / 64) * size;
  const cx = (6.6 / 64) * size;
  const cy = (53 / 64) * size;
  const samples = 4;
  const step = 1 / samples;
  const total = samples * samples;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) * step;
          const py = y + (sy + 0.5) * step;
          if (pointInTriangle(px, py, ax, ay, bx, by, cx, cy)) inside++;
        }
      }
      const alphaFrac = inside / total;
      const idx = (y * size + x) * 4;
      if (backgroundRgba) {
        const bgA = backgroundRgba[3] / 255;
        rgba[idx] = Math.round(BRAND_R * alphaFrac + backgroundRgba[0] * bgA * (1 - alphaFrac));
        rgba[idx + 1] = Math.round(BRAND_G * alphaFrac + backgroundRgba[1] * bgA * (1 - alphaFrac));
        rgba[idx + 2] = Math.round(BRAND_B * alphaFrac + backgroundRgba[2] * bgA * (1 - alphaFrac));
        rgba[idx + 3] = 255;
      } else {
        rgba[idx] = BRAND_R;
        rgba[idx + 1] = BRAND_G;
        rgba[idx + 2] = BRAND_B;
        rgba[idx + 3] = Math.round(alphaFrac * 255);
      }
    }
  }
  return encodePng(size, size, rgba);
}

function encodeIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6 + count * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4);

  let offset = header.length;
  for (let i = 0; i < count; i++) {
    const { size, png } = images[i];
    const dir = 6 + i * 16;
    header[dir] = size >= 256 ? 0 : size;
    header[dir + 1] = size >= 256 ? 0 : size;
    header[dir + 2] = 0;
    header[dir + 3] = 0;
    header.writeUInt16LE(1, dir + 4);
    header.writeUInt16LE(32, dir + 6);
    header.writeUInt32LE(png.length, dir + 8);
    header.writeUInt32LE(offset, dir + 12);
    offset += png.length;
  }

  return Buffer.concat([header, ...images.map((item) => item.png)]);
}

function renderOgCardPng() {
  const width = 1200;
  const height = 630;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isGrid = x % 60 === 0 || y % 60 === 0;
      rgba[idx] = isGrid ? 28 : 12;
      rgba[idx + 1] = isGrid ? 31 : 13;
      rgba[idx + 2] = isGrid ? 33 : 14;
      rgba[idx + 3] = 255;
    }
  }
  // Draw crisp equilateral triangle brand mark centered vertically on left architectural axis
  const cx = 600;
  const cy = 285;
  const radius = 140;
  const ax = cx;
  const ay = cy - radius;
  const bx = cx + radius * Math.sin((2 * Math.PI) / 3);
  const by = cy - radius * Math.cos((2 * Math.PI) / 3);
  const dx = cx - radius * Math.sin((2 * Math.PI) / 3);
  const dy = by;

  for (let y = Math.floor(ay) - 2; y <= Math.ceil(by) + 2; y++) {
    for (let x = Math.floor(dx) - 2; x <= Math.ceil(bx) + 2; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (pointInTriangle(x + 0.5, y + 0.5, ax, ay, bx, by, dx, dy)) {
        const idx = (y * width + x) * 4;
        rgba[idx] = BRAND_R;
        rgba[idx + 1] = BRAND_G;
        rgba[idx + 2] = BRAND_B;
        rgba[idx + 3] = 255;
      }
    }
  }
  return encodePng(width, height, rgba);
}

await mkdir(path.join(appDir, "app"), { recursive: true });
await mkdir(path.join(appDir, "public", "icons"), { recursive: true });
await mkdir(path.join(appDir, "public", "brand"), { recursive: true });

const png16 = renderTriangleIconPng(16);
const png32 = renderTriangleIconPng(32);
const png48 = renderTriangleIconPng(48);
const apple180 = renderTriangleIconPng(180, [12, 13, 14, 255]);
const png192 = renderTriangleIconPng(192);
const png512 = renderTriangleIconPng(512);
const ico = encodeIco([
  { size: 16, png: png16 },
  { size: 32, png: png32 },
  { size: 48, png: png48 },
]);

await writeFile(path.join(appDir, "app", "icon.svg"), TRIANGLE_SVG);
await writeFile(path.join(appDir, "app", "favicon.ico"), ico);
await writeFile(path.join(appDir, "app", "apple-icon.png"), apple180);
await writeFile(path.join(appDir, "public", "brand", "geogenviewer-mark.svg"), TRIANGLE_SVG);
await writeFile(path.join(appDir, "public", "icons", "icon-192.png"), png192);
await writeFile(path.join(appDir, "public", "icons", "icon-512.png"), png512);
await writeFile(path.join(appDir, "public", "brand", "geogenviewer-og.png"), renderOgCardPng());

console.log("Generated GeoGenViewer brand assets (#3B82F6 triangle): icon.svg, favicon.ico (16/32/48), apple-icon.png, icon-192.png, icon-512.png, geogenviewer-og.png");
