// Run: node tests/leak-event.test.ts
// The MQTT broker is public; only an exact { tipo, leak_id } may trigger a refetch.
import assert from 'node:assert/strict'
import { parseLeakEvent } from '../app/composables/useLeakRealtime.ts'

const id = 'ff97c96b-6e8b-410c-bd8b-2c34a3130cd5'
assert.deepEqual(parseLeakEvent(JSON.stringify({ tipo: 'created', leak_id: id })), { tipo: 'created', leak_id: id })
assert.deepEqual(parseLeakEvent(JSON.stringify({ tipo: 'confirmed', leak_id: id, extra: '<script>' })), { tipo: 'confirmed', leak_id: id })
for (const bad of ['no json', 'null', '[]', '{}', JSON.stringify({ tipo: 'deleted', leak_id: id }), JSON.stringify({ tipo: 'created', leak_id: 'x' }), JSON.stringify({ tipo: 'created', leak_id: 42 })])
  assert.equal(parseLeakEvent(bad), null, bad)

console.log('leak-event ok')
