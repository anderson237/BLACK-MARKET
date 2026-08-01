import React from "react";
import { Flame, Download } from "lucide-react";
import { Product } from "../types";

interface DeploymentPanelProps {
  products: Product[];
  onExportCatalog: () => void;
}

export default function DeploymentPanel({ products, onExportCatalog }: DeploymentPanelProps) {
  return (
    <div className="bg-[#0d0d14] p-6 md:p-8 rounded-3xl border border-zinc-800 space-y-8" id="deployment-panel">
      <div className="border-b border-zinc-800 pb-4">
        <span className="bg-brand-red/10 text-brand-red text-[9px] font-bold font-mono px-2.5 py-1 rounded border border-brand-red/30 uppercase">
          Production &amp; Live Hosting
        </span>
        <h3 className="text-xl font-extrabold text-slate-100 mt-2 font-mono uppercase">
          Guide de Déploiement Live BLACK MARKET
        </h3>
        <p className="text-zinc-500 text-xs">
          Suivez ces étapes simples pour héberger votre catalogue public gratuitement et lancer vos ventes en quelques minutes.
        </p>
      </div>

      <div className="bg-brand-red/5 p-5 rounded-2xl border border-brand-red/20 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-extrabold text-slate-100 uppercase font-mono">Exporter catalog.json</h4>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Télécharge le fichier de données actuel ({products.length} produit{products.length > 1 ? "s" : ""}). Déposez-le à côté de votre <code className="text-brand-red bg-black/50 px-1 rounded">index.html</code> sur GitHub Pages : votre site le chargera automatiquement.
          </p>
        </div>
        <button
          onClick={onExportCatalog}
          className="bg-brand-red hover:bg-red-700 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-brand-red/45"
        >
          <Download className="w-4 h-4" />
          <span>TÉLÉCHARGER catalog.json</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-black/40 p-5 rounded-2xl border border-zinc-900 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand-red/10 border border-brand-red/30 flex items-center justify-center text-brand-red font-bold font-mono">01</div>
          <h4 className="text-sm font-extrabold text-slate-200 uppercase font-mono">GitHub Pages (Gratuit)</h4>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Créez un dépôt GitHub public, créez un fichier nommé <code className="text-brand-red bg-black/50 px-1 rounded">index.html</code> et collez-y le code généré dans l'onglet <strong>[ 4 ] SCRIPT BOUTON WHATSAPP</strong>, puis déposez <code className="text-brand-red bg-black/50 px-1 rounded">catalog.json</code> à côté. Activez GitHub Pages dans les réglages du dépôt. Votre catalogue de précommande sera instantanément disponible en ligne.
          </p>
        </div>

        <div className="bg-black/40 p-5 rounded-2xl border border-zinc-900 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand-red/10 border border-brand-red/30 flex items-center justify-center text-brand-red font-bold font-mono">02</div>
          <h4 className="text-sm font-extrabold text-slate-200 uppercase font-mono">Déploiement Complet Cloud Run</h4>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Pour héberger toute cette console d'administration sécurisée (auth serveur + IA Gemini + persistance), exportez l'application et déployez-la sur Cloud Run, Vercel ou Render avec Node.js. Le serveur sauvegarde votre catalogue dans <code className="text-zinc-300">data/products.json</code>.
          </p>
        </div>

        <div className="bg-black/40 p-5 rounded-2xl border border-zinc-900 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand-red/10 border border-brand-red/30 flex items-center justify-center text-brand-red font-bold font-mono">03</div>
          <h4 className="text-sm font-extrabold text-slate-200 uppercase font-mono">Liaison Google Sheet &amp; Webhook</h4>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Pour que votre catalogue reste automatiquement à jour sans retoucher au code, configurez <strong>Make.com</strong>. À chaque ligne ajoutée dans votre Google Sheet, Make déclenchera l'IA Gemini puis écrira <code className="text-zinc-300">catalog.json</code> sur GitHub Pages.
          </p>
        </div>
      </div>

      <div className="bg-brand-red/5 p-6 rounded-2xl border border-brand-red/20 space-y-4 text-xs text-slate-300">
        <h4 className="font-extrabold text-slate-100 font-mono uppercase flex items-center gap-2">
          <Flame className="w-4 h-4 text-brand-red fill-brand-red" />
          Précautions de Sécurité Cruciales (Anti-Malveillance)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed">
          <div className="space-y-2">
            <p className="font-bold text-white">1. Protection de l'API Key Gemini &amp; du mot de passe admin</p>
            <p className="text-zinc-400 font-sans">
              La clé Gemini et le mot de passe admin restent côté serveur (variables d'environnement <code className="text-zinc-300">GEMINI_API_KEY</code>, <code className="text-zinc-300">ADMIN_PASSWORD</code>). La connexion admin est vérifiée par le serveur (token de session) et limitée en débit : jamais exposée au navigateur.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-bold text-white">2. Protection contre le Spam &amp; XSS</p>
            <p className="text-zinc-400 font-sans">
              Le template client échappe systématiquement toutes les données injectées (fonction <code className="text-zinc-300">escapeHtml</code>), et les liens WhatsApp utilisent <code className="text-zinc-300">rel="noopener noreferrer"</code> pour éviter le détournement d'onglets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
