import React from "react";
import {
  LayoutDashboard,
  Layers,
  ShoppingCart,
  Users,
  Tag,
  Sparkles,
  Database,
  Code,
  Settings as SettingsIcon,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { TabId } from "../types";

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, group: "Pilotage" },
  { id: "catalog", label: "Catalogue", icon: <Layers className="w-4 h-4" />, group: "Pilotage" },
  { id: "orders", label: "Commandes", icon: <ShoppingCart className="w-4 h-4" />, group: "Ventes" },
  { id: "customers", label: "Clients", icon: <Users className="w-4 h-4" />, group: "Ventes" },
  { id: "categories", label: "Catégories", icon: <Tag className="w-4 h-4" />, group: "Ventes" },
  { id: "users", label: "Utilisateurs", icon: <ShieldCheck className="w-4 h-4" />, group: "Système" },
  { id: "ai_generator", label: "Fiches IA", icon: <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400" />, group: "Outils" },
  { id: "make_guide", label: "Webhook Make", icon: <Database className="w-4 h-4" />, group: "Outils" },
  { id: "whatsapp_script", label: "Script WhatsApp", icon: <Code className="w-4 h-4" />, group: "Outils" },
  { id: "settings", label: "Paramètres", icon: <SettingsIcon className="w-4 h-4" />, group: "Système" },
];

const GROUPS = ["Pilotage", "Ventes", "Outils", "Système"];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="lg:sticky lg:top-24 self-start w-full lg:w-60 shrink-0 hidden lg:block">
      <div className="bg-[#0d0d14] rounded-3xl border border-zinc-800 p-4">
        <div className="flex items-center gap-2 px-2 pb-3 mb-2 border-b border-zinc-800">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-red to-[#900] flex items-center justify-center">
            <Flame className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">Navigation</span>
        </div>

        <nav className="space-y-4">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="px-2 pb-1.5 text-[8px] font-mono uppercase tracking-[0.2em] text-zinc-600">{group}</div>
              <div className="space-y-0.5">
                {NAV.filter((n) => n.group === group).map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                        active
                          ? "bg-brand-red text-white shadow-lg shadow-brand-red/20"
                          : "text-zinc-400 hover:text-slate-100 hover:bg-zinc-900"
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
