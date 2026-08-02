import React, { useMemo, useState } from "react";
import { Plus, Trash2, Tag, Package, Check } from "lucide-react";
import { Product } from "../types";

const KNOWN_CATEGORIES_KEY = "bm_known_categories";
const CATEGORY_PRESETS = ["Techwear", "Streetwear", "Accessoires", "Électronique", "Mode", "Sac & Bagagerie", "EXCLUSIF"];

function loadKnownCategories(): string[] {
  try {
    const raw = localStorage.getItem(KNOWN_CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((s: unknown): s is string => typeof s === "string") : [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveKnownCategories(list: string[]) {
  try {
    localStorage.setItem(KNOWN_CATEGORIES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

interface CategoriesManagerProps {
  products: Product[];
  onUpdateProducts: (updated: Product[]) => void;
}

export default function CategoriesManager({ products, onUpdateProducts }: CategoriesManagerProps) {
  const [newCategory, setNewCategory] = useState("");
  const [known, setKnown] = useState<string[]>(loadKnownCategories);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const cat = p.category || "EXCLUSIF";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  const addCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = Array.from(new Set<string>([...known, trimmed]));
    saveKnownCategories(next);
    setKnown(next);
  };

  const removeCategory = (name: string) => {
    if (!window.confirm(`Supprimer la catégorie « ${name} » ? Les ${categories.find((c) => c.name === name)?.count ?? 0} produits concernés seront reclassés en « EXCLUSIF ».`)) {
      return;
    }
    const next = known.filter((k) => k !== name);
    saveKnownCategories(next);
    setKnown(next);
    const updated = products.map((p) => (p.category === name ? { ...p, category: "EXCLUSIF" } : p));
    onUpdateProducts(updated);
  };

  const renameCategory = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const next = Array.from(new Set<string>(known.map((k) => (k === oldName ? trimmed : k))));
    saveKnownCategories(next);
    setKnown(next);
    const updated = products.map((p) => (p.category === oldName ? { ...p, category: trimmed } : p));
    onUpdateProducts(updated);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addCategory(newCategory);
    setNewCategory("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-white font-mono uppercase tracking-wider">CATÉGORIES ACTIVES</h3>
          <p className="text-[10px] font-mono text-zinc-500">Répartition des produits par catégorie (cliquez pour renommer)</p>
        </div>

        <div className="space-y-2">
          {categories.map((c) => (
            <CategoryRow
              key={c.name}
              name={c.name}
              count={c.count}
              onRename={renameCategory}
              onDelete={removeCategory}
            />
          ))}
          {categories.length === 0 && (
            <div className="py-8 text-center text-xs font-mono text-zinc-500">Aucun produit classé.</div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-white font-mono uppercase tracking-wider">AJOUTER UNE CATÉGORIE</h3>
            <p className="text-[10px] font-mono text-zinc-500">Les catégories ajoutées apparaissent dans l'éditeur produit et le générateur IA</p>
          </div>

          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Ex : Techwear, Streetwear…"
              className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-red/50 placeholder-zinc-600"
            />
            <button
              type="submit"
              className="bg-brand-red hover:bg-red-600 text-white text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> AJOUTER
            </button>
          </form>

          <div>
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-2">Suggestions rapides</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_PRESETS.filter((p) => !known.includes(p)).map((preset) => (
                <button
                  key={preset}
                  onClick={() => addCategory(preset)}
                  className="px-3 py-1.5 rounded-full text-[10px] font-mono bg-black border border-zinc-800 text-zinc-300 hover:border-brand-red/40 hover:text-brand-red transition-all cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800">
          <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-2">Catégories connues</div>
          <div className="flex flex-wrap gap-2">
            {known.length === 0 && <span className="text-[10px] font-mono text-zinc-600">Aucune catégorie ajoutée manuellement.</span>}
            {known.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
                <Check className="w-3 h-3 text-brand-red" /> {k}
              </span>
            ))}
          </div>
        </div>

        <div className="border border-zinc-800 rounded-3xl p-5 flex items-start gap-2 text-[10px] font-mono text-zinc-500 bg-[#0d0d14]">
          <Package className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Renommer ou supprimer une catégorie répercute le changement sur tous les produits concernés (les produits
            supprimés sont reclassés en «&nbsp;EXCLUSIF&nbsp;»).
          </span>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  name,
  count,
  onRename,
  onDelete,
}: {
  name: string;
  count: number;
  onRename: (old: string, next: string) => void;
  onDelete: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const commit = () => {
    onRename(name, draft);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between bg-black/40 border border-zinc-900 rounded-xl px-3 py-2.5 group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-brand-red/10 border border-brand-red/25 flex items-center justify-center shrink-0">
          <Tag className="w-3.5 h-3.5 text-brand-red" />
        </div>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={commit}
            className="flex-1 min-w-0 bg-black border border-brand-red/50 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
            className="text-xs font-mono text-slate-200 truncate hover:text-brand-red transition-colors cursor-pointer"
            title="Cliquer pour renommer"
          >
            {name}
          </button>
        )}
        <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full shrink-0">
          {count} produit{count > 1 ? "s" : ""}
        </span>
      </div>
      <button
        onClick={() => onDelete(name)}
        className="p-1.5 rounded-lg text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-zinc-900 transition-all cursor-pointer"
        title="Supprimer la catégorie"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
