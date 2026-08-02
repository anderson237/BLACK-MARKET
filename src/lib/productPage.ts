import { Product } from "../types";

function escapeHtml(value: string | undefined | null): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function getProductPageHtml(p: Product, baseUrl: string, phoneNumber: string, opts?: { ogImage?: string }): string {
  const pageUrl = baseUrl + "p/" + p.id + ".html";
  const imgUrl = baseUrl + "img/" + p.id + ".jpg";
  const ogImage = (opts && opts.ogImage) || imgUrl;
  const title = escapeHtml(p.title);
  const descriptionMeta = escapeHtml(p.description);
  const category = escapeHtml(p.category || "EXCLUSIF");
  const priceXof = Number(p.priceXof || 0).toLocaleString("fr-FR");
  const priceEur = escapeHtml(String(p.priceEur ?? ""));
  const features = (p.features || [])
    .map((f) => `            <li class="flex items-start gap-2"><span class="text-brand-red mt-0.5">◆</span><span>${escapeHtml(f)}</span></li>`)
    .join("\n");
  const descriptionBlocks = String(p.description || "")
    .split(/\n{2,}/)
    .map((b) => `<p class="text-xs text-zinc-300 leading-relaxed indent-4">${escapeHtml(b.trim())}</p>`)
    .join("\n              ");
  const message =
    "Bonjour BLACK MARKET, 👋\n\n" +
    "Je souhaite passer une PRÉCOMMANDE pour le produit suivant :\n\n" +
    "  📦 PRODUIT : " + String(p.title || "").toUpperCase() + "\n" +
    "  💰 PRIX : " + priceXof + " F CFA" + (p.priceEur ? " (≈ " + p.priceEur + " €)" : "") + "\n" +
    "  🔗 FICHE PRODUIT : " + pageUrl + "\n\n" +
    "Merci de me confirmer la disponibilité, le délai de livraison et les modalités de paiement.\n\n" +
    "Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées.";
  const waUrl = "https://wa.me/" + phoneNumber.replace(/\+/g, "").replace(/\s/g, "") + "?text=" + encodeURIComponent(message);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - BLACK MARKET</title>
  <meta name="description" content="${descriptionMeta}">
  <meta property="og:type" content="product">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${descriptionMeta}">
  <meta property="og:image" content="${ogImage}">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:image" content="${ogImage}">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='32' height='32'%3E%3Crect width='24' height='24' rx='6' fill='%23ff2a2a'/%3E%3Cpath d='M12 2C12 2 15 5.5 15 8.5C15 11.5 12 14 12 14C12 14 9 11.5 9 8.5C9 5.5 12 2 12 2Z' fill='white'/%3E%3C/svg%3E" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Quicksand', 'sans-serif'], mono: ['Share Tech Mono', 'monospace'] },
          colors: { brand: { red: '#ff2a2a', dark: '#08080c', card: '#15151e' } }
        }
      }
    }
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700;800&family=Share+Tech+Mono&display=swap" rel="stylesheet">
</head>
<body class="bg-[#08080c] text-slate-100 min-h-screen flex flex-col font-sans">

  <header class="bg-[#0d0d14] border-b border-brand-red/30 py-4 shadow-md">
    <div class="max-w-5xl mx-auto px-4 flex items-center justify-between gap-4">
      <a href="${escapeHtml(baseUrl)}" class="text-xl font-black tracking-widest text-white font-mono">BLACK MARKET<span class="text-[9px] bg-brand-red/20 text-brand-red px-1.5 py-0.5 rounded border border-brand-red/35 font-mono font-bold ml-2">K-STREET</span></a>
      <a href="${escapeHtml(baseUrl)}" class="text-[10px] font-mono text-zinc-400 hover:text-brand-red border border-zinc-800 px-3 py-1.5 rounded-lg">← TOUT LE CATALOGUE</a>
    </div>
  </header>

  <main class="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
    <div class="bg-[#15151e] rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
      <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="relative aspect-square rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800">
          <img src="${escapeHtml(imgUrl)}" alt="${title}" onerror="this.onerror=null;this.src='${escapeHtml(p.imageUrl)}'" class="w-full h-full object-cover">
        </div>
        <div class="space-y-4 flex flex-col justify-between">
          <div class="space-y-3">
            <div>
              <span class="inline-block bg-brand-red/10 text-brand-red text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded border border-brand-red/25 mb-1.5">${category}</span>
              <h1 class="text-xl sm:text-2xl font-extrabold text-slate-100 leading-snug">${title}</h1>
            </div>
            <div class="bg-gradient-to-r from-brand-red/10 to-transparent p-3 rounded-xl border-l-4 border-brand-red">
              <p class="text-[8px] text-zinc-400 uppercase font-mono font-bold tracking-widest">PRIX DE VENTE SPECIAL</p>
              <p class="text-2xl font-extrabold text-brand-red font-mono">${priceXof} F CFA${priceEur ? ` <span class="text-xs text-zinc-400">≈ ${priceEur} €</span>` : ""}</p>
            </div>
            <div class="space-y-1.5">
              <p class="text-[9px] text-brand-red font-mono uppercase font-bold tracking-wider">SPECIFICATIONS</p>
              <ul class="text-xs text-zinc-300 leading-relaxed space-y-1.5 bg-black/40 p-3 rounded-lg border border-zinc-900">
${features}
              </ul>
            </div>
            <div class="text-xs text-zinc-400 leading-relaxed bg-black/40 p-3 rounded-lg border border-zinc-900 space-y-2">
${descriptionBlocks}
            </div>
          </div>
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" onclick="trackPreorder()" class="bg-brand-red hover:bg-red-600 text-white font-extrabold text-sm py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-red/10 font-mono uppercase tracking-widest">
            💬 PRÉCOMMANDER VIA WHATSAPP
          </a>
        </div>
      </div>
    </div>
    <p class="text-center text-[10px] text-zinc-600 font-mono mt-6">© 2026 BLACK MARKET CO. IMAGES PROTÉGÉES PAR FILIGRANE AUTOMATIQUE</p>
  </main>
  <script>
    // Real activity tracking: feeds the admin dashboard (clicks + pending lead order)
    function trackPreorder() {
      try {
        fetch("/api/products/" + encodeURIComponent("${p.id}") + "/clicks", { method: "POST", keepalive: true }).catch(function () {});
        fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: "${p.id}", quantity: 1 }),
          keepalive: true,
        }).catch(function () {});
      } catch (e) {}
    }
  </script>
</body>
</html>
`;
}
