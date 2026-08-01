// Self-contained public client template (GitHub Pages compatible).
// Loads ./catalog.json (written by the Make.com webhook flow) and falls back
// to embedded demo data when the file is absent.
import { GOOGLE_CLIENT_ID } from "./constants";

export function getHtmlTemplateCode(opts?: { siteUrl?: string }): string {
  const siteUrl = (opts && opts.siteUrl) || "https://blackmarket-import-export.netlify.app/";
  const ogImage = siteUrl + "img/brand.jpg";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BLACK MARKET - SOURCING EXCLUSIF CHINE</title>

  <!-- SEO Optimization -->
  <meta name="description" content="BLACK MARKET - SOURCING EXCLUSIF CHINE. Découvrez notre catalogue exclusif de produits tendance importés directement d'usines chinoises (Taobao, 1688) avec prix d'usine, précommande WhatsApp et livraison sécurisée.">
  <meta name="keywords" content="sourcing chine, import chine, streetwear coréen, techwear, black market, grossiste chine, précommande chine, taobao, 1688, aliexpress, make webhook">
  <meta name="robots" content="index, follow">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${siteUrl}">
  <meta property="og:title" content="BLACK MARKET - SOURCING EXCLUSIF CHINE">
  <meta property="og:description" content="Découvrez nos drops de sourcing exclusifs depuis la Chine (Taobao, 1688). Commandez directement d'usine via WhatsApp en toute sécurité.">
  <meta property="og:image" content="${ogImage}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:title" content="BLACK MARKET - SOURCING EXCLUSIF CHINE">
  <meta property="twitter:description" content="Découvrez nos drops de sourcing exclusifs depuis la Chine. Commandez directement d'usine via WhatsApp.">
  <meta property="twitter:image" content="${ogImage}">

  <!-- Favicon Logo (White Flame in Red rounded box) -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='32' height='32'%3E%3Crect width='24' height='24' rx='6' fill='%23ff2a2a'/%3E%3Cpath d='M12 2C12 2 15 5.5 15 8.5C15 11.5 12 14 12 14C12 14 9 11.5 9 8.5C9 5.5 12 2 12 2Z' fill='white'/%3E%3Cpath d='M12 6C12 6 13.5 8.5 13.5 10.5C13.5 12.5 12 14 12 14C12 14 10.5 12.5 10.5 10.5C10.5 8.5 12 6 12 6Z' fill='%23ffbfbf'/%3E%3C/svg%3E" />

  <!-- Tailwind CSS Play CDN -->
  <link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin>
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts: Quicksand (Rounded Style) & Share Tech Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700;800&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <!-- Google Identity Services (Sign in with Google) -->
  <script src="https://accounts.google.com/gsi/client"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Quicksand', 'sans-serif'],
            mono: ['Share Tech Mono', 'monospace'],
          },
          colors: {
            brand: { red: '#ff2a2a', dark: '#08080c', card: '#15151e' }
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #08080c; color: #f3f4f6; }
    .scrollbar-none::-webkit-scrollbar { display: none; }
    .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
<body class="min-h-screen flex flex-col font-sans">

  <!-- Header -->
  <header class="bg-[#0d0d14] border-b border-brand-red/30 py-4 shadow-md sticky top-0 z-30">
    <div class="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
      <div class="flex items-center gap-2">
        <span class="text-xl font-black tracking-widest text-white font-mono">BLACK MARKET</span>
        <span class="text-[9px] bg-brand-red/20 text-brand-red px-1.5 py-0.5 rounded border border-brand-red/35 font-mono font-bold">K-STREET</span>
      </div>
      <div class="flex items-center gap-2">
        <a id="dash-btn" href="/admin" class="hidden bg-[#ff2a2a] hover:bg-red-600 text-white text-xs px-4 py-2 rounded-xl font-bold font-mono transition-all shadow-md shadow-brand-red/10">🛠 DASHBOARD ADMIN</a>
        <button id="logout-btn" class="hidden text-zinc-400 hover:text-brand-red text-xs px-3 py-2 rounded-xl font-bold font-mono border border-zinc-800 hover:border-brand-red/40 transition-all cursor-pointer" aria-label="Déconnexion">DÉCONNEXION</button>
        <button id="login-btn" class="text-zinc-400 hover:text-brand-red text-xs px-3 py-2 rounded-xl font-bold font-mono border border-zinc-800 hover:border-brand-red/40 transition-all cursor-pointer">◆ CONNEXION</button>
        <a id="wa-link" href="https://wa.me/237683963007" target="_blank" rel="noopener noreferrer" class="bg-brand-red hover:bg-red-600 text-white text-xs px-4 py-2 rounded-xl font-bold font-mono transition-all">
          💬 WHATSAPP DIRECT
        </a>
      </div>
    </div>
  </header>

  <!-- Marquee Header -->
  <div class="bg-black py-1.5 border-b border-brand-red/20 overflow-hidden relative">
    <div class="whitespace-nowrap flex text-[10px] font-mono tracking-widest text-brand-red uppercase">
      <span class="px-4">● DROP DE SOURCING CHINOIS EN COURS (TAOBAO & 1688) ● EXCLUSIVITÉS BLACK MARKET ● FILIGRANE INCRUSTÉ DE SÉCURITÉ</span>
    </div>
  </div>

  <!-- Content -->
  <main class="max-w-6xl mx-auto px-4 py-8 flex-1 space-y-6">
    <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
      <span class="text-xs font-bold text-zinc-500 font-mono">CATALOGUE DE PRÉCOMMANDE</span>
      <span id="counter" class="bg-brand-red/10 text-brand-red border border-brand-red/35 text-[10px] px-2 py-0.5 rounded font-mono font-bold">Chargement...</span>
    </div>

    <!-- Barre de recherche -->
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>
      <input type="text" id="search-input" oninput="handleSearch(event)" placeholder="Rechercher un drop (ex: masque, veste...)" class="w-full bg-[#12121a] text-xs text-slate-100 pl-10 pr-4 py-3 rounded-2xl border border-zinc-800 focus:outline-none focus:border-brand-red/60 placeholder-zinc-500 font-mono transition-all">
    </div>

    <!-- Navigation par Catégories -->
    <div class="pb-2 border-b border-zinc-900/60 overflow-x-auto scrollbar-none">
      <div id="category-tabs" class="flex flex-wrap gap-2 py-1"></div>
    </div>

    <!-- Target Grid -->
    <div id="grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
  </main>

  <!-- Modal Popup for Product Details -->
  <div id="details-modal" class="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-50 hidden overflow-y-auto">
    <div class="bg-[#15151e] rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-brand-red/30 text-slate-200 flex flex-col my-8">
      <div class="bg-gradient-to-r from-black via-[#15151e] to-black px-6 py-4 flex items-center justify-between border-b border-zinc-800">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-[#ff2a2a] animate-ping"></span>
          <span class="text-xs font-mono text-zinc-500 uppercase tracking-widest">FICHE PRODUIT EXCLUSIVE</span>
        </div>
        <h3 class="text-sm font-extrabold text-brand-red font-mono tracking-widest uppercase">BLACK MARKET</h3>
        <button onclick="closeDetailsModal()" class="bg-zinc-900 hover:bg-brand-red/20 text-zinc-400 hover:text-brand-red p-1.5 rounded-full transition-all border border-zinc-800" aria-label="Fermer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div class="p-6 overflow-y-auto max-h-[75vh] grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="relative aspect-square rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center">
          <img id="modal-image" src="" alt="" crossorigin="anonymous" onload="watermarkImage(this)" class="w-full h-full object-cover">
        </div>

        <div class="space-y-4 flex flex-col justify-between">
          <div class="space-y-3">
            <div>
              <span id="modal-category" class="inline-block bg-brand-red/10 text-brand-red text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded border border-brand-red/25 mb-1.5"></span>
              <h2 id="modal-title" class="text-lg sm:text-xl font-extrabold text-slate-100 leading-snug"></h2>
            </div>
            <div class="bg-gradient-to-r from-brand-red/10 to-transparent p-3 rounded-xl border-l-4 border-brand-red">
              <p class="text-[8px] text-zinc-400 uppercase font-mono font-bold tracking-widest">PRIX DE VENTE SPECIAL</p>
              <p id="modal-price" class="text-xl font-extrabold text-brand-red font-mono"></p>
            </div>
            <div class="space-y-1">
              <p class="text-[9px] text-brand-red font-mono uppercase font-bold tracking-wider">DESCRIPTION & SPECIFICATIONS</p>
              <div id="modal-description" class="text-xs text-zinc-300 leading-relaxed bg-black/40 p-3 rounded-lg border border-zinc-900 max-h-[150px] overflow-y-auto space-y-2"></div>
            </div>
          </div>

          <div class="pt-3 border-t border-zinc-900 flex gap-2">
            <a id="modal-wa-btn" href="" target="_blank" rel="noopener noreferrer" class="flex-1 bg-brand-red hover:bg-red-600 text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-brand-red/10 font-mono text-center">
              💬 PRÉCOMMANDER VIA WHATSAPP
            </a>
            <button onclick="closeDetailsModal()" class="bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-bold text-xs px-4 rounded-xl transition-all border border-zinc-700/50">Retour</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="bg-black py-6 text-center border-t border-zinc-900 text-xs text-zinc-600 font-mono">
    <p>© 2026 BLACK MARKET CO. ALL VISUALS SECURED UNDER AUTOMATIC WATERMARK</p>
  </footer>

  <!-- Login Modal (Google) -->
  <div id="login-modal" class="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[70] hidden">
    <div class="w-full max-w-sm bg-[#15151e] rounded-3xl p-6 border border-brand-red/30 text-slate-200 shadow-2xl relative">
      <button onclick="closeLoginModal()" class="absolute top-3 right-3 bg-zinc-900 hover:bg-brand-red/20 text-zinc-400 hover:text-brand-red p-1.5 rounded-full transition-all border border-zinc-800" aria-label="Fermer">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
      <div class="text-center mb-5">
        <h3 class="text-sm font-extrabold text-brand-red font-mono tracking-widest uppercase">ESPACE RÉSERVÉ</h3>
        <p class="text-[10px] text-zinc-500 font-mono mt-1">CONNECTEZ-VOUS AVEC VOTRE EMAIL ADMIN</p>
      </div>
      <div class="flex flex-col items-center gap-3">
        <div id="g-signin"></div>
        <p id="login-error" class="hidden text-[11px] text-red-400 font-mono text-center"></p>
      </div>
    </div>
  </div>

  <script>
    // Config boutique No-Code
    const CONFIG = { phoneNumber: "237683963007", currency: "XOF" /* ou EUR */ };

    // URL de base du site (utilisee pour les liens produits partages)
    var SITE_URL = location.href.split("#")[0];

    // ===== FILIGRANE INCRUSTE DANS L'IMAGE (canvas) =====
    function watermarkImage(img) {
      if (!img || img.dataset.wm === "1") return;
      img.dataset.wm = "1";
      var src = img.getAttribute("src") || img.src;
      if (!src || src.indexOf("data:") === 0) return;
      if (src.indexOf("/img/") !== -1 || src.indexOf("img/") === 0) return; // déjà filigrané côté serveur
      var raw = new Image();
      raw.crossOrigin = "anonymous";
      raw.onload = function () {
        try {
          var w = raw.naturalWidth || 600;
          var h = raw.naturalHeight || 400;
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(raw, 0, 0, w, h);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.rotate(-Math.PI / 6);
          var fs = Math.max(16, Math.round(w * 0.055));
          ctx.font = "bold " + fs + "px monospace";
          ctx.fillStyle = "rgba(255,255,255,0.30)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0,0,0,0.75)";
          ctx.shadowBlur = 5;
          var text = "BLACK MARKET © 2026";
          var spacing = Math.round(h * 0.30);
          var step = Math.round(w * 0.75);
          for (var dy = -h; dy <= h; dy += spacing) {
            for (var dx = -w; dx <= w; dx += step) {
              ctx.fillText(text, dx, dy);
            }
          }
          ctx.restore();
          img.src = canvas.toDataURL("image/jpeg", 0.85);
        } catch (e) {
          // Canvas tainted (source externe) : on garde l'image d'origine
        }
      };
      raw.onerror = function () {};
      raw.src = src;
    }

    // Fallback to the original (remote) image when the local watermarked copy is missing.
    // Reads the URL from a data-attribute (no inline JS string interpolation => no XSS).
    function handleImgError(img) {
      if (img.dataset.fbDone === "1") return;
      img.dataset.fbDone = "1";
      var fb = img.getAttribute("data-fallback");
      if (!fb) return;
      img.src = fb;
      img.crossOrigin = "anonymous";
      watermarkImage(img);
    }

    // Fallback embedded data (used only si catalog.json indisponible)
    const FALLBACK_PRODUCTS = [
      { id: "1", title: "Masque Cyberpunk LED avec Affichage Interactif", description: "Le summum du style Techwear urbain coréen ! Écran LED contrôlable par application, matériaux robustes, idéal pour compléter vos tenues techno-futuristes.", priceEur: 69, priceXof: 45000, imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=600", category: "Techwear" },
      { id: "2", title: "Veste Coupe-Wind Tactique Imperméable K-Street", description: "Affrontez la ville avec un style streetwear authentique. Textile technique déperlant, coupe-vent et anti-abrasion, nombreuses poches tactiques.", priceEur: 55, priceXof: 36000, imageUrl: "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&q=80&w=600", category: "Streetwear" }
    ];

    // ===== XSS PROTECTION =====
    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    let PRODUCTS = FALLBACK_PRODUCTS;

    // ===== SYNC DEPUIS catalog.json (écrit par le webhook Make.com) =====
    async function loadCatalog() {
      try {
        const res = await fetch("./catalog.json", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) PRODUCTS = data;
        }
      } catch (e) {
        // Réseau hors ligne -> fallback local
      }
      initApp();
    }

    document.getElementById("wa-link").href = "https://wa.me/" + CONFIG.phoneNumber;

    let selectedCategory = "Tous";
    let searchQuery = "";

    function renderCategories() {
      const container = document.getElementById("category-tabs");
      if (!container) return;
      const uniqueCats = ["Tous", ...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
      container.innerHTML = uniqueCats.map(cat => {
        const isActive = cat === selectedCategory;
        const base = isActive
          ? "bg-[#ff2a2a] text-white border border-[#ff2a2a]"
          : "bg-[#15151e] text-zinc-400 border border-zinc-800 hover:border-brand-red/40 hover:text-slate-100";
        // JSON.stringify produces a JS-safe string literal (correct escaping for
        // the onclick handler). escapeHtml alone is NOT enough here because the
        // HTML parser decodes &#39; back to ' inside the attribute.
        const jsCat = JSON.stringify(cat);
        return '<button onclick="filterCategory(' + jsCat + ')" class="' + base + ' text-[10px] px-4 py-1.5 rounded-full font-extrabold font-mono transition-all uppercase tracking-widest">' + escapeHtml(cat) + "</button>";
      }).join("");
    }

    function filterCategory(category) {
      selectedCategory = category;
      renderCategories();
      applyFilters();
    }

    function handleSearch(event) {
      searchQuery = event.target.value.toLowerCase();
      applyFilters();
    }

    function applyFilters() {
      const filtered = PRODUCTS.filter(p => {
        const matchesCategory = selectedCategory === "Tous" || p.category === selectedCategory;
        const matchesSearch =
          (p.title || "").toLowerCase().indexOf(searchQuery) !== -1 ||
          (p.description || "").toLowerCase().indexOf(searchQuery) !== -1 ||
          ((p.category || "")).toLowerCase().indexOf(searchQuery) !== -1;
        return matchesCategory && matchesSearch;
      });
      renderGrid(filtered);
    }

    // ===== MESSAGE WHATSAPP POLI & STRUCTURÉ (partagé) =====
    function buildWaMessage(product, priceStr, productUrl) {
      return "Bonjour BLACK MARKET, 👋\n\n" +
        "Je souhaite passer une PRÉCOMMANDE pour le produit suivant :\n\n" +
        "  📦 PRODUIT : " + String(product.title || "").toUpperCase() + "\n" +
        "  💰 PRIX : " + priceStr + "\n" +
        "  🔗 FICHE PRODUIT : " + productUrl + "\n\n" +
        "Merci de me confirmer la disponibilité, le délai de livraison et les modalités de paiement.\n\n" +
        "Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées.";
    }

    // ===== DESCRIPTION PARAGRAPHEE (formatée pour la lecture) =====
    function paragraphizeDescription(text) {
      var raw = String(text || "");
      var lines = raw.split(/\n{2,}/);
      if (lines.length <= 1) lines = raw.split(/\n/).filter(Boolean);
      return lines
        .map(function (block) {
          return '<p class="text-xs text-zinc-300 leading-relaxed indent-4">' + escapeHtml(block.trim()) + "</p>";
        })
        .join("");
    }

    function renderGrid(itemsToRender) {
      let filterText = String(selectedCategory).toUpperCase();
      if (searchQuery) filterText += " & RECHERCHE";
      document.getElementById("counter").innerText = itemsToRender.length + " DROPS DISPONIBLES (" + filterText + ")";
      const grid = document.getElementById("grid");
      grid.innerHTML = "";

      if (itemsToRender.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-12 text-center text-zinc-500 font-mono text-xs">AUCUN DROP POUR LE MOMENT</div>';
        return;
      }

      itemsToRender.forEach(p => {
        const priceStr = CONFIG.currency === "EUR"
          ? escapeHtml(p.priceEur) + " €"
          : Number(p.priceXof || 0).toLocaleString("fr-FR") + " F CFA";
        const masterIndex = PRODUCTS.findIndex(orig => orig.id === p.id);
        const localImg = "img/" + encodeURIComponent(p.id) + ".jpg";
        const productUrl = SITE_URL + "p/" + p.id + ".html";
        const message = buildWaMessage(p, priceStr, productUrl);
        const waUrl = "https://wa.me/" + CONFIG.phoneNumber + "?text=" + encodeURIComponent(message);
        const paragraphs = paragraphizeDescription(p.description);

        grid.innerHTML +=
            '<div onclick="openDetailsModal(' + masterIndex + ')" class="bg-brand-card rounded-3xl overflow-hidden border border-zinc-800 flex flex-col h-full relative group hover:border-brand-red/40 transition-all duration-300 cursor-pointer">' +
              '<div class="relative aspect-video overflow-hidden">' +
                '<img src="' + escapeHtml(localImg) + '" alt="' + escapeHtml(p.title) + '" loading="lazy" crossorigin="anonymous" data-fallback="' + escapeHtml(p.imageUrl) + '" onerror="handleImgError(this)" class="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500">' +
                '<span class="absolute top-3 left-3 bg-brand-red text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded">' + escapeHtml(p.category || "EXCLUSIF") + "</span>" +
              "</div>" +
            '<div class="p-6 flex flex-col flex-1 justify-between gap-4">' +
              '<div class="space-y-1.5">' +
                '<h3 class="font-extrabold text-sm text-slate-100 group-hover:text-brand-red transition-colors">' + escapeHtml(p.title) + "</h3>" +
                '<div class="text-xs text-zinc-400 leading-relaxed line-clamp-3">' + escapeHtml(p.description) + "</div>" +
              "</div>" +
              '<div class="flex items-center justify-between pt-2 border-t border-zinc-900">' +
                '<div class="flex flex-col"><span class="text-[8px] text-zinc-500 font-mono">PRIX FACTORY</span><span class="font-extrabold text-slate-100 text-sm font-mono">' + priceStr + "</span></div>" +
                '<a href="' + waUrl + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" class="bg-brand-red text-white font-bold text-[11px] px-3.5 py-2 rounded-xl transition-all font-mono">PRÉCOMMANDER</a>' +
              "</div>" +
            "</div>" +
          "</div>";
      });
    }

    function openDetailsModal(index) {
      const p = PRODUCTS[index];
      if (!p) return;
      const priceStr = CONFIG.currency === "EUR"
        ? escapeHtml(p.priceEur) + " €"
        : Number(p.priceXof || 0).toLocaleString("fr-FR") + " F CFA";
      const productUrl = SITE_URL + "p/" + p.id + ".html";
      const message = buildWaMessage(p, priceStr, productUrl);
      const waUrl = "https://wa.me/" + CONFIG.phoneNumber + "?text=" + encodeURIComponent(message);

      var modalImg = document.getElementById("modal-image");
      delete modalImg.dataset.wm;
      modalImg.onerror = function () {
        modalImg.onerror = null;
        modalImg.src = p.imageUrl;
        modalImg.crossOrigin = "anonymous";
        watermarkImage(modalImg);
      };
      modalImg.src = "img/" + encodeURIComponent(p.id) + ".jpg";
      document.getElementById("modal-category").innerText = p.category || "EXCLUSIF";
      document.getElementById("modal-title").innerText = p.title;
      document.getElementById("modal-price").innerText = priceStr;
      document.getElementById("modal-description").innerHTML = paragraphizeDescription(p.description);
      document.getElementById("modal-wa-btn").href = waUrl;

      if (history.replaceState) history.replaceState(null, "", "#" + p.id);
      const modal = document.getElementById("details-modal");
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      document.body.style.overflow = "hidden";
    }

    function closeDetailsModal() {
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
      const modal = document.getElementById("details-modal");
      modal.classList.remove("flex");
      modal.classList.add("hidden");
      document.body.style.overflow = "";
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDetailsModal();
    });

    // Ouvre la fiche produit si l'URL contient un #id (lien partage)
    function handleDeepLink() {
      var id = location.hash.replace("#", "");
      if (!id) return;
      for (var i = 0; i < PRODUCTS.length; i++) {
        if (PRODUCTS[i].id === id) {
          openDetailsModal(i);
          return;
        }
      }
    }

    function initApp() {
      renderCategories();
      renderGrid(PRODUCTS);
      handleDeepLink();
    }

    loadCatalog();

    // ===== ACCÈS ADMINISTRATEUR (login via Google) =====
    var GOOGLE_CLIENT_ID = "${GOOGLE_CLIENT_ID}";
    var loginModal = document.getElementById("login-modal");
    var gRendered = false;

    function openLoginModal() {
      if (!loginModal) return;
      loginModal.classList.remove("hidden");
      loginModal.classList.add("flex");
      if (!gRendered) renderGoogleButton();
    }
    function closeLoginModal() {
      if (loginModal) {
        loginModal.classList.add("hidden");
        loginModal.classList.remove("flex");
      }
    }
    function showDashboard() {
      var btn = document.getElementById("dash-btn");
      if (btn) btn.classList.remove("hidden");
      var loginBtn = document.getElementById("login-btn");
      if (loginBtn) loginBtn.classList.add("hidden");
      var outBtn = document.getElementById("logout-btn");
      if (outBtn) outBtn.classList.remove("hidden");
    }
    function logoutAdmin() {
      var token = "";
      try {
        token = sessionStorage.getItem("bm_admin_token") || "";
        sessionStorage.removeItem("bm_admin_token");
        sessionStorage.removeItem("admin_authenticated");
        sessionStorage.removeItem("bm_admin_email");
      } catch (e2) {}
      if (token) {
        fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
        }).catch(function () {});
      }
      var btn = document.getElementById("dash-btn");
      if (btn) btn.classList.add("hidden");
      var outBtn = document.getElementById("logout-btn");
      if (outBtn) outBtn.classList.add("hidden");
      var loginBtn = document.getElementById("login-btn");
      if (loginBtn) loginBtn.classList.remove("hidden");
    }
    function renderGoogleButton() {
      if (typeof google === "undefined" || !google.accounts) return;
      gRendered = true;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: false,
        callback: function (resp) {
          if (resp && resp.credential) handleGoogleCredential(resp.credential);
        },
      });
      google.accounts.id.renderButton(document.getElementById("g-signin"), {
        theme: "outline",
        size: "large",
        shape: "pill",
        width: 280,
        text: "continue_with",
      });
    }
    function handleGoogleCredential(credential) {
      var errEl = document.getElementById("login-error");
      fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credential }),
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (r) {
          if (r.ok && r.data.token) {
            try {
              sessionStorage.setItem("bm_admin_token", r.data.token);
              sessionStorage.setItem("admin_authenticated", "true");
              sessionStorage.setItem("bm_admin_email", r.data.email || "");
            } catch (e2) {}
            closeLoginModal();
            showDashboard();
          } else {
            errEl.textContent = r.data.error || "Accès refusé.";
            errEl.classList.remove("hidden");
          }
        })
        .catch(function () {
          errEl.textContent = "Erreur réseau. Réessayez.";
          errEl.classList.remove("hidden");
        });
    }

    var loginBtn = document.getElementById("login-btn");
    if (loginBtn) loginBtn.addEventListener("click", openLoginModal);
    var logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", logoutAdmin);
    if (loginModal) {
      loginModal.addEventListener("click", function (ev) {
        if (ev.target === loginModal) closeLoginModal();
      });
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && !loginModal.classList.contains("hidden")) closeLoginModal();
      });
    }
    // Déjà connecté (session en cours) -> bouton Dashboard visible
    try {
      if (sessionStorage.getItem("bm_admin_token")) showDashboard();
    } catch (e2) {}
  </script>
</body>
</html>`;
}
