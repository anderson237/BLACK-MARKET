import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  MousePointerClick,
  Package,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Order, DashboardStats, WebhookConfig } from "../types";

interface DashboardProps {
  orders: Order[];
  stats: DashboardStats | null;
  config: WebhookConfig;
  onOpenOrder: (order: Order) => void;
  onGoTo: (tab: string) => void;
}

const CATEGORY_COLORS = ["#ff2a2a", "#f59e0b", "#22d3ee", "#a78bfa", "#34d399", "#fb7185", "#facc15", "#818cf8"];

function KpiCard({
  label,
  value,
  sub,
  icon,
  trend,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  trend?: { direction: "up" | "down"; value: string };
  accent?: string;
}) {
  return (
    <div className="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 space-y-3 relative overflow-hidden group hover:border-brand-red/40 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,42,42,0.12)", color: accent || "#ff2a2a" }}>
          {icon}
        </div>
      </div>
      <div>
        <h4 className="text-2xl font-black font-mono text-white leading-none">{value}</h4>
        <div className="flex items-center gap-2 mt-2">
          {trend && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                trend.direction === "up"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/30"
              }`}
            >
              {trend.direction === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend.value}
            </span>
          )}
          <span className="text-[9px] font-mono text-zinc-500">{sub}</span>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ orders, stats, config, onOpenOrder, onGoTo }: DashboardProps) {
  const currencySymbol = config.currency === "EUR" ? "€" : "F CFA";
  const formatMoney = (value: number) =>
    config.currency === "EUR"
      ? value.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
      : value.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " F";

  const revenueXof = stats?.totalRevenueXof ?? 0;
  const revenueEur = stats?.totalRevenueEur ?? 0;
  const revenue = config.currency === "EUR" ? revenueEur : revenueXof;

  const revenueSeries = useMemo(() => {
    const base = stats?.revenueSeries || [];
    return base.map((d) => ({
      ...d,
      value: config.currency === "EUR" ? d.revenueEur : d.revenueXof,
    }));
  }, [stats, config.currency]);

  const categoryData = useMemo(() => {
    const map = stats?.salesByCategory || [];
    if (!map.length) return [{ category: "Aucune vente", orders: 1 }];
    return map.map((c) => ({ category: c.category, orders: c.orders }));
  }, [stats]);

  const topProducts = stats?.topProducts || [];
  const topProductData = useMemo(
    () =>
      topProducts.slice(0, 6).map((p) => ({
        title: p.title.length > 24 ? p.title.slice(0, 24) + "…" : p.title,
        clicks: p.clicks,
      })),
    [topProducts]
  );

  const recentOrders = useMemo(
    () => orders.slice(0, 6).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders]
  );

  const statusLabel: Record<string, string> = {
    pending: "En attente",
    processing: "En traitement",
    shipped: "Expédiée",
    completed: "Terminée",
    cancelled: "Annulée",
  };

  return (
    <div className="space-y-6">
      {/* KPI Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Revenu Total"
          value={formatMoney(revenue)}
          sub="Toutes commandes"
          icon={<Wallet className="w-4 h-4" />}
          accent="#facc15"
          trend={{ direction: "up", value: "+12.4%" }}
        />
        <KpiCard
          label="Commandes"
          value={String(stats?.totalOrders ?? 0)}
          sub="Enregistrées"
          icon={<ShoppingBag className="w-4 h-4" />}
          accent="#ff2a2a"
          trend={{ direction: "up", value: "+8.2%" }}
        />
        <KpiCard
          label="Intérêt WhatsApp"
          value={String(stats?.totalClicks ?? 0)}
          sub="Clics PRÉCOMMANDER"
          icon={<MousePointerClick className="w-4 h-4" />}
          accent="#34d399"
          trend={{ direction: "up", value: "+15.7%" }}
        />
        <KpiCard
          label="Produits"
          value={String(stats?.totalProducts ?? 0)}
          sub="Au catalogue"
          icon={<Package className="w-4 h-4" />}
          accent="#22d3ee"
          trend={{ direction: "down", value: "-2.1%" }}
        />
      </div>

      {/* Revenue Area Chart + Sale by category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider">REVENU DES 7 DERNIERS JOURS</h3>
              <p className="text-[10px] font-mono text-zinc-500">Suivi des ventes ({currencySymbol})</p>
            </div>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-full flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +2.8%
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff2a2a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ff2a2a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2b" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={{ background: "#15151e", border: "1px solid #3f3f46", borderRadius: 12, fontFamily: "monospace", fontSize: 11 }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(value: any) => [formatMoney(Number(value)), "Revenu"]}
                />
                <Area type="monotone" dataKey="value" stroke="#ff2a2a" strokeWidth={2} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
          <h3 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">VENTES PAR CATÉGORIE</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="orders" nameKey="category" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#15151e", border: "1px solid #3f3f46", borderRadius: 12, fontFamily: "monospace", fontSize: 11 }}
                  labelStyle={{ color: "#fff" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-1">
            {categoryData.map((c, i) => (
              <div key={c.category} className="flex items-center justify-between text-[10px] font-mono">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  {c.category}
                </span>
                <span className="text-zinc-200 font-bold">{c.orders} cmd</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top products + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider">TOP PRODUITS</h3>
            <button onClick={() => onGoTo("catalog")} className="text-[10px] font-mono text-brand-red hover:underline cursor-pointer">
              Tout voir
            </button>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="title" width={120} tick={{ fill: "#a1a1aa", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#15151e", border: "1px solid #3f3f46", borderRadius: 12, fontFamily: "monospace", fontSize: 11 }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(value: any) => [String(value) + " clics", "WhatsApp"]}
                />
                <Bar dataKey="clicks" fill="#ff2a2a" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider">COMMANDES RÉCENTES</h3>
            <button onClick={() => onGoTo("orders")} className="text-[10px] font-mono text-brand-red hover:underline cursor-pointer">
              Tout voir
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 pr-3">PRODUIT</th>
                  <th className="py-2 pr-3">CLIENT</th>
                  <th className="py-2 pr-3">MONTANT</th>
                  <th className="py-2 pr-3">STATUT</th>
                  <th className="py-2">DATE</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs font-mono text-zinc-500">
                      Aucune commande enregistrée. Créez-en une dans l'onglet Commandes.
                    </td>
                  </tr>
                )}
                {recentOrders.map((o) => (
                  <tr key={o.id} onClick={() => onOpenOrder(o)} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors cursor-pointer">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <img src={o.productImage} alt="" className="w-8 h-8 rounded-lg object-cover bg-zinc-900" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                        <span className="text-[11px] font-mono text-zinc-200 max-w-[140px] truncate">{o.productTitle}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="text-[11px] font-mono text-zinc-300">{o.customerName}</div>
                      <div className="text-[9px] font-mono text-zinc-500">{o.customerLocation}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-[11px] font-mono text-brand-red font-bold">
                      {config.currency === "EUR" ? formatMoney(o.priceEur * o.quantity) : formatMoney(o.priceXof * o.quantity)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-block text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                          o.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : o.status === "pending"
                              ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                              : o.status === "cancelled"
                                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                                : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                        }`}
                      >
                        {statusLabel[o.status] || o.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-[10px] font-mono text-zinc-500">
                      {new Date(o.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
