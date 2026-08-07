import tailwindcss from "@tailwindcss/vite"

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  ssr: true,
  modules: ["@pinia/nuxt"],
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    // Server-only: shared secret used by the Netlify Scheduled Function to
    // trigger /api/admin/reminders/run (set via env NUXT_TASK_SECRET).
    taskSecret: "",
    public: {
      siteUrl: "https://deeproots-importexport.netlify.app",
      phoneNumber: "237683963007",
      currency: "XOF",
      rmbToXofRate: 85,
      xofToEurRate: 655.957,
      googleClientId: process.env.GOOGLE_CLIENT_ID || "",
      ga4Id: process.env.GA4_ID || "",
    },
  },
  nitro: {
    preset: "netlify",
    // Pinia v4 imports `@vue/devtools-api` at runtime on the server. The
    // serverless bundler was dropping it, causing ERR_MODULE_NOT_FOUND on every
    // SSR page while API routes (which don't touch the Vue app) still worked.
    // We force both pinia and its devtools dep to be BUNDLED into the function
    // (inlined) so nothing resolves from node_modules at runtime.
    externals: {
      inline: ["@netlify/blobs", "pinia", "@vue/devtools-api"],
    },
  },
  app: {
    head: {
      title: "Deep Roots Logistics — Votre ancre mondiale pour le commerce international",
      meta: [
        { name: "description", content: "Deep Roots Logistics — Votre ancre mondiale pour le commerce international. Découvrez notre catalogue exclusif de produits tendance avec précommande WhatsApp et livraison sécurisée dans le monde entier." },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#0d0d14" },
        { name: "robots", content: "index, follow, max-image-preview:large", key: "robots" },
        { name: "google-site-verification", content: process.env.GOOGLE_SITE_VERIFICATION || "ee8d421bcc36433e" },
        { property: "og:site_name", content: "Deep Roots Logistics" },
        { property: "og:locale", content: "fr_FR" },
        { property: "og:type", content: "website" },
        { property: "og:description", content: "Deep Roots Logistics — votre ancre mondiale pour le commerce international : import-export, catalogue de produits tendance, précommande WhatsApp." },
        { property: "og:image", content: "https://deeproots-importexport.netlify.app/og-image.png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: "https://deeproots-importexport.netlify.app/og-image.png" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700;800&family=Share+Tech+Mono&display=swap" },
      ],
      script: [
        // Anti-FOUC : applique le thème choisi sur <html> AVANT le premier
        // rendu peint, pour supprimer le flash sombre<->clair à chaque page.
        {
          children: `(function(){try{var t=localStorage.getItem('bm_theme');if(t==='light'){document.documentElement.classList.add('light')}}catch(e){}})();`,
        },
        {
          type: "application/ld+json",
          children: `{"@context":"https://schema.org","@type":"WebSite","name":"Deep Roots Logistics","alternateName":"Deep Roots Logistics Import Export","url":"https://deeproots-importexport.netlify.app","description":"Deep Roots Logistics — votre ancre mondiale pour le commerce international : import-export global, catalogue de produits tendance et précommande WhatsApp."}`,
        },
      ],
    },
  },
  typescript: { strict: true },
})
