import React from "react";
import { Layers, Phone, TrendingUp, DollarSign } from "lucide-react";
import { Product, WebhookConfig } from "../types";

interface StatsBarProps {
  products: Product[];
  config: WebhookConfig;
  markup: number;
}

export default function StatsBar({ products, config, markup }: StatsBarProps) {
  const totalClicks = products.reduce((sum, p) => sum + (p.whatsappClicks || 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800 space-y-2 relative overflow-hidden group hover:border-brand-red/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Sourcing Actif</span>
          <Layers className="w-4 h-4 text-brand-red" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xl font-black font-mono text-white">{products.length} Drops</h4>
          <p className="text-[9px] font-mono text-zinc-500">PRODUITS PRÊTS À COMMANDER</p>
        </div>
      </div>

      <div className="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800 space-y-2 relative overflow-hidden group hover:border-brand-red/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Intérêt (WhatsApp)</span>
          <Phone className="w-4 h-4 text-green-500" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xl font-black font-mono text-green-500">{totalClicks} Clics</h4>
          <p className="text-[9px] font-mono text-zinc-500">TOTAL INTENTIONS DE COMMANDE</p>
        </div>
      </div>

      <div className="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800 space-y-2 relative overflow-hidden group hover:border-brand-red/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Marge Sourcing</span>
          <TrendingUp className="w-4 h-4 text-brand-red" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xl font-black font-mono text-white">+{markup}% Moy.</h4>
          <p className="text-[9px] font-mono text-zinc-500">COEFFICIENT DE RENTABILITÉ</p>
        </div>
      </div>

      <div className="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800 space-y-2 relative overflow-hidden group hover:border-brand-red/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Valeur du Sourcing</span>
          <DollarSign className="w-4 h-4 text-yellow-500" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xl font-black font-mono text-yellow-500">
            {config.currency === "EUR"
              ? `${products.reduce((sum, p) => sum + p.priceEur * 100, 0).toLocaleString("fr-FR")} €`
              : `${products.reduce((sum, p) => sum + p.priceXof * 100, 0).toLocaleString("fr-FR")} F CFA`}
          </h4>
          <p className="text-[9px] font-mono text-zinc-500">SUR UN LOT TYPE DE 100 PCS</p>
        </div>
      </div>
    </div>
  );
}
