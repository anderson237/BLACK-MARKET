import React, { useState } from "react";
import { X, Check, PackageCheck, Truck, Clock, XCircle, Trash2 } from "lucide-react";
import { Order, OrderStatus, WebhookConfig } from "../types";

interface OrderDetailsProps {
  order: Order | null;
  config: WebhookConfig;
  onClose: () => void;
  onUpdateStatus: (id: string, status: OrderStatus) => void;
  onDelete: (id: string) => void;
}

const STATUS_FLOW: { status: OrderStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { status: "pending", label: "Commande reçue", icon: <Clock className="w-3.5 h-3.5" />, color: "#facc15" },
  { status: "processing", label: "En traitement", icon: <PackageCheck className="w-3.5 h-3.5" />, color: "#22d3ee" },
  { status: "shipped", label: "Expédiée", icon: <Truck className="w-3.5 h-3.5" />, color: "#3b82f6" },
  { status: "completed", label: "Livrée / Terminée", icon: <Check className="w-3.5 h-3.5" />, color: "#34d399" },
];

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

export default function OrderDetails({ order, config, onClose, onUpdateStatus, onDelete }: OrderDetailsProps) {
  const [status, setStatus] = useState<OrderStatus>(order?.status || "pending");
  if (!order) return null;

  const currentIndex = STATUS_FLOW.findIndex((s) => s.status === status);
  const formatMoney = (v: number) =>
    (config.currency === "EUR" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €" : v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " F");

  const changeStatus = (next: OrderStatus) => {
    setStatus(next);
    onUpdateStatus(order.id, next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d0d14] border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-[#0d0d14] z-10">
          <div>
            <h3 className="text-base font-extrabold text-white font-mono uppercase tracking-wider">DÉTAIL COMMANDE</h3>
            <p className="text-[10px] font-mono text-zinc-500">{order.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-block text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Product summary */}
          <div className="flex items-center gap-3 bg-black/40 border border-zinc-900 rounded-2xl p-3">
            <img src={order.productImage} alt="" className="w-14 h-14 rounded-xl object-cover bg-zinc-900" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono text-slate-100 truncate">{order.productTitle}</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                Quantité ×{order.quantity} • Réf. {order.productId}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono text-brand-red font-bold">{formatMoney(config.currency === "EUR" ? order.priceEur * order.quantity : order.priceXof * order.quantity)}</div>
              <div className="text-[9px] font-mono text-zinc-500">PRIX UNITAIRE {formatMoney(config.currency === "EUR" ? order.priceEur : order.priceXof)}</div>
            </div>
          </div>

          {/* Customer info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-black/40 border border-zinc-900 rounded-2xl p-3">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Client</div>
              <div className="text-sm font-mono text-slate-100">{order.customerName}</div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1">{order.customerPhone || "—"}</div>
            </div>
            <div className="bg-black/40 border border-zinc-900 rounded-2xl p-3">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Localisation</div>
              <div className="text-sm font-mono text-slate-100">{order.customerLocation}</div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1">{new Date(order.createdAt).toLocaleString("fr-FR")}</div>
            </div>
          </div>

          {/* Tracking timeline */}
          <div>
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-3">Suivi de commande</div>
            <div className="flex items-start justify-between">
              {STATUS_FLOW.map((step, i) => {
                const reached = i <= currentIndex;
                const isCurrent = i === currentIndex;
                return (
                  <div key={step.status} className="flex flex-col items-center flex-1 relative">
                    {i > 0 && (
                      <div className={`absolute top-[13px] left-[-50%] w-full h-0.5 ${i <= currentIndex ? "bg-brand-red" : "bg-zinc-800"}`} />
                    )}
                    <div
                      className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                        isCurrent
                          ? "bg-brand-red text-white border-brand-red shadow-lg shadow-brand-red/30"
                          : reached
                            ? "bg-brand-red/20 text-brand-red border-brand-red/50"
                            : "bg-zinc-900 text-zinc-600 border-zinc-800"
                      }`}
                    >
                      {step.icon}
                    </div>
                    <span className={`text-[8px] font-mono mt-1.5 text-center ${reached ? "text-zinc-200" : "text-zinc-600"}`}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status changer */}
          <div className="border-t border-zinc-800 pt-4">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-2">Changer le statut</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                    status === s
                      ? s === "cancelled"
                        ? "bg-red-600 text-white"
                        : "bg-brand-red text-white"
                      : "bg-black text-zinc-400 border border-zinc-800 hover:border-brand-red/40"
                  }`}
                >
                  {s === "cancelled" && <XCircle className="inline w-3 h-3 mr-1" />}
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Delete */}
          <div className="border-t border-zinc-800 pt-4 flex justify-end">
            <button
              onClick={() => {
                onDelete(order.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold uppercase text-red-400 border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Supprimer la commande
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
