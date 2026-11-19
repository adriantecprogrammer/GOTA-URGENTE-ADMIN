/** ≥3 active leaks within 250 m of each other: likely a primary-network failure. */
export interface Zone {
  /** Changes on every request — use `leak_ids` to act on a zone. */
  zone_id: number
  leak_count: number
  liters_per_day: number
  max_urgency: number
  center_lat: number
  center_lng: number
  leak_ids: string[]
}

export const zonesService = (http: typeof $fetch) => ({
  list: () => http<Zone[]>('/zones')
})
