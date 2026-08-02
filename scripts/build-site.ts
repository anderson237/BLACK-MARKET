import sharp from "sharp";
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from "fs";
import path from "path";
import { INITIAL_PRODUCTS } from "../src/data";
import { getProductPageHtml } from "../src/lib/productPage";
import { getHtmlTemplateCode } from "../src/lib/template";

const BASE_URL = "https://blackmarket-import-export.netlify.app/";
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
  if (existsSync(out)) return;
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

function brandLogoSvg(w = 1200, h = 630): Buffer {
  // Flame badge (from the favicon) + wordmark, on the site's dark background.
  const fs = Math.round(h * 0.11);
  const badge = Math.round(h * 0.34);
  const badgeX = (w - badge) / 2;
  const badgeY = h * 0.13;
  const flame = `M${badgeX + badge / 2} ${badgeY + badge * 0.10}C${badgeX + badge / 2} ${badgeY + badge * 0.10} ${badgeX + badge * 0.66} ${badgeY + badge * 0.42} ${badgeX + badge * 0.66} ${badgeY + badge * 0.56}C${badgeX + badge * 0.66} ${badgeY + badge * 0.78} ${badgeX + badge * 0.50} ${badgeY + badge * 0.88} ${badgeX + badge * 0.50} ${badgeY + badge * 0.88}C${badgeX + badge * 0.50} ${badgeY + badge * 0.88} ${badgeX + badge * 0.34} ${badgeY + badge * 0.78} ${badgeX + badge * 0.34} ${badgeY + badge * 0.56}C${badgeX + badge * 0.34} ${badgeY + badge * 0.42} ${badgeX + badge / 2} ${badgeY + badge * 0.10} ${badgeX + badge / 2} ${badgeY + badge * 0.10}Z`;
  const flameInner = `M${badgeX + badge / 2} ${badgeY + badge * 0.30}C${badgeX + badge / 2} ${badgeY + badge * 0.30} ${badgeX + badge * 0.60} ${badgeY + badge * 0.50} ${badgeX + badge * 0.60} ${badgeY + badge * 0.62}C${badgeX + badge * 0.60} ${badgeY + badge * 0.74} ${badgeX + badge * 0.50} ${badgeY + badge * 0.84} ${badgeX + badge * 0.50} ${badgeY + badge * 0.84}C${badgeX + badge * 0.50} ${badgeY + badge * 0.84} ${badgeX + badge * 0.40} ${badgeY + badge * 0.74} ${badgeX + badge * 0.40} ${badgeY + badge * 0.62}C${badgeX + badge * 0.40} ${badgeY + badge * 0.50} ${badgeX + badge / 2} ${badgeY + badge * 0.30} ${badgeX + badge / 2} ${badgeY + badge * 0.30}Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="#08080c"/>
  <rect x="${badgeX}" y="${badgeY}" width="${badge}" height="${badge}" rx="${Math.round(badge * 0.22)}" fill="#ff2a2a"/>
  <path d="${flame}" fill="#ffffff"/>
  <path d="${flameInner}" fill="#ffbfbf"/>
  <text x="${w / 2}" y="${h * 0.74}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${fs}" fill="#ff2a2a" letter-spacing="${Math.round(fs * 0.28)}">BLACK MARKET</text>
  <text x="${w / 2}" y="${h * 0.86}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${Math.round(fs * 0.42)}" fill="#9ca3af" letter-spacing="${Math.round(fs * 0.55)}">SOURCING EXCLUSIF CHINE</text>
</svg>`;
  return Buffer.from(svg);
}

async function generateBrandLogo(out: string): Promise<void> {
  await sharp(brandLogoSvg())
    .jpeg({ quality: 92 })
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

  const brandPath = path.join(IMG_DIR, "brand.jpg");
  if (!existsSync(brandPath)) {
    await generateBrandLogo(brandPath);
  }
  writeFileSync(path.join(ROOT, "index.html"), getHtmlTemplateCode({ siteUrl: BASE_URL }), "utf8");
  console.log("-> index.html + brand.jpg OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
