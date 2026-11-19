import type { Severity, Status } from '~/utils/urgency'
import type { Leak } from './leaks'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'operador'
}

export interface LoginResult {
  /** Store with `useAuthToken()`; the plugin sends it as Bearer. */
  token: string
  expires_at: string
  user: AdminUser
}

export interface Crew {
  id: number
  name: string
}

export interface AdminLeak extends Leak {
  confirmation_count: number
  /** Reappeared where a leak had already been repaired. */
  is_recurrent: boolean
  crew_id: number | null
  crew_name: string | null
  /** Changes on every request — not an id. */
  zone_id: number | null
  /** Active leaks in its zone (≥3 = likely primary-network failure). */
  zone_size: number
  attended_at: string | null
  resolved_at: string | null
}

/** `activas` = pendiente + en_atencion. */
export type AdminLeakFilter = Status | 'activas' | 'todas'

/** At least one field. `crew_id: null` unassigns the crew. */
export interface AdminLeakPatch { status?: Status, severity?: Severity, crew_id?: number | null }

export const adminService = (http: typeof $fetch) => ({
  /** 401 on bad credentials. */
  login: (email: string, password: string) =>
    http<LoginResult>('/admin/login', { method: 'POST', body: { email, password } }),

  me: () => http<AdminUser>('/admin/me'),

  crews: async () =>
    (await http<Crew[]>('/admin/crews')).map(c => ({ ...c, id: Number(c.id) })),

  /** Dashboard list, most urgent first. Defaults to `activas`. */
  leaks: (status?: AdminLeakFilter) =>
    http<AdminLeak[]>('/admin/leaks', { query: { status } }),

  /** Moving to en_atencion / resuelta / descartada stamps attended_at / resolved_at. */
  updateLeak: (id: string, patch: AdminLeakPatch) =>
    http<AdminLeak>(`/admin/leaks/${id}`, { method: 'PATCH', body: patch }),

  /** Assign one crew to every active leak of a zone (closed ones are ignored). */
  assignZone: (leak_ids: string[], crew_id: number) =>
    http<{ updated: number, leak_ids: string[] }>('/admin/zones/assign', { method: 'POST', body: { leak_ids, crew_id } })
})
