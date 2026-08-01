import React from "react";
import { Check, Copy } from "lucide-react";

interface MakeGuideProps {
  copiedStates: Record<string, boolean>;
  onCopy: (id: string, text: string) => void;
}

const MAKE_HTTP_BODY = `{
  "contents": [
    {
      "parts": [
        {
          "text": "Rédige en français une fiche commerciale. Titre en chinois: \`\${1.Titre Chinois}\`. Description: \`\${1.Description Chinoise}\`. Prix d'achat RMB: \`\${1.Prix Achat RMB}\`. Calcule un prix de vente en XOF (CFA) et EUR incluant 60% de marge."
        }
      ]
    }
  ],
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseSchema": {
      "type": "OBJECT",
      "properties": {
        "title": { "type": "STRING" },
        "salesPitch": { "type": "STRING" },
        "features": { "type": "ARRAY", "items": { "type": "STRING" } },
        "priceEur": { "type": "NUMBER" },
        "priceXof": { "type": "NUMBER" }
      },
      "required": ["title", "salesPitch", "features", "priceEur", "priceXof"]
    }
  }
}`;

export default function MakeGuide({ copiedStates, onCopy }: MakeGuideProps) {
  return (
    <div className="bg-[#0d0d14] p-6 md:p-8 rounded-3xl border border-zinc-800 space-y-8" id="make-guide-panel">
      <div className="border-b border-zinc-800 pb-4">
        <span className="bg-brand-red/10 text-brand-red text-[9px] font-bold font-mono px-2.5 py-1 rounded border border-brand-red/35 uppercase">
          No-Code Integration Hub
        </span>
        <h3 className="text-xl font-extrabold text-slate-100 mt-2 font-mono uppercase">
          Configuration du Webhook No-Code Make.com
        </h3>
        <p className="text-zinc-500 text-xs">
          Reliez Google Sheets, l'API de traduction Gemini IA et écrivez directement le fichier catalog.json sur GitHub Pages pour mettre à jour le catalogue.
        </p>
      </div>

      {/* Flowchart */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center relative">
        <div className="bg-black/60 p-4 rounded-xl border border-zinc-900 flex flex-col justify-between h-36">
          <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest">[ ÉTAPE 01 ]</span>
          <p className="text-xs font-bold text-slate-200">Google Sheets</p>
          <p className="text-[10px] text-zinc-500 leading-normal">Vous insérez le titre et la fiche brute d'origine (Taobao / 1688) dans un tableau Google.</p>
        </div>

        <div className="bg-black/60 p-4 rounded-xl border border-zinc-900 flex flex-col justify-between h-36">
          <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest">[ ÉTAPE 02 ]</span>
          <p className="text-xs font-bold text-slate-200">Make.com Listener</p>
          <p className="text-[10px] text-zinc-500 leading-normal">Le webhook de Make intercepte la ligne et prépare l'envoi de la description.</p>
        </div>

        <div className="bg-black/60 p-4 rounded-xl border border-zinc-900 flex flex-col justify-between h-36">
          <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest">[ ÉTAPE 03 ]</span>
          <p className="text-xs font-bold text-slate-200">Gemini IA API</p>
          <p className="text-[10px] text-zinc-500 leading-normal">L'IA traduit le chinois, rédige le pitch de vente et calcule les prix finaux.</p>
        </div>

        <div className="bg-black/60 p-4 rounded-xl border border-zinc-900 flex flex-col justify-between h-36">
          <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest">[ ÉTAPE 04 ]</span>
          <p className="text-xs font-bold text-slate-200">GitHub Publish</p>
          <p className="text-[10px] text-zinc-500 leading-normal">Écrit automatiquement le fichier catalog.json sur votre site public.</p>
        </div>
      </div>

      {/* Instructions steps */}
      <div className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-brand-red text-white flex items-center justify-center font-bold text-xs">A</span>
            Structure recommandée de votre Google Sheet
          </h4>
          <div className="text-xs text-zinc-400 pl-8 space-y-2 leading-relaxed">
            <p>Déclarez les colonnes d'origine suivantes dans votre tableur :</p>
            <div className="bg-black p-3.5 rounded-lg border border-zinc-900 font-mono text-[10px] text-brand-red w-fit">
              ID | Date | Catégorie | Titre Chinois | Description Chinoise | Image URL d'usine | Prix Achat RMB
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-brand-red text-white flex items-center justify-center font-bold text-xs">B</span>
            Configuration du module HTTP vers Gemini
          </h4>
          <div className="text-xs text-zinc-400 pl-8 space-y-4">
            <p>Utilisez le module <strong>HTTP &gt; Make a Request</strong> de Make avec les paramètres ci-dessous :</p>

            <div className="space-y-2.5 bg-black p-4 rounded-xl border border-zinc-900 font-mono text-[11px] text-zinc-300">
              <p><span className="text-brand-red font-bold">METHOD :</span> POST</p>
              <p><span className="text-brand-red font-bold">URL :</span> https://generativelanguage.googleapis.com/v1beta/models/[VOTRE_MODELE_GEMINI]:generateContent?key=[VOTRE_API_KEY_GEMINI]</p>
            </div>

            <p>Pour forcer Gemini à répondre dans un format JSON compatible, copiez-collez ce schéma dans le <strong>Body</strong> :</p>

            <div className="relative">
              <pre className="bg-black text-brand-red p-4 rounded-xl font-mono text-[10px] overflow-x-auto leading-relaxed border border-zinc-950">
                {MAKE_HTTP_BODY}
              </pre>
              <button
                onClick={() => onCopy("make_http_body", MAKE_HTTP_BODY)}
                className="absolute top-3 right-3 bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 px-2 py-1 rounded text-[9px] font-mono flex items-center gap-1"
              >
                {copiedStates["make_http_body"] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedStates["make_http_body"] ? "COPIÉ!" : "COPIER LE SCHÉMA"}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-extrabold text-slate-200 uppercase font-mono tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-brand-red text-white flex items-center justify-center font-bold text-xs">C</span>
            Génération de vidéos et filigranes
          </h4>
          <div className="text-xs text-zinc-400 pl-8 space-y-2">
            <p>
              Pour appliquer automatiquement le filigrane <strong>BLACK MARKET</strong> sur toutes vos créations de campagnes publicitaires TikTok/Instagram :
            </p>
            <div className="bg-black/50 p-4 rounded-xl border border-zinc-900 leading-relaxed text-zinc-400 space-y-2">
              <p>
                1. Connectez un module <strong>Creatomate</strong> (générateur de vidéo par API) à la fin de votre scénario Make.com.<br />
                2. Dans l'éditeur de templates de Creatomate, superposez un calque de texte fixe <code>BLACK MARKET</code> avec une opacité de 15% ou 20%.<br />
                3. Alimentez les calques textuels animés de Creatomate avec le titre et l'argumentaire français traduits par Gemini.<br />
                4. L'API produira automatiquement la vidéo MP4 avec le filigrane officiel incrusté, prête pour vos publications organiques et ads.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
