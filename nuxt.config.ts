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
    public: {
      siteUrl: "https://blackmarket-import-export.netlify.app",
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
      title: "BLACK MARKET — Sourcing exclusif Chine (Techwear / Cyberpunk)",
      meta: [
        { name: "description", content: "BLACK MARKET - SOURCING EXCLUSIF CHINE. Découvrez notre catalogue exclusif de produits tendance importés directement d'usines chinoises (Taobao, 1688) avec prix d'usine, précommande WhatsApp et livraison sécurisée." },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#0d0d14" },
        { name: "robots", content: "index, follow, max-image-preview:large" },
        { property: "og:site_name", content: "BLACK MARKET" },
        { property: "og:locale", content: "fr_FR" },
        { property: "og:type", content: "website" },
        { property: "og:description", content: "BLACK MARKET — catalogue exclusif de produits tendance importés directement d'usines chinoises (Taobao, 1688) : techwear, cyberpunk, prix d'usine, précommande WhatsApp." },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700;800&family=Share+Tech+Mono&display=swap" },
      ],
      script: [
        {
          type: "application/ld+json",
          children: `{"@context":"https://schema.org","@type":"WebSite","name":"BLACK MARKET","alternateName":"Black Market Import Export","url":"https://blackmarket-import-export.netlify.app","description":"Sourcing exclusif Chine — techwear, cyberpunk et produits tendance importés d'usines chinoises avec prix d'usine et précommande WhatsApp."}`,
        },
      ],
    },
  },
  typescript: { strict: true },
})
