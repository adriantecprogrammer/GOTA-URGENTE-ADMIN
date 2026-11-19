import { useIntervalFn } from '@vueuse/core'
import type { AdminLeakPatch } from '~/services/admin'

/** Polling interval until MQTT exists; MQTT will only ring the bell, the data always comes from the API. */
export const POLL_MS = 10_000

/** Dashboard data: every leak (all statuses) + zones + crews, polled together. */
export function useAdminLeaks() {
  const { $api } = useNuxtApp()

  // 'todas' so the status tabs can show their counts without one request per tab.
  const leaks = useAsyncData('admin-leaks', () => $api.admin.leaks('todas'), { default: () => [] })
  const zones = useAsyncData('zones', () => $api.zones.list(), { default: () => [] })
  const crews = useAsyncData('crews', () => $api.admin.crews(), { default: () => [] })

  const refresh = () => Promise.all([leaks.refresh(), zones.refresh()])
  useIntervalFn(refresh, POLL_MS)
  watch([leaks.data, zones.data], ([l, z]) => queueAddresses([...l, ...z.map(z => ({ lat: z.center_lat, lng: z.center_lng }))]), { immediate: true })

  /** PATCH and swap the row in place with the server's recomputed version. */
  async function update(id: string, patch: AdminLeakPatch) {
    const updated = await $api.admin.updateLeak(id, patch)
    leaks.data.value = leaks.data.value.map(l => l.id === id ? updated : l)
    return updated
  }

  async function assignZone(leakIds: string[], crewId: number) {
    const r = await $api.admin.assignZone(leakIds, crewId)
    await refresh()
    return r
  }

  return { leaks, zones, crews, refresh, update, assignZone }
}
