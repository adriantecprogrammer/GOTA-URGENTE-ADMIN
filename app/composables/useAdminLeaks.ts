import type { AdminLeakPatch } from '~/services/admin'

/** Dashboard data: every leak (all statuses) + zones + crews, kept fresh by the MQTT doorbell + polling. */
export function useAdminLeaks() {
  const { $api } = useNuxtApp()

  // 'todas' so the status tabs can show their counts without one request per tab.
  const leaks = useAsyncData('admin-leaks', () => $api.admin.leaks('todas'), { default: () => [] })
  const zones = useAsyncData('zones', () => $api.zones.list(), { default: () => [] })
  const crews = useAsyncData('crews', () => $api.admin.crews(), { default: () => [] })

  const sectors = useAsyncData('sectors', () => $api.admin.sectors(), { default: () => [] })

  // A new report changes both the queue and the zones.
  const refresh = () => Promise.all([leaks.refresh(), zones.refresh()])
  const realtime = useLeakRealtime(refresh)
  watch([leaks.data, zones.data], ([l, z]) => queueAddresses([...l, ...z.map(z => ({ lat: z.center_lat, lng: z.center_lng }))]), { immediate: true })

  /** PATCH and swap the row in place with the server's recomputed version. */
  async function update(id: string, patch: AdminLeakPatch) {
    const updated = await $api.admin.updateLeak(id, patch)
    leaks.data.value = leaks.data.value.map(l => l.id === id ? updated : l)
    crews.refresh() // load per crew changed
    return updated
  }

  async function updateCrew(id: number, patch: { sector_id?: number | null, max_active_leaks?: number }) {
    await $api.admin.updateCrew(id, patch)
    // Suggested crews on the leaks depend on zone/capacity.
    await Promise.all([crews.refresh(), leaks.refresh()])
  }

  async function assignZone(leakIds: string[], crewId: number) {
    const r = await $api.admin.assignZone(leakIds, crewId)
    await Promise.all([refresh(), crews.refresh()])
    return r
  }

  return { leaks, zones, crews, sectors, refresh, update, updateCrew, assignZone, realtime }
}
