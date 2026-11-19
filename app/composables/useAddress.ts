import { useStorage } from '@vueuse/core'

interface Point { lat: number, lng: number }

// ponytail: the API has no address field, so we reverse-geocode on the client with public Nominatim (1 req/s policy).
// Fine for demo traffic; store the address in the backend at report time for production.
export async function reverseGeocode(p: Point) {
  const r = await $fetch<{ address?: Record<string, string> }>('https://nominatim.openstreetmap.org/reverse', {
    query: { 'format': 'jsonv2', 'lat': p.lat, 'lon': p.lng, 'zoom': 18, 'accept-language': 'es' }
  }).catch(() => null)
  const a = r?.address
  return a?.road ? [`${a.road} ${a.house_number ?? ''}`.trim(), a.suburb ?? a.neighbourhood].filter(Boolean).join(', ') : undefined
}

const cache = useStorage<Record<string, string>>('gota:addresses', {})
const pending = new Set<string>()
let queue = Promise.resolve()
const keyOf = (p: Point) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`

/** Street address if already known; otherwise undefined until `queueAddresses` resolves it. */
export const addressOf = (p: Point): string | undefined => cache.value[keyOf(p)]

/** Resolve unknown addresses one by one, respecting Nominatim's 1 req/s. */
export function queueAddresses(points: Point[]) {
  for (const p of points) {
    const k = keyOf(p)
    if (cache.value[k] || pending.has(k)) continue
    pending.add(k)
    queue = queue.then(async () => {
      const a = await reverseGeocode(p)
      if (a) cache.value[k] = a
      await new Promise(r => setTimeout(r, 1100))
    })
  }
}
