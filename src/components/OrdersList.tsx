import React, { useMemo, useState } from "react";
import { Search, Plus, Trash2, Edit3 } from "lucide-react";
import { Order, OrderStatus, WebhookConfig } from "../types";

interface OrdersListProps {
  orders: Order[];
  config: WebhookConfig;
  onOpenOrder: (order: Order) => void;
  onAddOrder: () => void;
  onDeleteOrder: (id: string) => void;
}

const STATUS_OPTIONS: OrderStatus[] = ["pending", "processing", "shipped", "completed", "cancelled"];

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
  processing: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30",
  shipped: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  completed: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  cancelled: "bg-red-500/10 text-red-400 border border-red-500/30",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "En attente",
  processing: "En traitement",
  shipped: "Expédiée",
  completed: "Terminée",
  cancelled: "Annulée",
};

const PAGE_SIZE = 8;

export default function OrdersList({ orders, config, onOpenOrder, onAddOrder, onDeleteOrder }: OrdersListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch =
        !q ||
        o.customerName.toLowerCase().includes(q) ||
        o.productTitle.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.id.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const formatMoney = (v: number) =>
    (config.currency === "EUR" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €" : v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " F");

  return (
    <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-white font-mono uppercase tracking-wider">GESTION DES COMMANDES</h3>
          <p className="text-[10px] font-mono text-zinc-500">Suivi des précommandes WhatsApp</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher client / produit / n°…"
              className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-44 placeholder-zinc-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="bg-black border border-zinc-800 text-xs font-mono text-slate-300 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#0d0d14]">TOUS STATUTS</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="bg-[#0d0d14]">
                {STATUS_LABEL[s].toUpperCase()}
              </option>
            ))}
          </select>
          <button
            onClick={onAddOrder}
            className="bg-brand-red hover:bg-red-600 text-white text-xs font-mono font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> NOUVELLE
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">PRODUIT</th>
              <th className="py-2 pr-3">CLIENT</th>
              <th className="py-2 pr-3">QTÉ</th>
              <th className="py-2 pr-3">MONTANT</th>
              <th className="py-2 pr-3">STATUT</th>
              <th className="py-2 pr-3">DATE</th>
              <th className="py-2 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs font-mono text-zinc-500">
                  Aucune commande trouvée.
                </td>
              </tr>
            )}
            {pageItems.map((o) => (
              <tr key={o.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                <td className="py-2.5 pr-3 text-[10px] font-mono text-zinc-500">{o.id.slice(0, 12)}…</td>
                <td className="py-2.5 pr-3">
                  <button onClick={() => onOpenOrder(o)} className="flex items-center gap-2 cursor-pointer text-left">
                    <img src={o.productImage} alt="" className="w-8 h-8 rounded-lg object-cover bg-zinc-900" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    <span className="text-[11px] font-mono text-zinc-200 max-w-[150px] truncate hover:text-brand-red">{o.productTitle}</span>
                  </button>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="text-[11px] font-mono text-zinc-300">{o.customerName}</div>
                  <div className="text-[9px] font-mono text-zinc-500">{o.customerPhone || "—"}</div>
                </td>
                <td className="py-2.5 pr-3 text-[11px] font-mono text-zinc-300">×{o.quantity}</td>
                <td className="py-2.5 pr-3 text-[11px] font-mono text-brand-red font-bold">
                  {formatMoney(config.currency === "EUR" ? o.priceEur * o.quantity : o.priceXof * o.quantity)}
                </td>
                <td className="py-2.5 pr-3">
                  <span className={`inline-block text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[o.status] || STATUS_STYLES.pending}`}>
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-[10px] font-mono text-zinc-500">
                  {new Date(o.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => onOpenOrder(o)} className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-400 hover:bg-zinc-900 transition-colors cursor-pointer" title="Voir détail">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDeleteOrder(o.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-900 transition-colors cursor-pointer" title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] font-mono text-zinc-500">
          Affichage {pageItems.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{(page - 1) * PAGE_SIZE + pageItems.length} de {filtered.length} commandes
        </span>
        <div className="flex items-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg text-xs font-mono bg-black border border-zinc-800 text-zinc-300 hover:border-brand-red/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            ←
          </button>
          <span className="text-[11px] font-mono text-zinc-400 px-2">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg text-xs font-mono bg-black border border-zinc-800 text-zinc-300 hover:border-brand-red/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
