import React, { useEffect, useState } from "react";
import { Users, ShieldCheck, ShieldOff, Crown, Clock, Plus, RefreshCw, Mail } from "lucide-react";
import { UsersData } from "../types";
import { fetchUsers, saveAdmins } from "../lib/api";

export default function UsersManager() {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchUsers());
    } catch (err: any) {
      setError(err.message || "Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isOwner = !!data && data.currentEmail !== "" && data.currentEmail === data.owner;

  const promote = async (email: string) => {
    if (!data || !isOwner) return;
    setSaving(true);
    setSavedMsg("");
    try {
      const next = await saveAdmins([...data.admins, email]);
      setData((d) => (d ? { ...d, admins: next } : d));
      setSavedMsg(`« ${email} » est désormais administrateur.`);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la promotion.");
    } finally {
      setSaving(false);
    }
  };

  const demote = async (email: string) => {
    if (!data || !isOwner) return;
    if (email === data.owner) return;
    setSaving(true);
    setSavedMsg("");
    try {
      const next = await saveAdmins(data.admins.filter((a) => a !== email));
      setData((d) => (d ? { ...d, admins: next } : d));
      setSavedMsg(`« ${email} » n'est plus administrateur.`);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la rétrogradation.");
    } finally {
      setSaving(false);
    }
  };

  const addByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !isOwner) return;
    const email = newEmail.trim().toLowerCase();
    if (!email || data.admins.includes(email)) {
      setNewEmail("");
      return;
    }
    setSaving(true);
    setSavedMsg("");
    try {
      const next = await saveAdmins([...data.admins, email]);
      setData((d) => (d ? { ...d, admins: next } : d));
      setNewEmail("");
      setSavedMsg(`« ${email} » ajouté comme administrateur (connexion Google autorisée).`);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'ajout.");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0d0d14] rounded-3xl p-8 border border-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-500">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin text-brand-red" /> Chargement des utilisateurs…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-[#0d0d14] rounded-3xl p-8 border border-zinc-800 text-xs font-mono text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-red" /> GESTION DES UTILISATEURS
          </h3>
          <p className="text-[10px] font-mono text-zinc-500 mt-1">
            {isOwner
              ? "Propriétaire — vous pouvez promouvoir ou rétrograder les administrateurs."
              : data?.currentEmail
                ? "Connecté en tant qu'administrateur (lecture seule)."
                : "Connecté via mot de passe (lecture seule)."}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-zinc-300 bg-black border border-zinc-800 hover:border-brand-red/40 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> RAFRAÎCHIR
        </button>
      </div>

      {savedMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl px-4 py-3 text-xs font-mono">
          {savedMsg}
        </div>
      )}
      {error && data && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl px-4 py-3 text-xs font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logins list */}
        <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
          <div>
            <h4 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-brand-red" /> CONNEXIONS GOOGLE
            </h4>
            <p className="text-[10px] font-mono text-zinc-500">Comptes Gmail qui se sont connectés</p>
          </div>

          <div className="space-y-2">
            {data?.logins.length === 0 && (
              <div className="py-8 text-center text-xs font-mono text-zinc-500">Aucune connexion Google enregistrée.</div>
            )}
            {data?.logins.map((u) => {
              const isAdmin = data.admins.includes(u.email);
              const isOwnerRow = u.email === data.owner;
              return (
                <div key={u.email} className="flex items-center gap-3 bg-black/40 border border-zinc-900 rounded-xl px-3 py-2.5">
                  {u.picture ? (
                    <img src={u.picture} alt="" className="w-9 h-9 rounded-full object-cover bg-zinc-900 border border-zinc-800" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-red to-[#900] flex items-center justify-center text-white text-xs font-mono font-bold">
                      {u.email.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-slate-200 flex items-center gap-1.5 truncate">
                      <span className="truncate">{u.name}</span>
                      {isOwnerRow && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                      {isAdmin && !isOwnerRow && <ShieldCheck className="w-3.5 h-3.5 text-brand-red shrink-0" />}
                    </div>
                    <div className="text-[9px] font-mono text-zinc-500 truncate">{u.email}</div>
                    <div className="text-[9px] font-mono text-zinc-600">Dernière connexion : {formatDate(u.loggedInAt)}</div>
                  </div>
                  {isOwnerRow ? (
                    <span className="text-[8px] font-mono font-bold uppercase text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded-full shrink-0">
                      Propriétaire
                    </span>
                  ) : isAdmin ? (
                    <button
                      onClick={() => demote(u.email)}
                      disabled={!isOwner || saving}
                      className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-1 rounded-lg text-red-400 border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 disabled:opacity-30 transition-all cursor-pointer"
                      title={isOwner ? "Rétrograder" : "Seul le propriétaire peut rétrograder"}
                    >
                      <ShieldOff className="w-3 h-3" /> Rétrograder
                    </button>
                  ) : (
                    <button
                      onClick={() => promote(u.email)}
                      disabled={!isOwner || saving}
                      className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-1 rounded-lg text-brand-red border border-brand-red/30 bg-brand-red/5 hover:bg-brand-red/15 disabled:opacity-30 transition-all cursor-pointer"
                      title={isOwner ? "Promouvoir administrateur" : "Seul le propriétaire peut promouvoir"}
                    >
                      <ShieldCheck className="w-3 h-3" /> Promouvoir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Admins + add */}
        <div className="space-y-6">
          <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-red" /> ADMINISTRATEURS
              </h4>
              <p className="text-[10px] font-mono text-zinc-500">Ces comptes Gmail peuvent se connecter au panneau</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data?.admins.map((a) => {
                const isOwnerRow = a === data.owner;
                return (
                  <span
                    key={a}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono border ${
                      isOwnerRow ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" : "bg-brand-red/10 border-brand-red/25 text-brand-red"
                    }`}
                  >
                    {isOwnerRow ? <Crown className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                    {a}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0d0d14] rounded-3xl p-5 md:p-6 border border-zinc-800 space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-brand-red" /> AJOUTER PAR EMAIL
              </h4>
              <p className="text-[10px] font-mono text-zinc-500">Autoriser un compte Gmail à accéder au panneau</p>
            </div>
            {!isOwner ? (
              <div className="text-[11px] font-mono text-zinc-500 bg-black/40 border border-zinc-900 rounded-xl px-3 py-2.5">
                Seul le propriétaire ({data?.owner}) peut ajouter des administrateurs.
              </div>
            ) : (
              <form onSubmit={addByEmail} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="prenom@gmail.com"
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-red/50 placeholder-zinc-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving || !newEmail.trim()}
                  className="bg-brand-red hover:bg-red-600 disabled:opacity-30 text-white text-xs font-mono font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> AJOUTER
                </button>
              </form>
            )}
            <p className="text-[9px] font-mono text-zinc-600 leading-relaxed">
              L'email ajouté pourra ensuite se connecter avec «&nbsp;Se connecter avec Google&nbsp;» sur l'écran de
              connexion. Toute personne connectée apparaît dans la liste des connexions ci-contre.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
