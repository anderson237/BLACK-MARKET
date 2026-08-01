import React, { useState, useEffect, useRef } from "react";
import { Product, WebhookConfig } from "../types";
import {
  Phone, 
  Search, 
  Tag, 
  Sparkles, 
  Video, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX,
  Smartphone,
  MessageSquare,
  Activity,
  DollarSign,
  TrendingUp,
  Cpu,
  Clock,
  Flame,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Globe,
  Database,
  Trash2,
  Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProductEditor from "./ProductEditor";

interface CatalogProps {
  products: Product[];
  onProductClick?: (product: Product) => void;
  onIncrementClicks?: (product: Product) => void;
  onDeleteProduct?: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
  config: WebhookConfig;
}

export default function Catalog({ products, config, onIncrementClicks, onDeleteProduct, onUpdateProduct }: CatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProductForWa, setSelectedProductForWa] = useState<Product | null>(null);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [whatsappSimNumber, setWhatsappSimNumber] = useState<string>(config.phoneNumber);

  // Keep the WhatsApp number in sync with the console header config
  useEffect(() => {
    setWhatsappSimNumber(config.phoneNumber);
  }, [config.phoneNumber]);

  // Video/Slideshow Template States
  const [activeVideoProduct, setActiveVideoProduct] = useState<Product | null>(null);
  const [videoPlaying, setVideoPlaying] = useState<boolean>(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [synthAudioActive, setSynthAudioActive] = useState<boolean>(false);

  // Interactive Sourcing Tool State (Simulated Korean interactive widgets)
  const [rmbRate, setRmbRate] = useState<number>(91.5); // 1 RMB = 91.5 XOF
  const [shippingCostKg, setShippingCostKg] = useState<number>(6500); // F CFA per kg cargo
  
  // Simulated Live Feed logs typical of Korean streetwear/cyber sites
  const [liveWeChatLogs, setLiveWeChatLogs] = useState<Array<{ id: number; time: string; msg: string; location: string }>>([
    { id: 1, time: "07:12:45", msg: "Lot #2284 Masques Cyberpunk scellés et prêts pour cargo Guangzhou", location: "Guangzhou" },
    { id: 2, time: "07:14:02", msg: "Calcul du coût volumétrique terminé pour l'envoi Abidjan Port", location: "Yiwu" },
    { id: 3, time: "07:15:10", msg: "Fiche d'importation traduite par Gemini IA en 0.42s : Veste K-Street", location: "SinoPrep-AI" },
    { id: 4, time: "07:15:38", msg: "Vérification qualité terminée : Lot Claviers transparents RGB 100% OK", location: "Shenzhen" },
  ]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioIntervalRef = useRef<any>(null);

  // Push random simulated factory updates onto the live log feed
  useEffect(() => {
    const intervals = [
      "Nouveau produit détecté sur WeChat : Hoodie réfléchissant",
      "Calcul des marges à 60% appliqué via Google Sheets",
      "Webhook Make.com déclenché avec succès pour 1 article",
      "Frais de douane estimés mis à jour pour la zone CEDEAO",
      "Lot expédié vers l'entrepôt de tri de Shenzhen",
      "Traduction IA finalisée : Lunettes de soleil néon Y2K",
    ];
    const cities = ["Guangzhou", "Shenzhen", "Yiwu", "SinoPrep-AI", "Zhejiang"];

    const timer = setInterval(() => {
      const randomMsg = intervals[Math.floor(Math.random() * intervals.length)];
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];
      
      setLiveWeChatLogs((prev) => [
        { id: Date.now(), time: timeStr, msg: randomMsg, location: randomCity },
        ...prev.slice(0, 4) // Keep last 5 logs
      ]);
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  // Close any open modal with the Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedProductForWa(null);
        setSelectedProductForDetails(null);
        setActiveVideoProduct(null);
        setVideoPlaying(false);
        setEditingProduct(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cleanup Web Audio resources on unmount
  useEffect(() => {
    return () => {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Extract unique categories
  const categories = ["Tous", ...Array.from(new Set(products.map((p) => p.category)))];

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === "Tous" || p.category === selectedCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.chineseTitle && p.chineseTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Calculate WhatsApp Link according to prompt requirements
  const getProductSiteUrl = (productId: string) => {
    return `https://blackmarket-import-export.netlify.app/p/${productId}.html`;
  };

  const buildWaMessage = (product: Product, priceFormatted: string, productUrl: string) => {
    return [
      "Bonjour BLACK MARKET, 👋",
      "",
      "Je souhaite passer une PRÉCOMMANDE pour le produit suivant :",
      "",
      `  📦 PRODUIT : ${String(product.title || "").toUpperCase()}`,
      `  💰 PRIX : ${priceFormatted}`,
      `  🔗 FICHE PRODUIT : ${productUrl}`,
      "",
      "Merci de me confirmer la disponibilité, le délai de livraison et les modalités de paiement.",
      "",
      "Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées.",
    ].join("\n");
  };

  const generateWhatsAppLink = (product: Product) => {
    const priceFormatted = config.currency === "EUR" ? `${product.priceEur}€` : `${product.priceXof} F CFA`;
    const text = buildWaMessage(product, priceFormatted, getProductSiteUrl(product.id));
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/${whatsappSimNumber.replace(/\+/g, "").replace(/\s/g, "")}?text=${encodedText}`;
  };

  const handleCopyLink = (product: Product) => {
    const link = generateWhatsAppLink(product);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Web Audio Synth for Slideshow Ambient Beat (Creative Video solution!)
  const toggleSynthAudio = (play: boolean) => {
    if (!play) {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
      return;
    }

    if (isMuted) return;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      if (!audioIntervalRef.current) {
        let beatCount = 0;
        audioIntervalRef.current = setInterval(() => {
          if (ctx.state === "suspended" || isMuted) return;
          
          const time = ctx.currentTime;
          
          // Heavy techno synth-wave kick
          const kick = ctx.createOscillator();
          const kickGain = ctx.createGain();
          kick.connect(kickGain);
          kickGain.connect(ctx.destination);
          
          kick.frequency.setValueAtTime(140, time);
          kick.frequency.exponentialRampToValueAtTime(0.01, time + 0.2);
          
          kickGain.gain.setValueAtTime(0.4, time);
          kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
          
          kick.start(time);
          kick.stop(time + 0.22);

          // Digital cyber click on offbeats
          if (beatCount % 2 === 1) {
            const hat = ctx.createOscillator();
            const hatGain = ctx.createGain();
            hat.type = "sawtooth";
            hat.connect(hatGain);
            hatGain.connect(ctx.destination);
            
            hat.frequency.setValueAtTime(1200, time);
            hatGain.gain.setValueAtTime(0.04, time);
            hatGain.gain.exponentialRampToValueAtTime(0.005, time + 0.08);
            
            hat.start(time);
            hat.stop(time + 0.09);
          }

          beatCount = (beatCount + 1) % 4;
        }, 320); // Fast electro tempo (around 180 BPM)
      }
      setSynthAudioActive(true);
    } catch (e) {
      console.warn("Audio Context blocked", e);
    }
  };

  // Slideshow cycle effect when video is playing
  useEffect(() => {
    let interval: any;
    if (videoPlaying && activeVideoProduct) {
      toggleSynthAudio(true);
      interval = setInterval(() => {
        setCurrentSlideIndex((prev) => (prev + 1) % 4);
      }, 3000); // 3 seconds per slide for fast-paced video
    } else {
      toggleSynthAudio(false);
    }

    return () => {
      clearInterval(interval);
      toggleSynthAudio(false);
    };
  }, [videoPlaying, activeVideoProduct, isMuted]);

  const handleStartVideo = (product: Product) => {
    setActiveVideoProduct(product);
    setCurrentSlideIndex(0);
    setVideoPlaying(true);
  };

  const getProductSlides = (product: Product) => {
    const priceFormatted = config.currency === "EUR" ? `${product.priceEur} €` : `${product.priceXof.toLocaleString("fr-FR")} F CFA`;
    return [
      {
        title: product.title,
        subtitle: "⚠️ EN DIRECT DE SHENZHEN - LIMITED DROP",
        text: "Fabrication d'origine vérifiée. Sourcing direct sans intermédiaires via BLACK MARKET.",
        badge: "EXCLUSIF",
        bgClass: "from-red-950 via-slate-950 to-black"
      },
      {
        title: "PITCH PREMIUM",
        subtitle: "🔥 COP DIRECT",
        text: product.description.substring(0, 140) + "...",
        badge: "COPYWRITING IA",
        bgClass: "from-red-900 to-black"
      },
      {
        title: "SPÉCIFICATIONS",
        subtitle: "⚙️ ENQUÊTE QUALITÉ",
        text: product.features[0] || "Produit sélectionné par nos soins.",
        badge: "CONTRÔLE QUALITÉ",
        bgClass: "from-zinc-900 to-red-950"
      },
      {
        title: `TARIF : ${priceFormatted}`,
        subtitle: "💬 COMMANDE WHATSAPP IMMÉDIATE",
        text: "Cliquez sur 'Commander' pour ouvrir WhatsApp avec le bon de précommande pré-rempli.",
        badge: "TARIF USINE",
        bgClass: "from-red-600 via-zinc-950 to-black"
      }
    ];
  };

  return (
    <div className="space-y-8" id="catalog-section">
      
      {/* 🔴 SCROLLING NEON MARQUEE - Typical Korean Shopping style */}
      <div className="relative w-full bg-brand-dark border-y border-brand-red py-1.5 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-brand-dark to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-brand-dark to-transparent z-10 pointer-events-none"></div>
        <div className="flex whitespace-nowrap animate-marquee">
          <div className="flex gap-8 text-[11px] font-mono font-bold tracking-widest text-brand-red uppercase">
            <span>● 🔴 DROP EN COURS SINO-PREP</span>
            <span className="text-white">● CLÉ API GEMINI ACTIVÉE : TRADUCTION CHINOIS EN TEMPS RÉEL</span>
            <span>● PROGRES EXPÉDITION : AIR CARGO SHENZHEN TO ABIDJAN / EUROPE OK</span>
            <span className="text-white">● WATERMARK ACTIF : [BLACK MARKET] APPLIQUÉ SUR TOUS LES VISUELS</span>
            <span>● TAILLE DU LOT LIMITÉE À 100 EX_</span>
            <span>● BOUTON WHATSAPP SYNCHRONISÉ</span>
          </div>
          <div className="flex gap-8 text-[11px] font-mono font-bold tracking-widest text-brand-red uppercase ml-8">
            <span>● 🔴 DROP EN COURS SINO-PREP</span>
            <span className="text-white">● CLÉ API GEMINI ACTIVÉE : TRADUCTION CHINOIS EN TEMPS RÉEL</span>
            <span>● PROGRES EXPÉDITION : AIR CARGO SHENZHEN TO ABIDJAN / EUROPE OK</span>
            <span className="text-white">● WATERMARK ACTIF : [BLACK MARKET] APPLIQUÉ SUR TOUS LES VISUELS</span>
            <span>● TAILLE DU LOT LIMITÉE À 100 EX_</span>
            <span>● BOUTON WHATSAPP SYNCHRONISÉ</span>
          </div>
        </div>
      </div>

      {/* 🇰🇷 KOREAN-STYLE DENSITY WINDOW BOARD (MULTIPLE DATA WINDOWS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* WINDOW 1: LIVE SOURCING terminal logs */}
        <div className="lg:col-span-5 bg-brand-card rounded-2xl border border-brand-red/30 p-5 shadow-lg relative flex flex-col justify-between overflow-hidden">
          {/* Windows bar Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-red animate-ping" />
              <h3 className="font-mono text-xs font-bold text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-brand-red" />
                WeChat Factory Monitor _
              </h3>
            </div>
            <span className="text-[9px] font-mono text-zinc-500 bg-black px-2 py-0.5 rounded border border-zinc-800">
              SECURE LINK
            </span>
          </div>

          <div className="space-y-2.5 font-mono text-[10px] flex-1">
            {liveWeChatLogs.map((log) => (
              <div key={log.id} className="p-2 bg-black/40 rounded border border-zinc-900 flex items-start gap-2 hover:border-brand-red/20 transition-all">
                <span className="text-brand-red font-bold">[{log.time}]</span>
                <div className="flex-1">
                  <span className="text-zinc-500 text-[9px] uppercase font-bold mr-1 bg-zinc-800/80 px-1 py-0.2 rounded">
                    {log.location}
                  </span>
                  <span className="text-slate-300">{log.msg}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Sourcing footer status */}
          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[9px] font-mono text-zinc-400">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-brand-red" /> Webhook: CONNECTED TO MAKE.COM
            </span>
            <span className="text-brand-red font-bold">LIVE STREAM</span>
          </div>
        </div>

        {/* WINDOW 2: INTERACTIVE EXCHANGE RATE CONVERTER */}
        <div className="lg:col-span-4 bg-brand-card rounded-2xl border border-brand-red/30 p-5 shadow-lg relative flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-xs font-bold text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-brand-red" />
                Calculateur de Fret & Change _
              </h3>
            </div>
            <span className="text-[9px] font-mono text-zinc-500">CNY / XOF / EUR</span>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-zinc-400 text-[10px] leading-relaxed">
              Ajustez les variables d'importation pour simuler automatiquement la viabilité financière de vos fiches chinoises.
            </p>

            <div className="space-y-2.5 bg-black/50 p-3 rounded-xl border border-zinc-900">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-mono text-[10px]">Taux de change (1 RMB en CFA) :</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-[11px] font-bold text-brand-red"
                    value={rmbRate}
                    onChange={(e) => setRmbRate(Number(e.target.value))}
                  />
                  <span className="font-mono text-[10px] text-zinc-500">FCFA</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-mono text-[10px]">Tarif Fret Air Cargo (par Kg) :</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="100"
                    className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-right font-mono text-[11px] font-bold text-brand-red"
                    value={shippingCostKg}
                    onChange={(e) => setShippingCostKg(Number(e.target.value))}
                  />
                  <span className="font-mono text-[10px] text-zinc-500">FCFA</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-zinc-500 italic text-center">
              Frais de douane intégrés par lot d'import : <span className="text-white font-bold">12%</span>
            </div>
          </div>

          <div className="mt-3 text-center">
            <span className="text-[9px] text-brand-red uppercase font-bold tracking-widest bg-brand-red/10 border border-brand-red/20 px-3 py-1 rounded-full">
              Sourcing Rentable à 94%
            </span>
          </div>
        </div>

        {/* WINDOW 3: QUICK EXCLUSIVE STATS */}
        <div className="lg:col-span-3 bg-brand-card rounded-2xl border border-brand-red/30 p-5 shadow-lg relative flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
            <h3 className="font-mono text-xs font-bold text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-brand-red fill-brand-red" />
              Indicateurs BLACK MARKET _
            </h3>
            <span className="text-[8px] bg-zinc-900 text-brand-red border border-brand-red/40 px-1.5 rounded font-mono">
              HOT
            </span>
          </div>

          <div className="space-y-3 font-mono text-[10px]">
            <div className="bg-black/40 p-2 rounded border border-zinc-900 flex justify-between items-center">
              <span className="text-zinc-500">PRODUITS SOURCÉS :</span>
              <span className="font-bold text-slate-100">{products.length} Drop actifs</span>
            </div>

            <div className="bg-black/40 p-2 rounded border border-zinc-900 flex justify-between items-center">
              <span className="text-zinc-500">WHATSAPP CLICKS :</span>
              <span className="font-bold text-green-500">
                {products.reduce((acc, curr) => acc + curr.whatsappClicks, 0)} clics
              </span>
            </div>

            <div className="bg-black/40 p-2 rounded border border-zinc-900 space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">STATUT CARGO LOT :</span>
                <span className="text-brand-red font-bold animate-pulse">82% Rempli</span>
              </div>
              <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                <div className="bg-brand-red h-full rounded-full w-[82%]" />
              </div>
            </div>
          </div>

          <div className="mt-3 text-[9px] text-zinc-500 leading-normal text-center bg-black p-1.5 rounded border border-zinc-900">
            Fermeture des précommandes dans : <br />
            <span className="text-brand-red font-bold">04 jours, 18 heures</span>
          </div>
        </div>

      </div>

      {/* Main Filter and Search Bar Section */}
      <div className="flex flex-col md:flex-row gap-4 bg-brand-card p-5 rounded-2xl border border-zinc-800">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-zinc-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all placeholder:text-zinc-600 font-mono"
            placeholder="Rechercher sur le BLACK MARKET (Titre, Code d'usine...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-[10px] font-mono"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Korean Streetwear Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 uppercase font-mono ${
                selectedCategory === cat
                  ? "bg-brand-red text-white shadow-lg shadow-brand-red/30 border border-brand-red"
                  : "bg-black text-zinc-500 border border-zinc-800 hover:border-brand-red/50 hover:text-slate-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-brand-card p-12 rounded-3xl border border-zinc-800 text-center space-y-3">
          <p className="text-zinc-500 text-xs font-mono">_ AUCUN ELEMENT TROUVE DANS LE SYSTEME_</p>
          <button 
            onClick={() => { setSelectedCategory("Tous"); setSearchQuery(""); }} 
            className="text-[10px] text-brand-red font-bold font-mono tracking-wider uppercase hover:underline"
          >
            [ REINITIALISER LES FLUX ]
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const priceFormatted = config.currency === "EUR" 
              ? `${product.priceEur} €` 
              : `${product.priceXof.toLocaleString("fr-FR")} F CFA`;
              
            return (
              <motion.div
                layout
                id={`product-card-${product.id}`}
                key={product.id}
                onClick={() => setSelectedProductForDetails(product)}
                className="bg-brand-card rounded-3xl overflow-hidden border border-zinc-800/80 shadow-md hover:shadow-xl hover:shadow-brand-red/5 hover:border-brand-red/40 transition-all duration-300 flex flex-col group h-full relative cursor-pointer"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                {/* 🔒 Watermarked Product Image & Badge */}
                <div className="relative aspect-video overflow-hidden bg-zinc-950">
                  
                  {/* Image */}
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                  />

                  {/* 🔴 MANDATORY USER SPECIFIED WATERMARK: "BLACK MARKET" */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-25">
                    <span className="text-white font-extrabold text-3xl font-mono border-4 border-white/50 px-4 py-2 rotate-12 tracking-widest uppercase">
                      BLACK MARKET
                    </span>
                  </div>

                  {/* Top tags info */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1">
                    <span className="bg-brand-red text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-lg shadow-md border border-brand-red/55">
                      {product.category}
                    </span>
                    {product.sourceRmb && (
                      <span className="bg-black/95 text-yellow-500 border border-zinc-800 text-[8px] font-mono px-2 py-0.5 rounded shadow-sm w-fit">
                        Sourcing: ¥{product.sourceRmb} RMB
                      </span>
                    )}
                  </div>

                  {/* Video Generator Action Button with neon ripple */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStartVideo(product); }}
                    className="absolute bottom-3 right-3 bg-brand-red hover:bg-red-700 text-white p-2.5 rounded-full shadow-lg hover:scale-115 transition-all flex items-center justify-center group/btn border border-brand-red"
                    title="Générer / Lancer la vidéo publicitaire avec filigrane"
                  >
                    <Video className="w-4 h-4 group-hover/btn:animate-pulse" />
                  </button>

                  {/* Admin Edit & Delete Buttons */}
                  {onUpdateProduct && (
                    <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingProduct(product); }}
                        className="bg-black/80 hover:bg-zinc-900 border border-zinc-800 hover:border-brand-red/50 text-zinc-400 hover:text-brand-red p-2 rounded-lg transition-all"
                        title="Modifier ce produit (éditeur WYSIWYG)"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteProduct && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Supprimer définitivement "${product.title}" du catalogue ?`)) {
                              onDeleteProduct(product);
                            }
                          }}
                          className="bg-black/80 hover:bg-red-950 border border-zinc-800 hover:border-red-900 text-zinc-500 hover:text-red-400 p-2 rounded-lg transition-all"
                          title="Supprimer ce produit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Content body */}
                <div className="p-6 flex flex-col flex-1 space-y-4">
                  {/* Title and Chinese translation indicator */}
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-100 text-sm sm:text-base leading-snug tracking-tight group-hover:text-brand-red transition-colors font-sans">
                      {product.title}
                    </h3>
                    {product.chineseTitle && (
                      <p className="text-[9px] text-zinc-500 font-mono flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5 text-brand-red" /> Grossiste: {product.chineseTitle}
                      </p>
                    )}
                  </div>

                  {/* Translated sales pitch */}
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                    {product.description}
                  </p>

                  {/* Features badges list */}
                  {product.features && product.features.length > 0 && (
                    <div className="space-y-1 bg-black/40 p-3 rounded-xl border border-zinc-900">
                      <p className="text-[9px] text-brand-red uppercase font-bold tracking-wider font-mono">Fiche technique IA :</p>
                      <ul className="space-y-1">
                        {product.features.slice(0, 3).map((f, i) => (
                          <li key={i} className="text-[10px] text-slate-300 flex items-start gap-1">
                            <span className="text-brand-red font-bold">▪</span>
                            <span className="line-clamp-1">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Pricing and command order section */}
                  <div className="pt-3 flex items-center justify-between border-t border-zinc-900 mt-auto">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-zinc-500 uppercase font-mono tracking-widest">PRIX UNITAIRE FACTORY</span>
                      <span className="text-base font-extrabold text-slate-100 tracking-tight">
                        {priceFormatted}
                      </span>
                    </div>

                    {/* Trigger pop-up with custom generated WhatsApp link */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedProductForWa(product); }}
                      className="bg-brand-red hover:bg-red-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-brand-red/10 border border-brand-red/40"
                    >
                      <Phone className="w-3.5 h-3.5 fill-white" />
                      <span>Précommander</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ----------------- MODAL: WHATSAPP LINK REDIRECTION PREVIEW ----------------- */}
      <AnimatePresence>
        {selectedProductForWa && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-brand-card rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-brand-red/30 text-slate-200"
            >
              {/* Header in black & red */}
              <div className="bg-brand-red text-white p-6 flex items-center justify-between border-b border-brand-red/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center">
                    <Phone className="w-5 h-5 fill-white" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm uppercase tracking-wider font-mono">Bouton WhatsApp Dynamique</h4>
                    <p className="text-[10px] text-zinc-200">Génération automatique du lien BLACK MARKET</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProductForWa(null)}
                  className="bg-black/40 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <p className="text-zinc-400 text-xs">
                  Voici comment fonctionne le lien envoyé à votre numéro <strong>{whatsappSimNumber}</strong>. Le script génère une chaîne URL formatée avec le nom et le prix du produit.
                </p>

                {/* Simulated Smartphone Chat Screen */}
                <div className="bg-black/60 rounded-2xl p-4 border border-zinc-900 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-brand-red"></div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-brand-red flex items-center justify-center text-[10px] text-white font-bold">
                      B
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-100 font-mono">Client @BLACK_MARKET</p>
                      <p className="text-[9px] text-brand-red flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-red inline-block animate-pulse"></span> Écrit le message...
                      </p>
                    </div>
                  </div>

                  {/* Speech Bubble */}
                  <div className="bg-brand-red/10 border border-brand-red/20 text-slate-300 p-3 rounded-2xl rounded-tl-none text-xs leading-relaxed max-w-[90%] shadow-xs space-y-2">
                    <p className="font-semibold text-slate-100">
                      Bonjour BLACK MARKET, 👋
                    </p>
                    <p>
                      Je souhaite passer une PRÉCOMMANDE pour le produit suivant :
                    </p>
                    <div className="space-y-1 pl-2 border-l-2 border-brand-red/50">
                      <p className="whitespace-pre-line text-slate-200">
                        📦 PRODUIT : <span className="text-brand-red font-bold">{selectedProductForWa.title.toUpperCase()}</span>
                      </p>
                      <p className="whitespace-pre-line text-slate-200">
                        💰 PRIX : <span className="text-brand-red font-bold">{config.currency === "EUR" ? `${selectedProductForWa.priceEur}€` : `${selectedProductForWa.priceXof} F CFA`}</span>
                      </p>
                      <p className="whitespace-pre-line text-slate-200 break-all">
                        🔗 FICHE : <span className="text-brand-red font-bold">{getProductSiteUrl(selectedProductForWa.id)}</span>
                      </p>
                    </div>
                    <p>Merci de confirmer la disponibilité et les modalités de paiement.</p>
                  </div>
                </div>

                {/* Absolute Link Generation Code */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Lien wa.me généré dynamiquement</span>
                  <div className="flex items-center gap-2 bg-black p-2.5 rounded-xl border border-zinc-900">
                    <code className="text-[10px] font-mono text-brand-red break-all flex-1 select-all select-none">
                      {generateWhatsAppLink(selectedProductForWa)}
                    </code>
                    <button
                      onClick={() => handleCopyLink(selectedProductForWa)}
                      className="bg-brand-dark hover:bg-zinc-900 border border-zinc-800 p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                      title="Copier le lien"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Final Action */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      onIncrementClicks?.(selectedProductForWa);
                      window.open(generateWhatsAppLink(selectedProductForWa), "_blank", "noopener,noreferrer");
                    }}
                    className="flex-1 bg-brand-red hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-brand-red/20 flex items-center justify-center gap-2 transition-all cursor-pointer border border-brand-red/50"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Ouvrir sur WhatsApp (Test)</span>
                  </button>
                  
                  <button
                    onClick={() => setSelectedProductForWa(null)}
                    className="px-4 py-2.5 border border-zinc-800 text-zinc-400 hover:bg-zinc-900 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL: AD-VIDEO / SLIDESHOW TEMPLATE GENERATOR ----------------- */}
      <AnimatePresence>
        {activeVideoProduct && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-brand-card text-slate-100 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-zinc-800 grid grid-cols-1 md:grid-cols-12"
            >
              {/* Left Column: Vertical TikTok Player Simulation */}
              <div className="md:col-span-5 bg-black relative aspect-[9/16] md:aspect-auto md:h-[500px] flex items-center justify-center overflow-hidden border-r border-zinc-950">
                {/* Simulated dynamic background and active slide */}
                <div className={`absolute inset-0 bg-gradient-to-br ${getProductSlides(activeVideoProduct)[currentSlideIndex].bgClass} opacity-90 transition-all duration-700`}></div>
                
                {/* Rotating subtle visual backdrop */}
                <div className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-25 blur-xs scale-110" style={{ backgroundImage: `url(${activeVideoProduct.imageUrl})` }}></div>

                {/* 🔒 WATERMARK BLACK MARKET OVERLAY IN VIDEO SLIDESHOW */}
                <div className="absolute inset-0 flex flex-col justify-between p-12 pointer-events-none select-none overflow-hidden opacity-15">
                  <span className="text-white font-extrabold text-2xl font-mono tracking-widest text-center border border-white/40 rotate-[-15deg] py-1">
                    BLACK MARKET
                  </span>
                  <span className="text-white font-extrabold text-2xl font-mono tracking-widest text-center border border-white/40 rotate-15 py-1">
                    BLACK MARKET
                  </span>
                </div>

                {/* Active Slide Image or Typography */}
                <div className="relative z-10 p-6 text-center w-full h-full flex flex-col justify-between py-12">
                  {/* Top Bar info */}
                  <div className="flex justify-between items-center w-full">
                    <span className="bg-brand-red text-white text-[8px] uppercase tracking-widest font-extrabold px-3 py-1 rounded-lg border border-brand-red/50">
                      {getProductSlides(activeVideoProduct)[currentSlideIndex].badge}
                    </span>
                    <div className="flex gap-0.5">
                      {[0, 1, 2, 3].map((idx) => (
                        <div 
                          key={idx} 
                          className={`h-1 w-6 rounded-full transition-all duration-300 ${idx === currentSlideIndex ? "bg-brand-red" : "bg-white/20"}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Main Kinetic Content */}
                  <div className="space-y-4 my-auto">
                    <motion.p
                      key={`sub-${currentSlideIndex}`}
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-[9px] font-mono tracking-widest uppercase text-brand-red font-black"
                    >
                      {getProductSlides(activeVideoProduct)[currentSlideIndex].subtitle}
                    </motion.p>
                    
                    <motion.h3
                      key={`title-${currentSlideIndex}`}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-2xl font-black tracking-tight text-slate-100 leading-tight font-sans uppercase"
                    >
                      {getProductSlides(activeVideoProduct)[currentSlideIndex].title}
                    </motion.h3>

                    <motion.p
                      key={`text-${currentSlideIndex}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-zinc-300 px-4 leading-relaxed max-w-sm mx-auto"
                    >
                      {getProductSlides(activeVideoProduct)[currentSlideIndex].text}
                    </motion.p>
                  </div>

                  {/* Static CTA Bottom Overlay */}
                  <div className="space-y-2.5 pt-6 border-t border-white/10">
                    {currentSlideIndex === 3 ? (
                      <div className="bg-brand-red text-white rounded-xl py-2.5 px-4 font-bold text-xs shadow-lg animate-bounce flex items-center justify-center gap-1.5 border border-brand-red">
                        <Phone className="w-3.5 h-3.5 fill-white" />
                        <span>Précommander sur WhatsApp</span>
                      </div>
                    ) : (
                      <div className="bg-black/50 text-slate-300 backdrop-blur-md rounded-xl py-2 px-3 text-[9px] flex items-center justify-center gap-1.5 border border-zinc-800">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-red" />
                        <span>BLACK MARKET CO_</span>
                      </div>
                    )}
                    <p className="text-[7px] text-zinc-500 tracking-widest uppercase font-mono">FILIGRANÉ SECURISÉ : [BLACK MARKET] ORIGINAL</p>
                  </div>
                </div>

                {/* Animated Simulated Equalizer wave when music is unmuted */}
                {videoPlaying && !isMuted && (
                  <div className="absolute bottom-2 right-2 flex items-end gap-0.5 h-6 opacity-60">
                    <span className="w-0.5 h-3 bg-brand-red rounded animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <span className="w-0.5 h-5 bg-white rounded animate-bounce" style={{ animationDelay: "0.4s" }} />
                    <span className="w-0.5 h-2 bg-brand-red rounded animate-bounce" style={{ animationDelay: "0.2s" }} />
                    <span className="w-0.5 h-4 bg-white rounded animate-bounce" style={{ animationDelay: "0.6s" }} />
                  </div>
                )}
              </div>

              {/* Right Column: Templates & Video Controls Panel */}
              <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-brand-red/20 text-brand-red text-[9px] font-bold px-2.5 py-1 rounded border border-brand-red/30 uppercase font-mono">
                        Modèle de Diaporama Vidéo
                      </span>
                      <h4 className="text-xl font-bold text-slate-100 mt-2 font-sans uppercase">Générateur d'Annonces BLACK MARKET</h4>
                      <p className="text-zinc-400 text-xs">
                        Ce lecteur interactif prévisualise le modèle d'annonce vidéo automatique avec le filigrane officiel requis par le cahier des charges.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveVideoProduct(null)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-slate-400 hover:text-white p-1.5 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Live Controls */}
                  <div className="bg-black/60 border border-zinc-800 rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setVideoPlaying(!videoPlaying)}
                        className={`p-3 rounded-full text-white transition-all ${videoPlaying ? "bg-amber-600" : "bg-brand-red"}`}
                      >
                        {videoPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                      </button>
                      <button
                        onClick={() => setCurrentSlideIndex(0)}
                        className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-full text-slate-300"
                        title="Recommencer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Audio Synth toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`p-2 rounded-lg flex items-center gap-2 text-xs font-semibold font-mono ${!isMuted ? "bg-brand-red/20 text-brand-red border border-brand-red/20" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        <span>SON SYNTHÉ {isMuted ? "OFF" : "ON"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Explanation of No-Code/API Video integration requested */}
                  <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-zinc-900 text-xs text-zinc-300 leading-relaxed">
                    <p className="font-bold text-slate-100 text-xs font-mono">🛠️ Comment appliquer le filigrane "BLACK MARKET" de façon automatisée ?</p>
                    <p>
                      Pour injecter de façon dynamique le filigrane sur toutes les photos et vidéos générées via Make.com, vous avez deux solutions :
                    </p>
                    <ul className="space-y-1.5 list-disc pl-4 mt-1 text-zinc-400">
                      <li>
                        <strong className="text-zinc-200 font-mono">Dans Creatomate (Vidéo)</strong> : Ajoutez une couche statique de texte ou d'image semi-transparente "BLACK MARKET" à un angle ou au centre de votre modèle de diaporama. Ainsi, chaque rendu MP4 généré aura nativement le filigrane indélébile.
                      </li>
                      <li>
                        <strong className="text-zinc-200 font-mono">Dans Bannerbear (Image)</strong> : Superposez un calque de filigrane translucide au-dessus de la photo d'origine récupérée du Sheets.
                      </li>
                      <li>
                        <strong className="text-zinc-200 font-mono">CSS overlay (Client-side)</strong> : Utilisez notre méthode d'incrustation CSS (déjà programmée ci-contre) pour protéger vos images en ligne contre le vol de fiches.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-zinc-800 text-zinc-400 text-[10px] font-mono">
                  <span>PROD : {activeVideoProduct.title.toUpperCase()}</span>
                  <button
                    onClick={() => setActiveVideoProduct(null)}
                    className="bg-brand-red hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors"
                  >
                    Fermer l'aperçu
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL: PRODUCT DETAILS POPUP ----------------- */}
      <AnimatePresence>
        {selectedProductForDetails && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-brand-card rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-brand-red/30 text-slate-200 my-8 flex flex-col"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-black via-brand-card to-black px-6 py-4 flex items-center justify-between border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-red animate-ping" />
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">FICHE PRODUIT CLIENT</span>
                </div>
                <h3 className="text-sm font-extrabold text-brand-red font-mono tracking-widest uppercase">
                  BLACK MARKET PROFILE
                </h3>
                <button
                  onClick={() => setSelectedProductForDetails(null)}
                  className="bg-zinc-900 hover:bg-brand-red/20 text-zinc-400 hover:text-brand-red p-1.5 rounded-full transition-all border border-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto max-h-[75vh] grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left side: Image & watermark overlay */}
                <div className="space-y-4">
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center group">
                    <img
                      src={selectedProductForDetails.imageUrl}
                      alt={selectedProductForDetails.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />

                    {/* Watermark overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-30">
                      <span className="text-white font-extrabold text-4xl font-mono border-4 border-white/50 px-6 py-3 rotate-12 tracking-widest uppercase">
                        BLACK MARKET
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 bg-black/95 border border-brand-red/40 px-3 py-1.5 rounded-xl">
                      <p className="text-[10px] text-zinc-400 font-mono font-bold">ID DU LOT : #{selectedProductForDetails.id}</p>
                    </div>
                  </div>

                  {/* Sourcing details if available */}
                  {selectedProductForDetails.sourceRmb && (
                    <div className="bg-black/40 border border-zinc-900 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-mono uppercase">COÛT USINE CHINE</span>
                        <span className="text-xs text-yellow-500 font-mono font-bold">¥ {selectedProductForDetails.sourceRmb} RMB</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                        <span>TRANSACTION SECURISEE</span>
                        <span className="text-brand-red font-bold">ALIPAY / WECHAT PAY</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side: Detailed Information */}
                <div className="space-y-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Category & Title */}
                    <div>
                      <span className="inline-block bg-brand-red/10 text-brand-red text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-brand-red/20 mb-2">
                        {selectedProductForDetails.category}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 leading-tight">
                        {selectedProductForDetails.title}
                      </h2>
                      {selectedProductForDetails.chineseTitle && (
                        <p className="text-xs text-zinc-500 font-mono mt-1 flex items-center gap-1.5">
                          <span className="text-brand-red">中</span> 供应商 : {selectedProductForDetails.chineseTitle}
                        </p>
                      )}
                    </div>

                    {/* Price Section */}
                    <div className="bg-gradient-to-r from-brand-red/10 to-transparent p-4 rounded-2xl border-l-4 border-brand-red">
                      <p className="text-[9px] text-zinc-400 uppercase font-mono tracking-widest font-bold">PRIX DE VENTE SPECIAL BLACK MARKET</p>
                      <p className="text-2xl font-extrabold text-brand-red">
                        <span className="text-slate-100 font-sans">
                          {config.currency === "EUR"
                            ? `${selectedProductForDetails.priceEur} €`
                            : `${selectedProductForDetails.priceXof.toLocaleString("fr-FR")} F CFA`}
                        </span>
                      </p>
                    </div>

                    {/* Main Description */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-brand-red font-mono uppercase tracking-widest font-bold">DESCRIPTION & ARGUMENTAIRE</p>
                      <p className="text-sm text-zinc-300 leading-relaxed bg-black/30 p-4 rounded-xl border border-zinc-900 font-sans">
                        {selectedProductForDetails.description}
                      </p>
                    </div>

                    {/* Tech specs (Features) */}
                    {selectedProductForDetails.features && selectedProductForDetails.features.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-brand-red font-mono uppercase tracking-widest font-bold">Fiche Technique & Caractéristiques :</p>
                        <div className="bg-black/50 border border-zinc-900 rounded-xl p-3 grid grid-cols-1 gap-2">
                          {selectedProductForDetails.features.map((feat, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-zinc-400">
                              <span className="text-brand-red font-bold mt-0.5">▪</span>
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chinese descriptions if exists */}
                    {selectedProductForDetails.chineseDescription && (
                      <div className="space-y-1">
                        <details className="text-xs text-zinc-500 border border-zinc-900/60 rounded-xl p-2 bg-black/10 cursor-pointer">
                          <summary className="font-mono text-[9px] text-zinc-500 uppercase hover:text-zinc-400">Voir la description originale en chinois</summary>
                          <p className="mt-2 text-zinc-600 font-serif leading-relaxed px-1">
                            {selectedProductForDetails.chineseDescription}
                          </p>
                        </details>
                      </div>
                    )}

                    {/* Manual Sync Button with Webhook */}
                    <div className="pt-2">
                      <button
                        onClick={async () => {
                          const isWebhookConfigured = config.makeWebhookUrl && 
                                                      config.makeWebhookUrl.trim() !== "" && 
                                                      !config.makeWebhookUrl.includes("xxxxxxxxxxxxxxxxxxxxxxxx");
                          if (!isWebhookConfigured) {
                            alert(`⚠️ URL Webhook non configurée.\n\nVeuillez d'abord renseigner votre véritable URL de Webhook Make.com dans le champ "WEBHOOK MAKE" situé tout en haut de la console d'administration !`);
                            return;
                          }

                          try {
                            const response = await fetch(config.makeWebhookUrl, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(selectedProductForDetails),
                              mode: "cors"
                            });

                            if (response.ok) {
                              alert(`✅ Produit "${selectedProductForDetails.title}" envoyé avec succès à votre Google Sheet via Make.com !`);
                            } else {
                              alert(`⚠️ Réponse du Webhook : Statut ${response.status}. Veuillez vérifier votre scénario Make.com.`);
                            }
                          } catch (err: any) {
                            console.error(err);
                            // Fallback to no-cors mode
                            try {
                              await fetch(config.makeWebhookUrl, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(selectedProductForDetails),
                                mode: "no-cors"
                              });
                              alert(`✅ Requête d'envoi transmise au Webhook (mode no-cors de secours).`);
                            } catch (subErr) {
                              alert(`❌ Erreur d'envoi au webhook : ${err.message || err}`);
                            }
                          }
                        }}
                        className="w-full bg-[#12121a] hover:bg-zinc-800 text-slate-300 border border-zinc-800 rounded-xl py-2 px-4 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all hover:border-brand-red/30"
                      >
                        <Database className="w-3.5 h-3.5 text-brand-red animate-pulse" />
                        <span>SYNCHRONISER VERS GOOGLE SHEET (MAKE)</span>
                      </button>
                    </div>
                  </div>

                  {/* Order CTA & close button */}
                  <div className="pt-4 border-t border-zinc-900 flex gap-3 mt-auto">
                    <button
                      onClick={() => {
                        setSelectedProductForDetails(null);
                        setSelectedProductForWa(selectedProductForDetails);
                      }}
                      className="flex-1 bg-brand-red hover:bg-red-600 text-white font-extrabold text-sm py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-brand-red/10 border border-brand-red/30"
                    >
                      <Phone className="w-4 h-4 fill-white" />
                      <span>Précommander sur WhatsApp</span>
                    </button>
                    {onUpdateProduct && (
                      <button
                        onClick={() => {
                          setEditingProduct(selectedProductForDetails);
                          setSelectedProductForDetails(null);
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-bold text-xs px-4 rounded-xl transition-all border border-zinc-700/50 flex items-center gap-1.5"
                        title="Modifier la fiche"
                      >
                        <Pencil className="w-3.5 h-3.5 text-brand-red" />
                        <span className="hidden sm:inline">Modifier</span>
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedProductForDetails(null)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-bold text-xs px-5 rounded-xl transition-all border border-zinc-700/50"
                    >
                      Retour
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MODAL: WYSIWYG PRODUCT EDITOR ----------------- */}
      {editingProduct && onUpdateProduct && (
        <ProductEditor
          product={editingProduct}
          categories={categories}
          onClose={() => setEditingProduct(null)}
          onSave={onUpdateProduct}
          onDelete={onDeleteProduct!}
        />
      )}
    </div>
  );
}
