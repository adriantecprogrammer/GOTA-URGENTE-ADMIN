import { useStorage } from '@vueuse/core'

/** Map default center: Coyoacán, CDMX. Change to your municipality. */
export const CITY_CENTER = { lat: 19.3500, lng: -99.1620 }

const H = 36e5
const seed = (): LeakReport[] => {
  const now = Date.now()
  const s: [number, number, Severity, Status, number, string][] = [
    // 4 reports on the same corner → critical
    [19.35012, -99.16205, 'inundacion', 'pendiente', 52, 'Av. Miguel Ángel de Quevedo 687'],
    [19.35030, -99.16170, 'chorro', 'pendiente', 30, 'Av. Miguel Ángel de Quevedo 701'],
    [19.34995, -99.16240, 'inundacion', 'pendiente', 9, 'Calle Tres Cruces 12'],
    [19.35050, -99.16215, 'chorro', 'pendiente', 2, 'Av. Miguel Ángel de Quevedo 690'],
    // 2 reports → high
    [19.34560, -99.15890, 'chorro', 'pendiente', 70, 'Calle Francisco Sosa 205'],
    [19.34585, -99.15920, 'chorro', 'pendiente', 20, 'Calle Francisco Sosa 211'],
    // already being fixed
    [19.35580, -99.16810, 'inundacion', 'atencion', 26, 'Av. Universidad 1810'],
    [19.35600, -99.16790, 'chorro', 'atencion', 22, 'Av. Universidad 1802'],
    // singles
    [19.34210, -99.16550, 'goteo', 'pendiente', 96, 'Calle Higuera 44'],
    [19.35310, -99.15580, 'goteo', 'pendiente', 5, 'Calle Carrillo Puerto 18'],
    [19.33920, -99.15710, 'chorro', 'pendiente', 14, 'Av. Pacífico 120'],
    [19.35870, -99.15960, 'goteo', 'pendiente', 1, 'Calle Real de Mayorazgo 33'],
    [19.34780, -99.17150, 'goteo', 'resuelto', 120, 'Av. Río Churubusco 15']
  ]
  return s.map(([lat, lng, severity, status, hAgo, address], i) =>
    ({ id: `R-${1040 + i}`, lat, lng, severity, status, createdAt: now - hAgo * H, address }))
}

// ponytail: localStorage stands in for the backend; swap for $fetch('/api/reports') when the API exists.
const reports = useStorage<LeakReport[]>('gota:reports', seed())
const incidents = computed(() => clusterReports(reports.value))

export function useReports() {
  function setStatus(incident: Incident, status: Status) {
    const ids = new Set(incident.reports.map(r => r.id))
    reports.value = reports.value.map(r => ids.has(r.id) ? { ...r, status } : r)
  }

  const reset = () => (reports.value = seed())

  return { reports, incidents, setStatus, reset }
}
