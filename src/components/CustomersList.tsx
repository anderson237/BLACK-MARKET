import React, { useMemo, useState } from "react";
import { Search, Phone } from "lucide-react";
import { Customer, WebhookConfig } from "../types";

interface CustomersListProps {
  customers: Customer[];
  config: WebhookConfig;
}

const PAGE_SIZE = 10;

export default function CustomersList({ customers, config }: CustomersListProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.location.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const formatMoney = (v: number) =>
    (config.currency === "EUR" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €" : v.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " F");

  return (
    <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-white font-mono uppercase tracking-wider">CLIENTS</h3>
          <p className="text-[10px] font-mono text-zinc-500">Base clients consolidée depuis les commandes</p>
        </div>
        <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un client…"
            className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-44 placeholder-zinc-600"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              <th className="py-2 pr-3">CLIENT</th>
              <th className="py-2 pr-3">LOCALISATION</th>
              <th className="py-2 pr-3">COMMANDES</th>
              <th className="py-2 pr-3">TOTAL DÉPENSÉ</th>
              <th className="py-2 pr-3">DERNIÈRE COMMANDE</th>
              <th className="py-2 text-right">CONTACT</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs font-mono text-zinc-500">
                  Aucun client enregistré.
                </td>
              </tr>
            )}
            {pageItems.map((c) => (
              <tr key={c.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-[#900] flex items-center justify-center text-white text-xs font-mono font-bold">
                      {c.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[11px] font-mono text-zinc-200">{c.name}</div>
                      <div className="text-[9px] font-mono text-zinc-500">{c.phone}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-[11px] font-mono text-zinc-400">{c.location}</td>
                <td className="py-2.5 pr-3 text-[11px] font-mono text-zinc-300 font-bold">{c.orders}</td>
                <td className="py-2.5 pr-3 text-[11px] font-mono text-brand-red font-bold">
                  {formatMoney(config.currency === "EUR" ? c.totalEur : c.totalXof)}
                </td>
                <td className="py-2.5 pr-3 text-[10px] font-mono text-zinc-500">
                  {new Date(c.lastOrderAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}
                </td>
                <td className="py-2.5 text-right">
                  <a
                    href={`https://wa.me/${c.phone.replace(/\+/g, "").replace(/\s/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex p-1.5 rounded-lg text-zinc-400 hover:text-green-400 hover:bg-zinc-900 transition-colors cursor-pointer"
                    title="Contacter sur WhatsApp"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] font-mono text-zinc-500">
          {filtered.length} client{filtered.length > 1 ? "s" : ""}
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
