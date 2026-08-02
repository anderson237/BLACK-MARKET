import React, { useState } from "react";
import { Save, Store, Phone, Globe, Database, ShieldCheck, ExternalLink } from "lucide-react";
import { WebhookConfig } from "../types";

interface SettingsProps {
  config: WebhookConfig;
  onConfigChange: (config: WebhookConfig) => void;
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
        {icon} {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-red/50 placeholder-zinc-600";

export default function Settings({ config, onConfigChange }: SettingsProps) {
  const [draft, setDraft] = useState<WebhookConfig>(config);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<WebhookConfig>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfigChange(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Store settings */}
      <form onSubmit={submit} className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-brand-red" /> PARAMÈTRES BOUTIQUE
            </h3>
            <p className="text-[10px] font-mono text-zinc-500">Numéro WhatsApp, devise et lien boutique</p>
          </div>
          <button
            type="submit"
            className="bg-brand-red hover:bg-red-600 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {saved ? "ENREGISTRÉ ✓" : "ENREGISTRER"}
          </button>
        </div>

        <Field label="Numéro WhatsApp (ventes)" icon={<Phone className="w-3 h-3" />}>
          <input
            value={draft.phoneNumber}
            onChange={(e) => update({ phoneNumber: e.target.value })}
            placeholder="237683963007"
            className={inputCls}
          />
        </Field>

        <Field label="Devise par défaut" icon={<Globe className="w-3 h-3" />}>
          <select
            value={draft.currency}
            onChange={(e) => update({ currency: e.target.value as "EUR" | "XOF" })}
            className={inputCls + " cursor-pointer"}
          >
            <option value="XOF" className="bg-[#0d0d14]">XOF (Franc CFA)</option>
            <option value="EUR" className="bg-[#0d0d14]">EUR (Euro)</option>
          </select>
        </Field>

        <Field label="URL du site (fiches produits partagées)" icon={<Globe className="w-3 h-3" />}>
          <input
            value={draft.siteUrl || "https://blackmarket-import-export.netlify.app/"}
            onChange={(e) => update({ siteUrl: e.target.value })}
            className={inputCls}
          />
        </Field>
      </form>

      {/* Publication / persistance */}
      <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-5">
        <div>
          <h3 className="text-base font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-brand-red" /> PUBLICATION DU CATALOGUE
          </h3>
          <p className="text-[10px] font-mono text-zinc-500">Le catalogue, les commandes et les clics sont persistés côté serveur et servis en direct à la boutique.</p>
        </div>

        <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Store className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-mono text-zinc-400">Le site public charge <span className="text-brand-red font-bold">/catalog.json</span> en direct depuis la base de données. Aucun webhook ni script externe n'est requis.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <ExternalLink className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-mono text-zinc-400">Chaque clic « PRÉCOMMANDER » enregistre un clic produit <strong className="text-zinc-200">et</strong> une commande en attente que vous complétez depuis l'onglet Commandes.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-mono text-zinc-400">Les images ajoutées sont stockées dans le Blob <span className="text-zinc-200">bm-images</span> et servies sous <span className="text-zinc-200">/api/img/…</span>.</p>
            </div>
          </div>
        </div>

        <Field label="Dépôt GitHub (catalogue)" icon={<Globe className="w-3 h-3" />}>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.githubRepo}
              onChange={(e) => update({ githubRepo: e.target.value })}
              placeholder="pseudo/repo"
              className={inputCls}
            />
            <input
              value={draft.githubBranch}
              onChange={(e) => update({ githubBranch: e.target.value })}
              placeholder="main"
              className={inputCls}
            />
          </div>
        </Field>

        <Field label="Token GitHub (optionnel)" icon={<ShieldCheck className="w-3 h-3" />}>
          <input
            type="password"
            value={draft.githubToken}
            onChange={(e) => update({ githubToken: e.target.value })}
            placeholder="ghp_..."
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  );
}
