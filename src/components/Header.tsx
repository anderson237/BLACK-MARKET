import React from "react";
import { Flame, LogOut, Store } from "lucide-react";
import { WebhookConfig } from "../types";

interface HeaderProps {
  config: WebhookConfig;
  onConfigChange: (config: WebhookConfig) => void;
  onLogout: () => void;
}

export default function Header({ config, onConfigChange, onLogout }: HeaderProps) {
  return (
    <header className="bg-[#0b0b10] border-b border-brand-red/30 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-red to-[#900] flex items-center justify-center text-white shadow-lg shadow-brand-red/20 border border-brand-red">
            <Flame className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-white tracking-widest font-mono glow-red">BLACK MARKET</span>
              <span className="text-[9px] font-mono font-bold bg-brand-red/25 text-brand-red border border-brand-red/45 px-1.5 py-0.2 rounded">K-STREET</span>
            </div>
            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-wide">
              No-Code Sourcing Engine // Shenzhen to Africa & Europe
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-black border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-mono">
            <span className="text-zinc-500">DEVISE :</span>
            <select
              className="bg-transparent font-bold text-brand-red focus:outline-none cursor-pointer uppercase"
              value={config.currency}
              onChange={(e) => onConfigChange({ ...config, currency: e.target.value as "EUR" | "XOF" })}
            >
              <option value="XOF" className="bg-[#0b0b10] text-slate-300">XOF (F CFA)</option>
              <option value="EUR" className="bg-[#0b0b10] text-slate-300">EUR (€)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-black border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-mono">
            <span className="text-zinc-500">N° WHATSAPP :</span>
            <input
              type="text"
              className="bg-transparent font-bold text-slate-200 w-28 focus:outline-none text-center"
              value={config.phoneNumber}
              onChange={(e) => onConfigChange({ ...config, phoneNumber: e.target.value })}
              placeholder="225070707..."
            />
          </div>

          <a
            href="/"
            className="bg-zinc-900 hover:bg-brand-red/20 text-zinc-400 hover:text-brand-red border border-zinc-800 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Retour à la boutique client"
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden md:inline">BOUTIQUE</span>
          </a>

          <button
            onClick={onLogout}
            className="bg-brand-red hover:bg-red-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Déconnexion sécurisée"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>DÉCONNEXION</span>
          </button>
        </div>
      </div>
    </header>
  );
}
