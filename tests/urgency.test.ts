// Run: node tests/urgency.test.ts
import assert from 'node:assert/strict'
import { clusterReports, distanceM, type LeakReport } from '../app/utils/urgency.ts'

const now = Date.now()
const r = (id: string, lat: number, lng: number, severity: LeakReport['severity'] = 'goteo', status: LeakReport['status'] = 'pendiente'): LeakReport =>
  ({ id, lat, lng, severity, status, createdAt: now })

// ~0.0005° lat ≈ 55 m
assert.ok(Math.abs(distanceM({ lat: 19, lng: -99 }, { lat: 19.0005, lng: -99 }) - 55.6) < 1)

const single = clusterReports([r('a', 19, -99)], now)
assert.equal(single.length, 1)
assert.equal(single[0]!.urgency, 20)

const merged = clusterReports([r('a', 19, -99), r('b', 19.0005, -99), r('c', 19.0004, -99.0003, 'chorro'), r('far', 19.01, -99)], now)
assert.equal(merged.length, 2)
assert.equal(merged[0]!.reports.length, 3)
assert.equal(merged[0]!.severity, 'chorro')
assert.equal(merged[0]!.urgency, 40 + 20) // worst severity + 2 duplicates
assert.ok(merged[0]!.urgency > merged[1]!.urgency, 'sorted by urgency desc')

// resolved incidents don't absorb new pending reports
assert.equal(clusterReports([r('a', 19, -99, 'goteo', 'resuelto'), r('b', 19, -99)], now).length, 2)

console.log('urgency ok')
