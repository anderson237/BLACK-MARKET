import React from "react";
import {
  Sparkles,
  FileText,
  RefreshCw,
  Image as ImageIcon,
  TrendingUp,
  Plus,
} from "lucide-react";
import { Product, AIProcessingState } from "../types";

interface AIGeneratorProps {
  products: Product[];
  aiInputChinese: string;
  setAiInputChinese: (value: string) => void;
  aiImagePreview: string;
  aiImageBase64: string;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  aiBasePriceRmb: number;
  setAiBasePriceRmb: (value: number) => void;
  aiMarkup: number;
  setAiMarkup: (value: number) => void;
  aiCategory: string;
  setAiCategory: (value: string) => void;
  aiState: AIProcessingState;
  onGenerate: () => void;
  generatedProduct: Product | null;
  onInject: () => void;
  onRefuse: () => void;
}

export default function AIGenerator({
  products,
  aiInputChinese,
  setAiInputChinese,
  aiImagePreview,
  aiImageBase64,
  onImageUpload,
  onClearImage,
  aiBasePriceRmb,
  setAiBasePriceRmb,
  aiMarkup,
  setAiMarkup,
  aiCategory,
  setAiCategory,
  aiState,
  onGenerate,
  generatedProduct,
  onInject,
  onRefuse,
}: AIGeneratorProps) {
  const categories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="ai-generator-panel">
      {/* Form panel */}
      <div className="lg:col-span-5 bg-[#0d0d14] p-6 rounded-3xl border border-zinc-800 space-y-6">
        <div>
          <h3 className="text-lg font-extrabold text-slate-100 uppercase tracking-wider flex items-center gap-2 font-mono">
            <Sparkles className="w-5 h-5 text-brand-red fill-brand-red" />
            Traducteur &amp; Rédacteur de Pitch IA _
          </h3>
          <p className="text-zinc-500 text-xs mt-1">
            Saisissez les données brutes de Taobao / 1688 / WeChat ou glissez l'image du produit. L'IA Gemini traduit, rédige le pitch et calcule les prix.
          </p>
        </div>

        {/* Upload Section */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">
            Étape 1 : Image de produit Chine (Watermark auto-appliqué)
          </label>
          <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-4 text-center hover:border-brand-red transition-all relative cursor-pointer group bg-black/40">
            <input
              type="file"
              accept="image/*"
              onChange={onImageUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            {aiImagePreview ? (
              <div className="space-y-2 relative">
                <div className="relative max-h-36 mx-auto rounded-lg overflow-hidden border border-zinc-800">
                  <img src={aiImagePreview} alt="Preview" className="max-h-36 mx-auto object-contain" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-20">
                    <span className="text-white font-extrabold text-lg font-mono border border-white/50 px-2 py-0.5 rotate-12 tracking-wider">
                      BLACK MARKET
                    </span>
                  </div>
                </div>
                <p className="text-[9px] text-brand-red font-bold font-mono">IMAGE CHARGÉE - FILIGRANE BLACK MARKET INTÉGRÉ</p>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onClearImage();
                  }}
                  className="bg-brand-red text-white rounded px-2.5 py-1 text-[9px] font-mono absolute top-0 right-0 hover:bg-red-700"
                >
                  EFFACER
                </button>
              </div>
            ) : (
              <div className="space-y-2 py-4">
                <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto group-hover:scale-110 transition-transform" />
                <div className="text-xs text-zinc-400">
                  <span className="text-brand-red font-bold underline">Cliquez pour téléverser</span> ou glissez l'image d'usine
                </div>
                <p className="text-[9px] text-zinc-500 font-mono">La visière de sécurité ou l'image d'origine recevra le filigrane.</p>
              </div>
            )}
          </div>
        </div>

        {/* Description Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">
            Étape 2 : Description en chinois brut (Fiche fournisseur)
          </label>
          <textarea
            rows={4}
            className="w-full p-3 bg-black border border-zinc-800 rounded-xl text-slate-300 text-xs font-mono focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red"
            placeholder="Collez ici les caractères du catalogue Taobao / 1688..."
            value={aiInputChinese}
            onChange={(e) => setAiInputChinese(e.target.value)}
          />
        </div>

        {/* Sourcing values simulator */}
        <div className="bg-black/60 p-4 rounded-2xl border border-zinc-900 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1 font-mono">
            <TrendingUp className="w-4 h-4 text-brand-red" />
            Configurateur de Marge SINO-PREP
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-mono block">PRIX ACHAT (¥ RMB)</span>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">¥</span>
                <input
                  type="number"
                  className="w-full pl-6 pr-2 py-1.5 bg-zinc-900 border border-zinc-800 text-slate-200 rounded-lg text-xs font-mono font-bold"
                  value={aiBasePriceRmb}
                  onChange={(e) => setAiBasePriceRmb(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] text-zinc-500 font-mono block">MARGE SOUHAITÉE (%)</span>
              <div className="relative">
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">%</span>
                <input
                  type="number"
                  className="w-full pl-2 pr-6 py-1.5 bg-zinc-900 border border-zinc-800 text-slate-200 rounded-lg text-xs font-mono font-bold"
                  value={aiMarkup}
                  onChange={(e) => setAiMarkup(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] text-zinc-500 font-mono block">CATÉGORIE DISPATCH (CHOISIR OU ÉCRIRE)</span>
            <input
              type="text"
              list="categories-list"
              className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs font-mono text-slate-300 rounded-lg focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red"
              placeholder="Saisissez ou sélectionnez..."
              value={aiCategory}
              onChange={(e) => setAiCategory(e.target.value)}
            />
            <datalist id="categories-list">
              <option value="Techwear" />
              <option value="Streetwear" />
              <option value="Cyber Gadgets" />
              <option value="Gaming Room" />
              <option value="Accessoires" />
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Launch Button */}
        <button
          onClick={onGenerate}
          disabled={aiState.loading || (!aiInputChinese && !aiImageBase64)}
          className={`w-full py-3 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
            aiState.loading
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none border border-zinc-800"
              : "bg-brand-red hover:bg-red-600 text-white shadow-brand-red/20 border border-brand-red/50"
          }`}
        >
          {aiState.loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>SYS_IA : TRADUCTION DE LA FICHE...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 fill-white" />
              <span>EXÉCUTER L'IA (GEMINI SOURCING)</span>
            </>
          )}
        </button>

        {aiState.error && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 leading-relaxed font-mono">
            <strong>[ IA_SYS_ERR ] :</strong> {aiState.error}
            <p className="mt-1 text-[9px] text-zinc-500">
              Vérifiez que votre clé API <code>GEMINI_API_KEY</code> est stockée de manière sécurisée dans le fichier .env / Secrets.
            </p>
          </div>
        )}
      </div>

      {/* Output Panel */}
      <div className="lg:col-span-7 bg-[#0d0d14] p-6 md:p-8 rounded-3xl border border-zinc-800 flex flex-col justify-between min-h-[500px]">
        {!generatedProduct && !aiState.loading && (
          <div className="my-auto text-center py-12 space-y-3">
            <div className="w-16 h-16 rounded-full bg-black border border-zinc-800 flex items-center justify-center mx-auto text-zinc-700">
              <FileText className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-slate-300 text-xs font-mono uppercase tracking-widest">
              _ EN ATTENTE D'INSTRUCTION IA _
            </h4>
            <p className="text-zinc-500 text-xs max-w-sm mx-auto">
              Les résultats de la traduction et du copywriting d'élite en Français s'afficheront ici après avoir validé le formulaire d'origine chinoise.
            </p>
          </div>
        )}

        {aiState.loading && (
          <div className="my-auto text-center py-12 space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-900"></div>
              <div className="absolute inset-0 rounded-full border-4 border-brand-red border-t-transparent animate-spin"></div>
            </div>
            <div className="space-y-1">
              <p className="text-slate-200 text-xs font-bold font-mono animate-pulse uppercase tracking-widest">GEMINI TERMINAL : ANALYSE EN COURS...</p>
              <p className="text-[10px] text-zinc-500 max-w-md mx-auto">
                Interprétation de l'image, conversion monétaire RMB vers EUR et XOF, et application des watermarks BLACK MARKET de sécurité.
              </p>
            </div>
          </div>
        )}

        {generatedProduct && !aiState.loading && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-mono font-bold text-green-500 uppercase tracking-wider">
                  COMPILATION IA SINO-PREP OK
                </span>
              </div>
              <span className="text-[9px] font-mono text-zinc-500">Gemini Flash Model</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">TITRE COMMERCIAL COMPILÉ</span>
                <p className="text-lg font-black text-slate-100 font-sans uppercase">{generatedProduct.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-black p-3 rounded-xl border border-zinc-900">
                <div>
                  <span className="text-[8px] text-zinc-500 font-mono block uppercase">Précommande XOF (CFA)</span>
                  <span className="text-sm sm:text-base font-extrabold text-brand-red font-mono">
                    {generatedProduct.priceXof.toLocaleString("fr-FR")} F CFA
                  </span>
                </div>
                <div>
                  <span className="text-[8px] text-zinc-500 font-mono block uppercase">Précommande EUR (Euro)</span>
                  <span className="text-sm sm:text-base font-extrabold text-brand-red font-mono">
                    {generatedProduct.priceEur} €
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">COPYWRITING DE VENTE PREMIUM</span>
                <div
                  className="bg-brand-red/5 p-4 rounded-xl border border-brand-red/20 text-xs text-slate-300 leading-relaxed font-sans [&_p]:mb-2 [&_h3]:text-slate-100 [&_h3]:font-bold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
                  dangerouslySetInnerHTML={{
                    __html: String(generatedProduct.description || "")
                      .replace(/<(script|style|iframe|object|embed|form|input)[^>]*>.*?<\/\1>/gis, "")
                      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
                      .replace(/javascript:/gi, "")
                      .slice(0, 12000),
                  }}
                />
              </div>

              {generatedProduct.originalDescription && (
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">FICHE TECHNIQUE TRADUITE DU CHINOIS</span>
                  <p className="text-xs text-zinc-400 italic bg-black p-3 rounded-xl border border-zinc-900 font-mono">
                    {generatedProduct.originalDescription}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">BÉNÉFICES CLÉS EXTRAITS</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {generatedProduct.features.map((feat, i) => (
                    <div key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                      <span className="text-brand-red font-bold">▪</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-800 flex gap-4">
              <button
                onClick={onInject}
                className="flex-1 bg-brand-red hover:bg-red-700 text-white font-bold font-mono text-xs py-3 rounded-xl shadow-lg shadow-brand-red/20 flex items-center justify-center gap-2 cursor-pointer border border-brand-red/45"
              >
                <Plus className="w-4 h-4" />
                <span>[ INJECTER AU CATALOGUE DU SITE ]</span>
              </button>
              <button
                onClick={onRefuse}
                className="px-4 py-3 border border-zinc-800 text-zinc-400 hover:bg-zinc-900 text-xs font-bold font-mono rounded-xl transition-all"
              >
                REFUSER
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
