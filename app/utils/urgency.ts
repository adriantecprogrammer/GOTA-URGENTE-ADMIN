export type Severity = 'goteo' | 'chorro' | 'inundacion'
export type Status = 'pendiente' | 'atencion' | 'resuelto'

export interface LeakReport {
  id: string
  lat: number
  lng: number
  severity: Severity
  status: Status
  createdAt: number
  address?: string
  note?: string
  photo?: string
}

export interface Incident {
  id: string
  lat: number
  lng: number
  reports: LeakReport[]
  severity: Severity
  status: Status
  urgency: number
  level: Level
  firstAt: number
  address?: string
}

export type Level = 'critica' | 'alta' | 'media' | 'baja'

/** Reports within this radius (meters) of an incident's first report merge into it. */
export const CLUSTER_RADIUS_M = 80

export const SEVERITY: Record<Severity, { label: string, hint: string, weight: number, icon: string }> = {
  goteo: { label: 'Goteo', hint: 'Gotas constantes o charco pequeño', weight: 1, icon: 'i-lucide-droplet' },
  chorro: { label: 'Chorro', hint: 'Flujo continuo que corre por la calle', weight: 2, icon: 'i-lucide-droplets' },
  inundacion: { label: 'Inundación', hint: 'Agua acumulada, brota del suelo o tubería rota', weight: 3, icon: 'i-lucide-waves' }
}

export const STATUS: Record<Status, { label: string, color: 'warning' | 'info' | 'success' }> = {
  pendiente: { label: 'Pendiente', color: 'warning' },
  atencion: { label: 'En atención', color: 'info' },
  resuelto: { label: 'Resuelto', color: 'success' }
}

export const LEVEL: Record<Level, { label: string, hex: string }> = {
  critica: { label: 'Crítica', hex: '#DE1135' },
  alta: { label: 'Alta', hex: '#F56A00' },
  media: { label: 'Media', hex: '#E8A800' },
  baja: { label: 'Baja', hex: '#0E8345' }
}

export function distanceM(a: { lat: number, lng: number }, b: { lat: number, lng: number }) {
  const R = 6371e3
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Urgency 0–100:
 *   severity (worst report)  → 20 / 40 / 60
 *   + duplicates             → +10 per extra report, max 25
 *   + time open (unresolved) → +3 per day, max 15
 */
export function urgencyOf(reports: LeakReport[], now = Date.now()) {
  const sev = Math.max(...reports.map(r => SEVERITY[r.severity].weight)) * 20
  const dup = Math.min(25, (reports.length - 1) * 10)
  const days = (now - Math.min(...reports.map(r => r.createdAt))) / 864e5
  const age = Math.min(15, Math.floor(days * 3))
  return Math.min(100, sev + dup + age)
}

export function levelOf(urgency: number): Level {
  return urgency >= 75 ? 'critica' : urgency >= 55 ? 'alta' : urgency >= 35 ? 'media' : 'baja'
}

// ponytail: greedy O(n²) clustering anchored on the oldest report; fine for a few thousand reports, move to a spatial index (or PostGIS ST_ClusterDBSCAN) beyond that.
export function clusterReports(reports: LeakReport[], now = Date.now()): Incident[] {
  const groups: LeakReport[][] = []
  for (const r of [...reports].sort((a, b) => a.createdAt - b.createdAt)) {
    const g = groups.find(g => g[0]!.status === r.status && distanceM(g[0]!, r) <= CLUSTER_RADIUS_M)
    if (g) g.push(r)
    else groups.push([r])
  }
  return groups.map((g) => {
    const urgency = urgencyOf(g, now)
    const worst = g.reduce((a, b) => SEVERITY[b.severity].weight > SEVERITY[a.severity].weight ? b : a)
    return {
      id: g[0]!.id,
      lat: g.reduce((s, r) => s + r.lat, 0) / g.length,
      lng: g.reduce((s, r) => s + r.lng, 0) / g.length,
      reports: g,
      severity: worst.severity,
      status: g[0]!.status,
      urgency,
      level: levelOf(urgency),
      firstAt: g[0]!.createdAt,
      address: g.find(r => r.address)?.address
    }
  }).sort((a, b) => b.urgency - a.urgency)
}
