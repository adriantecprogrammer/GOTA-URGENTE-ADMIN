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

  eslint: {
    config: {
      stylistic: { commaDangle: 'never', braceStyle: '1tbs' }
    }
  },

  // Archivo's width axis isn't fetched by default; titles and figures use it slightly expanded.
  fonts: {
    families: [{
      name: 'Archivo',
      provider: 'google',
      weights: ['500 800'],
      providerOptions: { google: { experimental: { variableAxis: { wdth: [['100', '125']] } } } }
    }]
  }
})
