import React, { useState } from "react";
import { X, User, MapPin, Phone, Plus } from "lucide-react";
import { Order, WebhookConfig } from "../types";

interface OrdersManagerProps {
  orders: Order[];
  config: WebhookConfig;
  products: { id: string; title: string; imageUrl: string; priceXof: number; priceEur: number }[];
  onAddOrder: (order: Omit<Order, "id" | "createdAt" | "status">) => void;
  onClose: () => void;
}

export default function OrdersManager({ orders, config, products, onAddOrder, onClose }: OrdersManagerProps) {
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerLocation, setCustomerLocation] = useState("");
  const [quantity, setQuantity] = useState(1);

  const selectedProduct = products.find((p) => p.id === productId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    onAddOrder({
      productId: selectedProduct.id,
      productTitle: selectedProduct.title,
      productImage: selectedProduct.imageUrl,
      customerName: customerName.trim() || "Client WhatsApp",
      customerPhone: customerPhone.trim(),
      customerLocation: customerLocation.trim() || "—",
      quantity: Math.max(1, quantity),
      priceXof: selectedProduct.priceXof,
      priceEur: selectedProduct.priceEur,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0d0d14] border border-zinc-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-[#0d0d14] z-10">
          <div>
            <h3 className="text-base font-extrabold text-white font-mono uppercase tracking-wider">NOUVELLE COMMANDE</h3>
            <p className="text-[10px] font-mono text-zinc-500">Enregistrer une précommande reçue via WhatsApp</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Produit commandé</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-red/50 cursor-pointer"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0d0d14]">
                  {p.title}
                </option>
              ))}
            </select>
            {selectedProduct && (
              <div className="flex items-center gap-2 mt-2 bg-black/40 border border-zinc-900 rounded-xl p-2">
                <img src={selectedProduct.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover bg-zinc-900" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                <span className="text-[10px] font-mono text-zinc-400">
                  {config.currency === "EUR"
                    ? selectedProduct.priceEur.toLocaleString("fr-FR") + " €"
                    : selectedProduct.priceXof.toLocaleString("fr-FR") + " F CFA"}{" "}
                  / unité
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Quantité</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-red/50"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              <User className="w-3 h-3" /> Nom du client
            </label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex : Patrick Elom"
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-red/50 placeholder-zinc-700"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              <Phone className="w-3 h-3" /> Numéro WhatsApp
            </label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Ex : 237 6 83 96 30 07"
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-red/50 placeholder-zinc-700"
            />
          </div>

          <div>
            <label className="flex items-center gap-1 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
              <MapPin className="w-3 h-3" /> Localisation
            </label>
            <input
              value={customerLocation}
              onChange={(e) => setCustomerLocation(e.target.value)}
              placeholder="Ex : Douala, Cameroun"
              className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-red/50 placeholder-zinc-700"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand-red hover:bg-red-600 text-white text-xs font-mono font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> ENREGISTRER LA COMMANDE
          </button>
        </form>
      </div>
    </div>
  );
}
