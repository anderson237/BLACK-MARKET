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
      googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    },
  },
  nitro: {
    preset: "netlify",
    externals: { inline: ["@netlify/blobs"] },
  },
  app: {
    head: {
      title: "BLACK MARKET — Sourcing exclusif Chine (Techwear / Cyberpunk)",
      meta: [
        { name: "description", content: "BLACK MARKET - SOURCING EXCLUSIF CHINE. Découvrez notre catalogue exclusif de produits tendance importés directement d'usines chinoises (Taobao, 1688) avec prix d'usine, précommande WhatsApp et livraison sécurisée." },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#0d0d14" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700;800&family=Share+Tech+Mono&display=swap" },
      ],
    },
  },
  typescript: { strict: true },
})
