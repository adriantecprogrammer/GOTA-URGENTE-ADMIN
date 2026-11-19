// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/image'],

  // Client-only dashboard behind a login: no server rendering needed.
  ssr: false,

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  // Override with NUXT_PUBLIC_API_BASE / NUXT_PUBLIC_MQTT_URL / NUXT_PUBLIC_MQTT_TOPIC.
  // The topic must match MQTT_TOPIC in the API's wrangler.jsonc. Empty mqttUrl or mqttTopic = polling only.
  // Fallback broker if EMQX dies: wss://broker.hivemq.com:8884/mqtt (change it in the API at the same time).
  runtimeConfig: {
    public: {
      apiBase: 'https://agua-alerta-api.adrian9012.workers.dev',
      mqttUrl: 'wss://broker.emqx.io:8084/mqtt',
      mqttTopic: 'agua-alerta/80350e6515d7/leaks'
    }
  },

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
