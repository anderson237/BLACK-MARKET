import React from "react";
import { Check, Copy } from "lucide-react";
import { getHtmlTemplateCode } from "../lib/template";

interface WhatsAppScriptPanelProps {
  copiedStates: Record<string, boolean>;
  onCopy: (id: string, text: string) => void;
}

export default function WhatsAppScriptPanel({ copiedStates, onCopy }: WhatsAppScriptPanelProps) {
  const code = getHtmlTemplateCode();

  return (
    <div className="bg-[#0d0d14] p-6 md:p-8 rounded-3xl border border-zinc-800 space-y-6" id="whatsapp-script-panel">
      <div className="border-b border-zinc-800 pb-4">
        <span className="bg-brand-red/10 text-brand-red text-[9px] font-bold font-mono px-2.5 py-1 rounded border border-brand-red/30 uppercase">
          Scripting &amp; Automation
        </span>
        <h3 className="text-xl font-extrabold text-slate-100 mt-2 font-mono uppercase">
          Script d'intégration du Bouton WhatsApp
        </h3>
        <p className="text-zinc-500 text-xs">
          Voici le code complet et moderne d'intégration que vous pouvez déployer sur votre site public. Il charge catalog.json (écrit par Make.com) et génère la syntaxe de commande demandée.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
            index.html de production complet (Prêt pour GitHub Pages)
          </span>
          <button
            onClick={() => onCopy("html_full_code", code)}
            className="bg-zinc-900 hover:bg-zinc-800 text-slate-300 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {copiedStates["html_full_code"] ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            <span>{copiedStates["html_full_code"] ? "COPIÉ!" : "COPIER LE CODE"}</span>
          </button>
        </div>

        <div className="relative">
          <pre className="bg-black text-slate-300 p-5 rounded-2xl font-mono text-xs overflow-x-auto max-h-[500px] leading-relaxed border border-zinc-950 select-all">
            {code}
          </pre>
        </div>
      </div>

      <div className="bg-black/40 p-6 rounded-2xl border border-zinc-900 space-y-4 text-xs text-zinc-400">
        <h4 className="font-bold text-slate-200 text-sm font-mono">💡 Décryptage du bouton WhatsApp Dynamique</h4>
        <p>
          Le format d'envoi requis utilise l'URL officielle <code>https://wa.me/</code> et encode le texte de façon sécurisée (<code>encodeURIComponent</code>) :
        </p>
        <div className="bg-black p-4 rounded-xl border border-zinc-950 text-[11px] font-mono text-zinc-400">
          <p className="text-brand-red font-bold">// Exemple de code JS natif utilisé pour le bouton :</p>
          <p>{"const message = `Bonjour, je souhaite commander le produit [${product.title.toUpperCase()}] au prix de [${price}]. Voici la photo : [${product.imageUrl}]`;"}</p>
          <p>{"const url = `https://wa.me/${CONFIG.phoneNumber}?text=${encodeURIComponent(message)}`;"}</p>
        </div>
      </div>
    </div>
  );
}
