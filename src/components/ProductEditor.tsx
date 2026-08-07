import React, { useState } from "react";
import { X, Save, Trash2, Plus, Image as ImageIcon, Upload, Video, Clapperboard, Sparkles, Wand2, FileCog } from "lucide-react";
import { Product } from "../types";
import RichEditor from "./RichEditor";
import { motion, AnimatePresence } from "motion/react";
import { getToken, refineText } from "../lib/api";
import { generateAdImage, uploadWatermarkedImage, loadImage, pollinationsImageUrl, buildAdPrompt } from "../lib/aiAds";

interface ProductEditorProps {
  product: Product;
  categories: string[];
  isNew?: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export default function ProductEditor({ product, categories, isNew, onClose, onSave, onDelete }: ProductEditorProps) {
  const [draft, setDraft] = useState<Product>({ ...product, features: [...product.features], gallery: [...(product.gallery || [])] });
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [generatingAiGallery, setGeneratingAiGallery] = useState(false);
  const [generatingAiVideo, setGeneratingAiVideo] = useState(false);
  const [refiningDesc, setRefiningDesc] = useState(false);
  const [refiningTech, setRefiningTech] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const set = (patch: Partial<Product>) => setDraft((d) => ({ ...d, ...patch }));

  const watermarkFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const raw = new Image();
      raw.onload = () => {
        try {
          const w = raw.naturalWidth || 1200;
          const h = raw.naturalHeight || 800;
          const scale = Math.min(1, 1200 / w);
          const cw = Math.round(w * scale);
          const ch = Math.round(h * scale);
          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas");
          ctx.drawImage(raw, 0, 0, cw, ch);
          ctx.save();
          ctx.translate(cw / 2, ch / 2);
          ctx.rotate(-Math.PI / 6);
          const fs = Math.max(16, Math.round(cw * 0.055));
          ctx.font = "bold " + fs + "px monospace";
          ctx.fillStyle = "rgba(255,255,255,0.32)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0,0,0,0.75)";
          ctx.shadowBlur = 5;
          const spacingY = Math.max(90, Math.round(ch * 0.30));
          const spacingX = Math.max(200, Math.round(cw * 0.72));
          for (let dy = -ch; dy <= ch * 2; dy += spacingY) {
            for (let dx = -cw; dx <= cw * 2; dx += spacingX) {
              ctx.fillText("DEEP ROOTS © 2026", dx, dy);
            }
          }
          ctx.restore();
          resolve(canvas.toDataURL("image/jpeg", 0.88));
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      raw.onerror = reject;
      raw.src = url;
    });
  };

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    watermarkFile(file)
      .then(async (watermarkedBase64) => {
        try {
          const token = getToken();
          const res = await fetch("/api/upload-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ imageBase64: watermarkedBase64 }),
          });
          const data = await res.json();
          if (!res.ok || !data.url) {
            setUploadError(data.error || "Erreur lors de l'upload.");
          } else {
            set({ imageUrl: data.url });
          }
        } catch {
          setUploadError("Erreur réseau lors de l'upload de l'image.");
        } finally {
          setUploading(false);
        }
      })
      .catch(() => {
        setUploadError("Impossible de lire l'image (fichier invalide).");
        setUploading(false);
      });
  };

  const handleGalleryFiles = (files: FileList | undefined) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError("");
    const list = Array.from(files);
    let index = 0;

    const uploadNext = async () => {
      if (index >= list.length) {
        setUploading(false);
        return;
      }
      const file = list[index];
      index += 1;
      try {
        const watermarkedBase64 = await watermarkFile(file);
        const token = getToken();
        const res = await fetch("/api/upload-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ imageBase64: watermarkedBase64 }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setUploadError(data.error || "Erreur lors de l'upload d'une photo.");
        } else {
          setDraft((d) => ({ ...d, gallery: [...(d.gallery || []), data.url] }));
        }
      } catch {
        setUploadError("Impossible de lire une des images (fichier invalide).");
      }
      await uploadNext();
    };

    uploadNext();
  };

  const handleVideoFile = (file: File | undefined) => {
    if (!file) return;
    setUploadingVideo(true);
    setUploadError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const videoBase64 = String(reader.result || "");
        const token = getToken();
        const res = await fetch("/api/upload-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ videoBase64 }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setUploadError(data.error || "Erreur lors de l'upload de la vidéo.");
        } else {
          set({ videoUrl: data.url });
        }
      } catch {
        setUploadError("Erreur réseau lors de l'upload de la vidéo.");
      } finally {
        setUploadingVideo(false);
      }
    };
    reader.onerror = () => {
      setUploadError("Impossible de lire la vidéo (fichier invalide).");
      setUploadingVideo(false);
    };
    reader.readAsDataURL(file);
  };

  const removeGalleryImage = (idx: number) =>
    setDraft((d) => ({ ...d, gallery: (d.gallery || []).filter((_, i) => i !== idx) }));

  const setFeature = (idx: number, value: string) =>
    setDraft((d) => ({ ...d, features: d.features.map((f, i) => (i === idx ? value : f)) }));

  const addFeature = () => setDraft((d) => ({ ...d, features: [...d.features, ""] }));

  const removeFeature = (idx: number) =>
    setDraft((d) => ({ ...d, features: d.features.filter((_, i) => i !== idx) }));

  const handleSave = () => {
    onSave({ ...draft, features: draft.features.filter((f) => f.trim() !== "") });
    onClose();
  };

  // Generate an AI-driven ad photo for this product (Pollinations, free, no key),
  // watermark it client-side and persist it through the uploader.
  const handleGenerateAiPhoto = async () => {
    if (generatingAi) return;
    if (!draft.title.trim() && !draft.description.trim()) {
      setUploadError("Renseignez au moins un titre pour générer une photo IA pertinente.");
      return;
    }
    setGeneratingAi(true);
    setUploadError("");
    try {
      const dataUrl = await generateAdImage(draft);
      const url = await uploadWatermarkedImage(dataUrl);
      set({ imageUrl: url });
    } catch (e: any) {
      setUploadError(e?.message || "Échec de la génération IA (Pollinations). Réessayez.");
    } finally {
      setGeneratingAi(false);
    }
  };

  // Generate 3 AI-driven carousel photos for the product gallery.
  const handleGenerateAiGallery = async () => {
    if (generatingAiGallery) return;
    if (!draft.title.trim() && !draft.description.trim()) {
      setUploadError("Renseignez au moins un titre pour générer des photos IA pertinentes.");
      return;
    }
    setGeneratingAiGallery(true);
    setUploadError("");
    try {
      const added: string[] = [];
      for (let i = 0; i < 3; i++) {
        setUploadError(`Génération carrousel IA ${i + 1}/3...`);
        const dataUrl = await generateAdImage(draft, 2000 + i * 11);
        const url = await uploadWatermarkedImage(dataUrl);
        added.push(url);
      }
      setUploadError("");
      setDraft((d) => ({ ...d, gallery: [...(d.gallery || []), ...added] }));
    } catch (e: any) {
      setUploadError(e?.message || "Échec de la génération du carrousel IA. Réessayez.");
    } finally {
      setGeneratingAiGallery(false);
    }
  };

  // Generate an AI-driven product video (4 slides, 9:16) and upload it as videoUrl.
  const handleGenerateAiVideo = async () => {
    if (generatingAiVideo) return;
    if (!draft.title.trim()) {
      setUploadError("Renseignez au moins un titre pour générer la vidéo IA.");
      return;
    }
    setGeneratingAiVideo(true);
    setUploadError("");
    try {
      const W = 720;
      const H = 1280;
      const SLIDE_MS = 3000;
      const FPS = 30;
      const slides = buildVideoSlides();
      const TOTAL_MS = slides.length * SLIDE_MS;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas non supporté.");

      let img: HTMLImageElement | null = null;
      try {
        img = await loadImage(draft.imageUrl);
      } catch {
        img = null;
      }

      // 4 AI backgrounds, one per slide
      const aiBgs: (HTMLImageElement | null)[] = [];
      for (let i = 0; i < slides.length; i++) {
        setUploadError(`Visuels IA vidéo ${i + 1}/${slides.length}...`);
        try {
          const url = pollinationsImageUrl(buildAdPrompt(draft), 720, 1280, 3000 + i * 13);
          aiBgs.push(await loadImage(url));
        } catch {
          aiBgs.push(null);
        }
      }
      setUploadError("Composition de la vidéo IA...");

      const stream = canvas.captureStream(FPS);
      const mime = MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/webm;codecs=vp9";
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const finished = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start(200);
      const startTime = performance.now();
      const frame = () => {
        const elapsed = performance.now() - startTime;
        if (elapsed >= TOTAL_MS) {
          recorder.stop();
          return;
        }
        const idx = Math.min(slides.length - 1, Math.floor(elapsed / SLIDE_MS));
        const progress = Math.min(1, (elapsed % SLIDE_MS) / SLIDE_MS);
        drawSlideFrame(ctx, slides[idx], progress, img, aiBgs[idx], W, H);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      await finished;

      const blob = new Blob(chunks, { type: mime });
      const base64 = await blobToBase64(blob);
      const token = getToken();
      const res = await fetch("/api/upload-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ videoBase64: base64 }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setUploadError(data.error || "Erreur lors de l'upload de la vidéo générée.");
      } else {
        set({ videoUrl: data.url });
        setUploadError("");
      }
    } catch (e: any) {
      console.error("Génération vidéo IA échouée:", e);
      setUploadError(e?.message || "Échec de la génération de la vidéo IA.");
    } finally {
      setGeneratingAiVideo(false);
    }
  };

  // Optimize the sales pitch with Gemini (reuse current text or create from scratch).
  const handleRefineDescription = async () => {
    if (refiningDesc) return;
    setRefiningDesc(true);
    setUploadError("");
    try {
      const html = await refineText({
        field: "description",
        title: draft.title,
        category: draft.category,
        currentText: draft.description,
      });
      set({ description: html });
    } catch (e: any) {
      setUploadError(e?.message || "Échec de l'optimisation par l'IA (vérifiez GEMINI_API_KEY).");
    } finally {
      setRefiningDesc(false);
    }
  };

  // Present/restructure the technical fiche with Gemini.
  const handleRefineTechnical = async () => {
    if (refiningTech) return;
    setRefiningTech(true);
    setUploadError("");
    try {
      const html = await refineText({
        field: "technical",
        title: draft.title,
        category: draft.category,
        currentText: draft.originalDescription,
      });
      set({ originalDescription: html });
    } catch (e: any) {
      setUploadError(e?.message || "Échec de la présentation par l'IA (vérifiez GEMINI_API_KEY).");
    } finally {
      setRefiningTech(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const buildVideoSlides = () => {
    const priceXof = (draft.priceXof || 0).toLocaleString("fr-FR");
    return [
      { title: draft.title, subtitle: "⚠️ EN DIRECT DE SHENZHEN - LIMITED DROP", text: "Sourcing direct sans intermédiaires via DEEP ROOTS. Pièces vérifiées et filigranées.", badge: "EXCLUSIF" },
      { title: "PITCH PREMIUM", subtitle: "🔥 COP DIRECT", text: (draft.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) + "...", badge: "COPYWRITING IA" },
      { title: "SPÉCIFICATIONS", subtitle: "⚙️ ENQUÊTE QUALITÉ", text: (draft.features[0] || "Produit sélectionné par nos soins."), badge: "CONTRÔLE QUALITÉ" },
      { title: `TARIF : ${priceXof} F CFA`, subtitle: "💬 COMMANDE WHATSAPP IMMÉDIATE", text: "Cliquez sur 'Commander' pour ouvrir WhatsApp avec le bon de précommande pré-rempli.", badge: "TARIF USINE" },
    ];
  };

  const drawSlideFrame = (
    ctx: CanvasRenderingContext2D,
    s: { title: string; subtitle: string; text: string; badge: string },
    progress: number,
    img: HTMLImageElement | null,
    aiBg: HTMLImageElement | null,
    W: number,
    H: number
  ) => {
    const wrap = (text: string, maxWidth: number): string[] => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines;
    };

    if (aiBg) {
      const cover = Math.max(W / aiBg.width, H / aiBg.height);
      const dw = aiBg.width * cover;
      const dh = aiBg.height * cover;
      ctx.drawImage(aiBg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#1d0404");
      grad.addColorStop(0.5, "#000000");
      grad.addColorStop(1, "#10030c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      if (img) {
        const cover = Math.max(W / img.width, H / img.height);
        const dw = img.width * cover;
        const dh = img.height * cover;
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.filter = "blur(6px)";
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, W, H);
      }
    }

    const pad = Math.round(W * 0.08);
    ctx.fillStyle = "#e11d48";
    ctx.beginPath();
    ctx.roundRect(pad, 48, Math.min(W - pad * 2, 260), 44, 22);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(s.badge.toUpperCase(), pad + Math.min(W - pad * 2, 260) / 2, 70);

    ctx.fillStyle = "#e11d48";
    ctx.font = "bold 26px monospace";
    ctx.textAlign = "left";
    ctx.fillText(s.subtitle.toUpperCase(), pad, H * 0.32);

    ctx.fillStyle = "#fafafa";
    ctx.font = "900 52px Arial, sans-serif";
    const titleLines = wrap(s.title.toUpperCase(), W - pad * 2).slice(0, 4);
    let ty = H * 0.38;
    for (const ln of titleLines) {
      ctx.fillText(ln, pad, ty);
      ty += 62;
    }

    ctx.fillStyle = "rgba(226,232,240,0.92)";
    ctx.font = "26px Arial, sans-serif";
    const bodyLines = wrap(s.text, W - pad * 2).slice(0, 6);
    ty += 18;
    for (const ln of bodyLines) {
      ctx.fillText(ln, pad, ty);
      ty += 38;
    }

    ctx.fillStyle = "#e11d48";
    ctx.beginPath();
    ctx.roundRect(pad, H - 190, W - pad * 2, 92, 24);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 34px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PRÉCOMMANDER SUR WHATSAPP", W / 2, H - 138);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.font = "bold 60px monospace";
    ctx.textAlign = "center";
    const spacing = 240;
    for (let d = -H; d < H; d += spacing) {
      ctx.fillText("DEEP ROOTS", 0, d);
    }
    ctx.restore();

    ctx.fillStyle = "#e11d48";
    ctx.fillRect(0, H - 8, W * progress, 8);
  };

  const handleDelete = () => {
    if (window.confirm(`Supprimer définitivement "${draft.title}" du catalogue ?`)) {
      onDelete(product);
      onClose();
    }
  };

  const inputCls =
    "w-full p-2 bg-zinc-900 border border-zinc-800 text-slate-200 text-xs rounded-lg font-mono focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[60] overflow-y-auto">
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          className="bg-brand-card rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-brand-red/30 text-slate-200 my-8 flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-red to-[#900] px-6 py-4 flex items-center justify-between border-b border-brand-red/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center">
                <Save className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider font-mono">
                  {isNew ? "Nouveau Produit" : "Éditeur Produit WYSIWYG"}
                </h3>
                <p className="text-[10px] text-white/80">DEEP ROOTS // Fiche #{product.id}</p>
              </div>
            </div>
            <button onClick={onClose} className="bg-black/40 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Titre commercial</label>
              <input className={inputCls} value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Titre du produit" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Catégorie</label>
                <input className={inputCls} list="editor-categories" value={draft.category} onChange={(e) => set({ category: e.target.value })} />
                <datalist id="editor-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Prix achat source (¥ RMB)</label>
                <input type="number" className={inputCls} value={draft.sourceRmb ?? ""} onChange={(e) => set({ sourceRmb: Number(e.target.value) })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Prix vente EUR (€)</label>
                <input type="number" className={inputCls} value={draft.priceEur} onChange={(e) => set({ priceEur: Number(e.target.value) })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Prix vente XOF (F CFA)</label>
                <input type="number" className={inputCls} value={draft.priceXof} onChange={(e) => set({ priceXof: Number(e.target.value) })} />
              </div>
            </div>

            {/* Image */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Image produit (upload direct, filigrane automatique)</label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0">
                  {draft.imageUrl ? (
                    <img src={draft.imageUrl} alt="aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-zinc-700" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-slate-300 px-3 py-2 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5 text-brand-red" />
                      {uploading ? "FILIGRANE EN COURS..." : "UPLOADER UNE IMAGE"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => handleImageFile(e.target.files?.[0])}
                      />
                    </label>
                    <button
                      onClick={handleGenerateAiPhoto}
                      disabled={generatingAi}
                      className="bg-brand-red/15 hover:bg-brand-red/25 border border-brand-red/40 text-brand-red px-3 py-2 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Générer une photo publicitaire IA (Pollinations Flux, gratuit, sans clé API)"
                    >
                      {generatingAi ? <Upload className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {generatingAi ? "GÉNÉRATION IA..." : "GÉNÉRER PHOTO PUB IA"}
                    </button>
                    {draft.imageUrl && draft.imageUrl.startsWith("/api/img/") && (
                      <span className="text-[9px] text-green-500 font-mono">FILIGRANÉE ✔</span>
                    )}
                  </div>
                  <p className="text-[9px] text-zinc-600 font-mono leading-relaxed">
                    Le filigrane est appliqué automatiquement avant l'envoi au serveur — aucun logiciel externe requis.
                  </p>
                  {uploadError && <p className="text-[10px] text-red-400 font-mono">{uploadError}</p>}
                </div>
              </div>
              <input className={inputCls} value={draft.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://... (ou /api/img/xxx.jpg)" />
            </div>

            {/* Gallery: additional product photos (carousel) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">
                  Galerie photos (carrousel client) — {draft.gallery?.length || 0} photo(s)
                </label>
                <button
                  onClick={handleGenerateAiGallery}
                  disabled={generatingAiGallery}
                  className="bg-brand-red/15 hover:bg-brand-red/25 border border-brand-red/40 text-brand-red px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Générer 3 photos de carrousel par IA (Pollinations Flux, gratuit, sans clé API)"
                >
                  {generatingAiGallery ? <Upload className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {generatingAiGallery ? "GÉNÉRATION..." : "GÉNÉRER 3 PHOTOS IA"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(draft.gallery || []).map((url, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 group/g">
                    <img src={url} alt={`gallery ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeGalleryImage(idx)}
                      className="absolute inset-0 bg-black/70 text-red-400 opacity-0 group-hover/g:opacity-100 transition-opacity flex items-center justify-center"
                      title="Retirer cette photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <label className="w-16 h-16 rounded-lg border border-dashed border-zinc-700 hover:border-brand-red/60 bg-zinc-900/50 flex items-center justify-center cursor-pointer transition-all">
                  <Plus className="w-5 h-5 text-zinc-500" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => { handleGalleryFiles(e.target.files || undefined); e.target.value = ""; }}
                  />
                </label>
              </div>
              <p className="text-[9px] text-zinc-600 font-mono leading-relaxed">
                Upload multiple filigrané automatiquement, ou génération de 3 photos publicitaires par IA (Pollinations, gratuit, sans clé API).
              </p>
            </div>

            {/* Product video */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Vidéo produit (carrousel client)</label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-14 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0">
                  {draft.videoUrl ? (
                    <video src={draft.videoUrl} className="w-full h-full object-cover" muted />
                  ) : (
                    <Clapperboard className="w-6 h-6 text-zinc-700" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-slate-300 px-3 py-2 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all">
                      <Video className="w-3.5 h-3.5 text-brand-red" />
                      {uploadingVideo ? "UPLOAD EN COURS..." : "UPLOADER UNE VIDÉO (MP4/WebM)"}
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                        className="hidden"
                        disabled={uploadingVideo}
                        onChange={(e) => handleVideoFile(e.target.files?.[0])}
                      />
                    </label>
                    <button
                      onClick={handleGenerateAiVideo}
                      disabled={generatingAiVideo}
                      className="bg-brand-red/15 hover:bg-brand-red/25 border border-brand-red/40 text-brand-red px-3 py-2 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Générer une vidéo publicitaire IA (4 slides, visuels Flux + filigrane + CTA), puis l'attacher au produit"
                    >
                      {generatingAiVideo ? <Upload className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      {generatingAiVideo ? "GÉNÉRATION VIDÉO IA..." : "GÉNÉRER VIDÉO PUB IA"}
                    </button>
                    {draft.videoUrl && (
                      <button
                        onClick={() => set({ videoUrl: undefined })}
                        className="text-[10px] text-red-400 font-mono hover:underline"
                      >
                        Retirer la vidéo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* WYSIWYG: sales pitch */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Argumentaire de vente (WYSIWYG)</label>
                <button
                  onClick={handleRefineDescription}
                  disabled={refiningDesc}
                  className="bg-brand-red/15 hover:bg-brand-red/25 border border-brand-red/40 text-brand-red px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Générer ou optimiser l'argumentaire de vente par IA (Gemini) : reprend l'actuel et l'améliore, ou en crée un selon le produit"
                >
                  {refiningDesc ? <Upload className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {refiningDesc ? "GÉNÉRATION IA..." : "GÉNÉRER / OPTIMISER PAR IA"}
                </button>
              </div>
              <RichEditor value={draft.description} onChange={(html) => set({ description: html })} placeholder="Votre pitch de vente premium..." minHeight={130} />
            </div>

            {/* WYSIWYG: technical fiche */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Fiche technique traduite (WYSIWYG)</label>
                <button
                  onClick={handleRefineTechnical}
                  disabled={refiningTech}
                  className="bg-brand-red/15 hover:bg-brand-red/25 border border-brand-red/40 text-brand-red px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Présenter la fiche technique par IA (Gemini) : arrange, ajuste la présentation ainsi que la quantité et la qualité des informations"
                >
                  {refiningTech ? <Upload className="w-3 h-3 animate-spin" /> : <FileCog className="w-3 h-3" />}
                  {refiningTech ? "PRÉSENTATION IA..." : "PRÉSENTER PAR IA"}
                </button>
              </div>
              <RichEditor value={draft.originalDescription || ""} onChange={(html) => set({ originalDescription: html })} placeholder="Traduction technique détaillée..." minHeight={100} />
            </div>

            {/* Features editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Bénéfices clés / Features</label>
                <button onClick={addFeature} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-brand-red px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1">
                  <Plus className="w-3 h-3" /> AJOUTER
                </button>
              </div>
              <div className="space-y-1.5">
                {draft.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-brand-red font-bold text-xs shrink-0">▪</span>
                    <input className={inputCls} value={f} onChange={(e) => setFeature(i, e.target.value)} placeholder={`Feature ${i + 1}`} />
                    <button onClick={() => removeFeature(i)} className="text-zinc-600 hover:text-red-400 p-1 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Chinese source (collapsible) */}
            <details className="text-xs border border-zinc-800 rounded-xl p-3 bg-black/30">
              <summary className="font-mono text-[10px] text-zinc-500 uppercase hover:text-zinc-300 cursor-pointer">Source chinoise (titre + description)</summary>
              <div className="mt-3 space-y-3">
                <input className={inputCls} value={draft.chineseTitle || ""} onChange={(e) => set({ chineseTitle: e.target.value })} placeholder="Titre chinois" />
                <textarea rows={3} className={inputCls} value={draft.chineseDescription || ""} onChange={(e) => set({ chineseDescription: e.target.value })} placeholder="Description chinoise d'origine" />
              </div>
            </details>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-zinc-800 flex gap-3 bg-black/30">
            <button
              onClick={handleSave}
              className="flex-1 bg-brand-red hover:bg-red-700 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-brand-red/45"
            >
              <Save className="w-4 h-4" />
              {isNew ? "CRÉER LE PRODUIT" : "ENREGISTRER LES MODIFICATIONS"}
            </button>
            {!isNew && (
              <button
                onClick={handleDelete}
                className="bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-900/50 px-4 py-3 rounded-xl text-xs font-bold font-mono flex items-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                SUPPRIMER
              </button>
            )}
            <button onClick={onClose} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-5 py-3 rounded-xl text-xs font-bold transition-all">
              ANNULER
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
