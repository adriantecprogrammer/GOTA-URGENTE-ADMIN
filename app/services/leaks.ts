import type { Level, Severity, Status } from '~/utils/urgency'

// Types only: the public endpoints live in the citizen app; the dashboard reads them through /admin/leaks.

/** A map pin: one physical leak grouping every report about it. */
export interface Leak {
  id: string
  lat: number
  lng: number
  status: Status
  max_severity: Severity
  /** Reports from distinct devices. */
  report_count: number
  /** 0–100. */
  urgency_score: number
  urgency_level: Level
  /** Estimated liters lost since the first report. */
  liters_wasted: number
  liters_per_day: number
  photo_url: string | null
  first_reported_at: string
}
