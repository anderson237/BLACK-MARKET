import sharp from "sharp";
import { writeFileSync, mkdirSync, copyFileSync } from "fs";
import path from "path";
import { INITIAL_PRODUCTS } from "../src/data";
import { getProductPageHtml } from "../src/lib/productPage";
import { getHtmlTemplateCode } from "../src/lib/template";

const BASE_URL = "https://anderson237.github.io/BLACK-MARKET/";
const PHONE_NUMBER = "237683963007";
const ROOT = path.join(process.cwd(), "client-site");
const IMG_DIR = path.join(ROOT, "img");
const PAGES_DIR = path.join(ROOT, "p");

function watermarkSvg(w: number, h: number): Buffer {
  const fs = Math.max(16, Math.round(w * 0.055));
  const texts: string[] = [];
  const spacingY = Math.max(90, Math.round(h * 0.30));
  const spacingX = Math.max(200, Math.round(w * 0.72));
  for (let dy = -h; dy <= h * 2; dy += spacingY) {
    for (let dx = -w; dx <= w * 2; dx += spacingX) {
      texts.push(
        `<text x="${dx}" y="${dy}" transform="rotate(-25 ${dx} ${dy})" text-anchor="middle" dominant-baseline="middle">BLACK MARKET © 2026</text>`
      );
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <style>text { fill: rgba(255,255,255,0.32); font-family: monospace; font-weight: bold; font-size: ${fs}px; }</style>
  <g>${texts.join("")}</g>
</svg>`;
  return Buffer.from(svg);
}

async function watermarkImage(src: string, out: string): Promise<void> {
  const res = await fetch(src, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error("HTTP " + res.status + " pour " + src);
  const buffer = Buffer.from(await res.arrayBuffer());
  const resized = sharp(buffer, { failOn: "none" }).resize(1200, 1200, { fit: "inside", withoutEnlargement: true });
  const meta = await resized.metadata();
  const w = meta.width || 1200;
  const h = meta.height || 800;
  await resized
    .composite([{ input: watermarkSvg(w, h) }])
    .jpeg({ quality: 88 })
    .toFile(out);
}

async function main() {
  mkdirSync(IMG_DIR, { recursive: true });
  mkdirSync(PAGES_DIR, { recursive: true });

  const products = INITIAL_PRODUCTS;
  for (const p of products) {
    const imgOut = path.join(IMG_DIR, p.id + ".jpg");
    await watermarkImage(p.imageUrl, imgOut);
    const html = getProductPageHtml(p, BASE_URL, PHONE_NUMBER);
    writeFileSync(path.join(PAGES_DIR, p.id + ".html"), html, "utf8");
    console.log("->", p.id, p.title);
  }

  copyFileSync(path.join(IMG_DIR, products[0].id + ".jpg"), path.join(IMG_DIR, "brand.jpg"));
  writeFileSync(path.join(ROOT, "index.html"), getHtmlTemplateCode({ siteUrl: BASE_URL }), "utf8");
  console.log("-> index.html + brand.jpg OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
