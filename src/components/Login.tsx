import React from "react";
import { Flame, Lock } from "lucide-react";

interface LoginProps {
  password: string;
  onPasswordChange: (value: string) => void;
  loginError: string;
  isLocked: boolean;
  lockoutTime: number;
  onSubmit: (e: React.FormEvent) => void;
}

export default function Login({
  password,
  onPasswordChange,
  loginError,
  isLocked,
  lockoutTime,
  onSubmit,
}: LoginProps) {
  return (
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center p-4 relative font-sans overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,42,42,0.08)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-brand-red/5 blur-[120px] -top-40 -left-40 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-red-900/5 blur-[100px] -bottom-40 -right-40 pointer-events-none" />

      <div className="w-full max-w-md bg-[#0d0d14] rounded-3xl p-8 border border-brand-red/30 shadow-2xl relative z-10 space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-red to-[#900] flex items-center justify-center text-white mx-auto shadow-lg shadow-brand-red/25 border border-brand-red animate-pulse">
            <Flame className="w-8 h-8 fill-white" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-black text-white tracking-widest font-mono">BLACK MARKET</span>
              <span className="text-[9px] font-mono font-bold bg-brand-red/25 text-brand-red border border-brand-red/45 px-1.5 py-0.5 rounded">SÉCURISÉ</span>
            </div>
            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mt-1">
              SINO-PREP CONSOLE // EXTREME SECURITY BLOCK
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">
              Clé de Sûreté Administrateur :
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-red font-mono text-sm font-bold">#</span>
              <input
                type="password"
                disabled={isLocked}
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="w-full pl-8 pr-4 py-3 bg-black text-slate-100 text-sm rounded-xl border border-zinc-800 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red font-mono transition-all text-center tracking-widest"
              />
            </div>
          </div>

          {loginError && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-[11px] text-red-400 leading-relaxed font-mono text-center">
              ⚠️ {loginError}
              {isLocked && (
                <div className="mt-1.5 text-xs text-white font-extrabold animate-pulse">
                  TEMPS D'ATTENTE : {lockoutTime} SECONDES
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLocked || !password}
            className={`w-full py-3 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer uppercase ${
              isLocked || !password
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800 shadow-none"
                : "bg-brand-red hover:bg-red-600 text-white shadow-brand-red/20 border border-brand-red/50"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>DÉVERROUILLER LA CONSOLE</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-zinc-900">
          <p className="text-[9px] text-zinc-600 font-mono">
            SESSION AUTO-EXPIRY 15M // CLÉ D'ACCÈS REQUISE // RATE-LIMITED
          </p>
          <p className="text-[10px] text-zinc-400 font-mono mt-1.5 bg-black/50 py-1 rounded border border-zinc-900">
            Accès réservé aux administrateurs habilités.
          </p>
        </div>
      </div>
    </div>
  );
}
