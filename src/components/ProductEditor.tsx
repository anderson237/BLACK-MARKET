import React, { useState } from "react";
import { X, Save, Trash2, Plus, Image as ImageIcon } from "lucide-react";
import { Product } from "../types";
import RichEditor from "./RichEditor";
import { motion, AnimatePresence } from "motion/react";

interface ProductEditorProps {
  product: Product;
  categories: string[];
  onClose: () => void;
  onSave: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export default function ProductEditor({ product, categories, onClose, onSave, onDelete }: ProductEditorProps) {
  const [draft, setDraft] = useState<Product>({ ...product, features: [...product.features] });

  const set = (patch: Partial<Product>) => setDraft((d) => ({ ...d, ...patch }));

  const setFeature = (idx: number, value: string) =>
    setDraft((d) => ({ ...d, features: d.features.map((f, i) => (i === idx ? value : f)) }));

  const addFeature = () => setDraft((d) => ({ ...d, features: [...d.features, ""] }));

  const removeFeature = (idx: number) =>
    setDraft((d) => ({ ...d, features: d.features.filter((_, i) => i !== idx) }));

  const handleSave = () => {
    onSave({ ...draft, features: draft.features.filter((f) => f.trim() !== "") });
    onClose();
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
                <h3 className="font-extrabold text-sm uppercase tracking-wider font-mono">Éditeur Produit WYSIWYG</h3>
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
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">URL de l'image produit</label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0">
                  {draft.imageUrl ? (
                    <img src={draft.imageUrl} alt="aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-zinc-700" />
                  )}
                </div>
                <input className={inputCls} value={draft.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://..." />
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
              ENREGISTRER LES MODIFICATIONS
            </button>
            <button
              onClick={handleDelete}
              className="bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-900/50 px-4 py-3 rounded-xl text-xs font-bold font-mono flex items-center gap-2 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              SUPPRIMER
            </button>
            <button onClick={onClose} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-5 py-3 rounded-xl text-xs font-bold transition-all">
              ANNULER
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
