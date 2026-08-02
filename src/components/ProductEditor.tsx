import React, { useState } from "react";
import { X, Save, Trash2, Plus, Image as ImageIcon, Upload, Video, Clapperboard, Sparkles } from "lucide-react";
import { Product } from "../types";
import RichEditor from "./RichEditor";
import { motion, AnimatePresence } from "motion/react";
import { getToken } from "../lib/api";
import { generateAdImage, uploadWatermarkedImage } from "../lib/aiAds";

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
              ctx.fillText("BLACK MARKET © 2026", dx, dy);
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
                <p className="text-[10px] text-white/80">BLACK MARKET // Fiche #{product.id}</p>
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
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">
                Galerie photos (carrousel client) — {draft.gallery?.length || 0} photo(s) ajoutée(s)
              </label>
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
                Sélectionnez plusieurs photos à la fois. Chacune est filigranée puis affichée en carrousel sur la fiche produit client.
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
                  <label className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-slate-300 px-3 py-2 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all w-fit">
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

            {/* WYSIWYG: sales pitch */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Argumentaire de vente (WYSIWYG)</label>
              <RichEditor value={draft.description} onChange={(html) => set({ description: html })} placeholder="Votre pitch de vente premium..." minHeight={130} />
            </div>

            {/* WYSIWYG: technical fiche */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">Fiche technique traduite (WYSIWYG)</label>
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
