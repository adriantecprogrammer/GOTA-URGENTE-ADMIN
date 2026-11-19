import { useDebounceFn, useIntervalFn } from '@vueuse/core'
import type { MqttClient } from 'mqtt'

export type RealtimeStatus = 'conectando' | 'en-vivo' | 'reconectando' | 'sin-mqtt'

/** What the API publishes after saving a report. A doorbell, not data: it only triggers a refetch. */
export interface LeakEvent { tipo: 'created' | 'confirmed', leak_id: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The broker is public: anyone can publish there, so anything that isn't exactly a LeakEvent is ignored. */
export function parseLeakEvent(payload: string): LeakEvent | null {
  try {
    const d = JSON.parse(payload)
    return (d?.tipo === 'created' || d?.tipo === 'confirmed') && typeof d.leak_id === 'string' && UUID.test(d.leak_id)
      ? { tipo: d.tipo, leak_id: d.leak_id }
      : null
  } catch {
    return null
  }
}

/**
 * Listens to the API's MQTT doorbell and refetches. The browser only subscribes, never publishes.
 * Polling never stops: 60 s while MQTT is live, 10 s otherwise, so a dead broker only costs latency.
 */
export function useLeakRealtime(refetch: () => unknown) {
  const { mqttUrl, mqttTopic } = useRuntimeConfig().public
  const status = ref<RealtimeStatus>(mqttUrl && mqttTopic ? 'conectando' : 'sin-mqtt')
  const lastEvent = ref<LeakEvent | null>(null)

  // Several events in a row (e.g. 5 confirmations) collapse into one refetch.
  const scheduleRefetch = useDebounceFn(() => refetch(), 500)
  // Reactive interval: it only restarts when the period actually changes, so reconnect attempts don't postpone it.
  useIntervalFn(() => refetch(), computed(() => status.value === 'en-vivo' ? 60_000 : 10_000))

  let client: MqttClient | undefined
  let disposed = false
  onScopeDispose(() => {
    disposed = true
    client?.end(true)
  })

  if (status.value !== 'sin-mqtt') {
    import('mqtt').then(({ default: mqtt }) => {
      if (disposed) return
      client = mqtt.connect(mqttUrl, {
        clientId: `agua-alerta-web-${crypto.randomUUID()}`,
        reconnectPeriod: 3_000,
        connectTimeout: 5_000,
        clean: true,
        resubscribe: false, // we subscribe on every 'connect' ourselves
        forceNativeWebSocket: true
      })
      client.on('connect', () => {
        status.value = 'en-vivo'
        client!.subscribe(mqttTopic, { qos: 0 })
        scheduleRefetch() // catch up on whatever happened while disconnected
      })
      client.on('reconnect', () => (status.value = 'reconectando'))
      client.on('close', () => {
        if (status.value === 'en-vivo') status.value = 'reconectando'
      })
      client.on('message', (_topic, payload) => {
        const event = parseLeakEvent(payload.toString())
        if (!event) return
        lastEvent.value = event
        scheduleRefetch()
      })
    }).catch(() => (status.value = 'sin-mqtt'))
  }

  return { status, lastEvent }
}
