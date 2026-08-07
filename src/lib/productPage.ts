import { Product } from "../types";

function escapeHtml(value: string | undefined | null): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function getProductPageHtml(p: Product, baseUrl: string, phoneNumber: string, opts?: { ogImage?: string; useLiveImage?: boolean }): string {
  const pageUrl = baseUrl + "p/" + p.id + ".html";
  const imgUrl = baseUrl + "img/" + p.id + ".jpg";
  const ogImage = (opts && opts.ogImage) || imgUrl;
  // When the admin changed/uploaded/generated a new image, prefer the live URL
  // (already watermarked client-side) instead of the stale static copy.
  const primaryImg = (opts && opts.useLiveImage && p.imageUrl) ? p.imageUrl : imgUrl;
  const fallbackImg = (opts && opts.useLiveImage && p.imageUrl) ? imgUrl : p.imageUrl;
  const title = escapeHtml(p.title);
  const descriptionMeta = escapeHtml(p.description);
  const category = escapeHtml(p.category || "EXCLUSIF");
  const priceXof = Number(p.priceXof || 0).toLocaleString("fr-FR");
  const priceEur = escapeHtml(String(p.priceEur ?? ""));
  const features = (p.features || [])
    .map((f) => `            <li class="flex items-start gap-2"><span class="text-brand-red mt-0.5">◆</span><span>${escapeHtml(f)}</span></li>`)
    .join("\n");
  // Sanitize admin/AI-generated HTML: allow only safe structural tags + inline styles.
  const rawDesc = String(p.description || "");
  const descriptionBlocks = /<\/?[a-z][^>]*>/i.test(rawDesc)
    ? rawDesc
        .replace(/<(script|style|iframe|object|embed|form|input)[^>]*>.*?<\/\1>/gis, "")
        .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/javascript:/gi, "")
        .slice(0, 12000)
    : rawDesc
        .split(/\n{2,}/)
        .map((b) => `<p class="text-xs text-zinc-300 leading-relaxed indent-4">${escapeHtml(b.trim())}</p>`)
        .join("\n              ");
  const message =
    "Bonjour DEEP ROOTS, 👋\n\n" +
    "Je souhaite passer une PRÉCOMMANDE pour le produit suivant :\n\n" +
    "  📦 PRODUIT : " + String(p.title || "").toUpperCase() + "\n" +
    "  💰 PRIX : " + priceXof + " F CFA" + (p.priceEur ? " (≈ " + p.priceEur + " €)" : "") + "\n" +
    "  🔗 FICHE PRODUIT : " + pageUrl + "\n\n" +
    "Merci de me confirmer la disponibilité, le délai de livraison et les modalités de paiement.\n\n" +
    "Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées.";
  const waUrl = "https://wa.me/" + phoneNumber.replace(/\+/g, "").replace(/\s/g, "") + "?text=" + encodeURIComponent(message);

  // Build the media carousel: main watermarked image + gallery photos + optional video.
  const mediaItems: string[] = [];
  mediaItems.push(
    `<div class="carousel-slide"><img src="${escapeHtml(primaryImg)}" alt="${title}" onerror="this.onerror=null;this.src='${escapeHtml(fallbackImg)}'" class="w-full h-full object-cover"></div>`
  );
  (p.gallery || []).slice(0, 11).forEach((u) => {
    if (!u) return;
    mediaItems.push(
      `<div class="carousel-slide hidden"><img src="${escapeHtml(u)}" alt="${title}" onerror="this.onerror=null;this.hidden=true" class="w-full h-full object-cover"></div>`
    );
  });
  if (p.videoUrl) {
    mediaItems.push(
      `<div class="carousel-slide hidden"><video src="${escapeHtml(p.videoUrl)}" controls preload="metadata" playsinline class="w-full h-full object-cover"></video></div>`
    );
  }
  const mediaCount = mediaItems.length;
  const carouselHtml = `
          <div class="relative aspect-square rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800" id="bm-carousel">
            ${mediaItems.join("\n            ")}
            ${mediaCount > 1 ? `
            <button onclick="bmMove(-1)" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-brand-red/80 text-white w-8 h-8 rounded-full text-lg font-black leading-none border border-white/20 transition-colors z-10">‹</button>
            <button onclick="bmMove(1)" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-brand-red/80 text-white w-8 h-8 rounded-full text-lg font-black leading-none border border-white/20 transition-colors z-10">›</button>
            <div class="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10" id="bm-dots">
              ${Array.from({ length: mediaCount }, (_, i) =>
                `<span class="bm-dot w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-brand-red" : "bg-white/40"}" data-i="${i}"></span>`
              ).join("")}
            </div>` : ""}
          </div>
          <script>
            (function () {
              var slides = document.querySelectorAll('#bm-carousel .carousel-slide');
              var dots = document.querySelectorAll('#bm-carousel .bm-dot');
              var idx = 0;
              window.bmMove = function (dir) {
                if (slides.length === 0) return;
                slides[idx].classList.add('hidden');
                if (dots.length) dots[idx].classList.remove('bg-brand-red');
                idx = (idx + dir + slides.length) % slides.length;
                slides[idx].classList.remove('hidden');
                if (dots.length) dots[idx].classList.add('bg-brand-red');
              };
              for (var i = 0; i < dots.length; i++) {
                dots[i].addEventListener('click', function () {
                  var target = parseInt(this.getAttribute('data-i'), 10);
                  slides[idx].classList.add('hidden');
                  if (dots.length) dots[idx].classList.remove('bg-brand-red');
                  idx = target;
                  slides[idx].classList.remove('hidden');
                  if (dots.length) dots[idx].classList.add('bg-brand-red');
                });
              }
            })();
          </script>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - DEEP ROOTS</title>
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
      <a href="${escapeHtml(baseUrl)}" class="text-xl font-black tracking-widest text-white font-mono">DEEP ROOTS<span class="text-[9px] bg-brand-red/20 text-brand-red px-1.5 py-0.5 rounded border border-brand-red/35 font-mono font-bold ml-2">K-STREET</span></a>
      <a href="${escapeHtml(baseUrl)}" class="text-[10px] font-mono text-zinc-400 hover:text-brand-red border border-zinc-800 px-3 py-1.5 rounded-lg">← TOUT LE CATALOGUE</a>
    </div>
  </header>

  <main class="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
    <div class="bg-[#15151e] rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
      <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        ${carouselHtml}
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
            ${p.originalDescription ? `
            <div class="text-xs text-zinc-300 leading-relaxed bg-black/40 p-3 rounded-lg border border-zinc-900 space-y-2">
              <p class="text-[9px] text-brand-red font-mono uppercase font-bold tracking-wider">FICHE TECHNIQUE</p>
              ${String(p.originalDescription)
                .replace(/<(script|style|iframe|object|embed|form|input)[^>]*>.*?<\/\1>/gis, "")
                .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
                .replace(/javascript:/gi, "")
                .slice(0, 12000)}
            </div>` : ""}
          </div>
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" onclick="trackPreorder()" class="bg-brand-red hover:bg-red-600 text-white font-extrabold text-sm py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-red/10 font-mono uppercase tracking-widest">
            💬 PRÉCOMMANDER VIA WHATSAPP
          </a>
        </div>
      </div>
    </div>
    <p class="text-center text-[10px] text-zinc-600 font-mono mt-6">© 2026 DEEP ROOTS CO. IMAGES PROTÉGÉES PAR FILIGRANE AUTOMATIQUE</p>
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
