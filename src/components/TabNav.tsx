import React from "react";
import { Layers, Sparkles, Database, Code } from "lucide-react";
import { TabId } from "../types";

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode; index: string }[] = [
  { id: "catalog", label: "CATALOGUE BLACK MARKET", icon: <Layers className="w-4 h-4" />, index: "1" },
  { id: "ai_generator", label: "GÉNÉRATEUR DE FICHES IA", icon: <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400" />, index: "2" },
  { id: "make_guide", label: "WEBHOOK MAKE & SHEETS", icon: <Database className="w-4 h-4" />, index: "3" },
  { id: "whatsapp_script", label: "SCRIPT BOUTON WHATSAPP", icon: <Code className="w-4 h-4" />, index: "4" },
];

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="bg-[#0d0d14] rounded-3xl p-6 md:p-8 border border-brand-red/35 shadow-xl relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5 mix-blend-overlay"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&q=80&w=1200')" }}
      />
      <div className="relative z-10 max-w-4xl space-y-4">
        <span className="bg-brand-red/15 text-brand-red border border-brand-red/30 text-[9px] font-mono uppercase tracking-widest px-3 py-1 rounded-full">
          SYS_OPERATIVE // SINO-PREP DEPLOYMENT TERMINAL
        </span>
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight uppercase">
          REVOLUTIONNEZ VOS IMPORTATIONS DEPUIS LA CHINE
        </h2>
        <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-3xl">
          Bienvenue sur la plateforme exclusive de sourcing <strong className="text-white">BLACK MARKET</strong>.
          Traduisez les lots de Taobao / 1688 avec l'IA Gemini, configurez votre catalogue en 1 clic et redirigez vos
          clients directement sur WhatsApp pour finaliser les ventes en devises locales (EUR &amp; Franc CFA).
        </p>

        <div className="flex flex-wrap gap-2.5 pt-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? "bg-brand-red text-white shadow-lg shadow-brand-red/30 border border-brand-red"
                  : "bg-black text-zinc-400 border border-zinc-800 hover:border-brand-red/50 hover:text-slate-200"
              }`}
            >
              {tab.icon}
              <span>[ {tab.index} ] {tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
