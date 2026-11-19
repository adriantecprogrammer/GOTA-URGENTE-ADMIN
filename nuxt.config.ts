// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/image'],

  // Map + localStorage app: no server rendering needed.
  ssr: false,

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  // Citizen app runs on 3000.
  devServer: { port: 3001 },

  compatibilityDate: '2026-06-30',

  // MapLibre v6 loads its worker via import.meta.url; pre-bundling breaks that path.
  vite: { optimizeDeps: { exclude: ['maplibre-gl'] } },

  eslint: {
    config: {
      stylistic: { commaDangle: 'never', braceStyle: '1tbs' }
    }
  }
})
