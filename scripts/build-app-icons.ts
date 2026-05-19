import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const svgPath = path.join(ROOT, "assets", "app-icon.svg");
const iconDir = path.join(ROOT, "assets", "icons");
const iconsetDir = path.join(iconDir, "app.iconset");

const sizes = [16, 32, 64, 128, 256, 512, 1024];

function main(): void {
  if (!fs.existsSync(svgPath)) throw new Error(`Missing ${svgPath}`);
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const size of sizes) {
    const pngPath = path.join(iconDir, `app-${size}.png`);
    renderPng(size, pngPath);
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

function renderPng(size: number, output: string): void {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync(
    "sips",
    ["-s", "format", "png", "-z", String(size), String(size), svgPath, "--out", output],
    {
      stdio: "ignore",
    },
  );
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

main();
