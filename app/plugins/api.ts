import { zonesService } from '~/services/zones'
import { adminService } from '~/services/admin'

// Postgres bigints arrive as strings ("3"); turn them into numbers once, here, for every entity.
const INT_KEYS = new Set([
  'report_count', 'urgency_score', 'liters_wasted', 'liters_per_day', 'confirmation_count',
  'crew_id', 'zone_id', 'zone_size', 'leak_count', 'max_urgency', 'updated'
])
const reviver = (key: string, value: unknown) =>
  INT_KEYS.has(key) && typeof value === 'string' ? Number(value) : value

export default defineNuxtPlugin((nuxtApp) => {
  const token = useAdminToken()

  const http = $fetch.create({
    baseURL: useRuntimeConfig().public.apiBase,
    parseResponse: text => JSON.parse(text, reviver),
    onRequest({ options }) {
      if (token.value) options.headers.set('Authorization', `Bearer ${token.value}`)
    },
    async onResponseError({ response }) {
      // Expired/invalid JWT (or bad login): drop it; the route middleware then sends the admin to login.
      if (response.status !== 401) return
      token.value = null
      await nuxtApp.runWithContext(() => navigateTo('/login'))
    }
  })

  return {
    provide: {
      api: {
        zones: zonesService(http),
        admin: adminService(http)
      }
    }
  }
})
