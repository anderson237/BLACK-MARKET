import { getToken } from "./api";

// ---------------------------------------------------------------------------
// AI-driven ad media generation (free tier: Pollinations.ai, no key required)
// ---------------------------------------------------------------------------
const POLLINATIONS_IMAGE = "https://image.pollinations.ai/prompt/";

export interface AiAdProduct {
  title?: string;
  description?: string;
  category?: string;
}

export function buildAdPrompt(product: AiAdProduct): string {
  const title = String(product.title || "").trim();
  const category = String(product.category || "streetwear").trim();
  const desc = String(product.description || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  const base =
    title ||
    category ||
    "premium streetwear fashion product";
  return (
    `${base} — ${desc} ` +
    "advertising product photo, premium e-commerce hero shot, dramatic studio lighting, " +
    "dark red and black background, neon accents, professional product photography, " +
    "hyper detailed, vertical composition 9:16"
  );
}

export function pollinationsImageUrl(prompt: string, width = 720, height = 1280, seed?: number): string {
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    nologo: "true",
    model: "flux",
  });
  if (seed != null) params.set("seed", String(seed));
  return `${POLLINATIONS_IMAGE}${encodeURIComponent(prompt)}?${params.toString()}`;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Échec du chargement de l'image générée."));
    img.src = src;
  });
}

// Draw the generated image with the official BLACK MARKET © watermark baked in.
export function watermarkCanvas(img: HTMLImageElement, targetW = 720, targetH = 1280): string {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non supporté.");

  // cover-fit the generated image
  const scale = Math.max(targetW / img.width, targetH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);

  // slight dark overlay for text legibility
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fillRect(0, 0, targetW, targetH);

  // BLACK MARKET © 2026 diagonal watermark
  ctx.save();
  ctx.translate(targetW / 2, targetH / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.font = `bold ${Math.round(targetW * 0.05)}px monospace`;
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const spacing = Math.round(targetH * 0.32);
  for (let d = -targetH; d < targetH * 2; d += spacing) {
    ctx.fillText("BLACK MARKET © 2026", 0, d);
  }
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.9);
}

// Generate an AI ad photo (Pollinations Flux), watermark it, return a dataURL.
export async function generateAdImage(product: AiAdProduct, seed?: number): Promise<string> {
  const prompt = buildAdPrompt(product);
  const url = pollinationsImageUrl(prompt, 720, 1280, seed);
  const img = await loadImage(url);
  return watermarkCanvas(img);
}

// Persist a watermarked dataURL through the server uploader (returns /api/img/...).
export async function uploadWatermarkedImage(dataUrl: string): Promise<string> {
  const token = getToken();
  const res = await fetch("/api/upload-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ imageBase64: dataUrl }),
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    throw new Error(data.error || "Erreur lors de l'upload de l'image générée.");
  }
  return data.url as string;
}
