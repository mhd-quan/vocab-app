import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..");
const sourcePath = path.join(ROOT, "assets", "source-icon.png");
const iconDir = path.join(ROOT, "assets", "icons");
const iconsetDir = path.join(iconDir, "app.iconset");

const sizes = [16, 32, 64, 128, 256, 512, 1024];

// Apple uses a continuous-curve squircle. A rounded rect with rx = 22.46% of
// width (230/1024) is the standard SVG approximation and matches what most
// shipping macOS/iOS app icons use.
const CORNER_RATIO = 230 / 1024;
const ICON_OCCUPANCY_RATIO = 0.9;

function squircleMask(size: number): Buffer {
  const r = Math.round(size * CORNER_RATIO);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#ffffff"/></svg>`,
  );
}

async function renderPng(size: number, output: string): Promise<void> {
  const innerSize = Math.max(1, Math.round(size * ICON_OCCUPANCY_RATIO));
  const inset = Math.round((size - innerSize) / 2);
  const resized = await sharp(sourcePath)
    .resize(innerSize, innerSize, { fit: "cover", kernel: "lanczos3" })
    .ensureAlpha()
    .composite([{ input: squircleMask(innerSize), blend: "dest-in" }])
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: inset, top: inset }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function main(): Promise<void> {
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing ${sourcePath}`);
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const size of sizes) {
    const pngPath = path.join(iconDir, `app-${size}.png`);
    await renderPng(size, pngPath);
  }

  for (const size of [16, 32, 128, 256, 512]) {
    fs.copyFileSync(
      path.join(iconDir, `app-${size}.png`),
      path.join(iconsetDir, `icon_${size}x${size}.png`),
    );
    fs.copyFileSync(
      path.join(iconDir, `app-${size * 2}.png`),
      path.join(iconsetDir, `icon_${size}x${size}@2x.png`),
    );
  }

  execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", path.join(iconDir, "app.icns")]);
  writeIco(path.join(iconDir, "app.ico"), [16, 32, 64, 128, 256]);
}

function writeIco(output: string, icoSizes: number[]): void {
  const images = icoSizes.map((size) => fs.readFileSync(path.join(iconDir, `app-${size}.png`)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries: Buffer[] = [];
  let offset = header.length + images.length * 16;
  for (let i = 0; i < icoSizes.length; i += 1) {
    const size = icoSizes[i] ?? 0;
    const image = images[i];
    if (!image) continue;
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += image.length;
  }

  fs.writeFileSync(output, Buffer.concat([header, ...entries, ...images]));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
