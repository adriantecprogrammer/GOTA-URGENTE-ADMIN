<script setup lang="ts">
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre v6 looks for its worker next to the bundle chunk, where Vite never copies it; ?url emits it as an asset.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Leak } from '~/services/leaks'
import type { Sector, SectorMode } from '~/services/admin'
import type { Zone } from '~/services/zones'

maplibregl.setWorkerUrl(workerUrl)

const props = defineProps<{
  leaks: Leak[]
  selectedId?: string | null
  /** Joint-failure zones, drawn as rings under the pins. */
  zones?: Zone[]
  /** Service zones painted under everything, coloured per `sectorMode`. */
  sectors?: Sector[]
  sectorMode?: SectorMode
  /** A leak that just arrived over realtime: ringed so it can be found at a glance. */
  flashId?: string | null
  /** Area covered by floating panels; the camera centers in the visible remainder. */
  padding?: { left: number, right: number }
}>()
const emit = defineEmits<{ select: [id: string] }>()

const container = ref<HTMLDivElement>()
let map: maplibregl.Map

const radius: ExpressionSpecification = ['interpolate', ['linear'], ['get', 'count'], 1, 7, 6, 14]
const CLOSED_HEX = '#AFAFAF'
const DOT_LAYERS = ['inc-dot']

const geojson = computed(() => ({
  type: 'FeatureCollection' as const,
  features: props.leaks.map(l => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
    properties: {
      id: l.id,
      count: l.report_count,
      color: isOpen(l.status) ? LEVEL[l.urgency_level].hex : CLOSED_HEX,
      critical: l.urgency_level === 'critica' && l.status === 'pendiente',
      working: l.status === 'en_atencion'
    }
  }))
}))

const sectorsGeojson = computed(() => ({
  type: 'FeatureCollection' as const,
  features: (props.sectors ?? []).map((s) => {
    const used = s.crews.reduce((n, c) => n + c.active_leaks, 0)
    const cap = s.crews.reduce((n, c) => n + c.max_active_leaks, 0)
    return {
      type: 'Feature' as const,
      geometry: s.geometry,
      properties: { color: s.color, points: s.priority_points, load: cap ? used / cap : 0, label: `${s.name}\n${cap ? `${used}/${cap} fugas` : 'sin cuadrillas'}` }
    }
  })
}))

// Colour reads differently per mode; urgency red/orange are reused on purpose for "loaded" (same meaning: act here).
const SECTOR_COLOR: Record<Exclude<SectorMode, 'off'>, ExpressionSpecification> = {
  zona: ['get', 'color'],
  carga: ['interpolate', ['linear'], ['get', 'load'], 0, '#079CD8', 0.6, '#F56A00', 1, '#DE1135'],
  prioridad: ['interpolate', ['linear'], ['get', 'points'], 0, '#04D7F2', 15, '#002F59']
}
function paintSectors() {
  if (!map?.getLayer('sector-fill')) return
  const mode = props.sectorMode ?? 'zona'
  const on = mode !== 'off'
  for (const id of ['sector-fill', 'sector-line', 'sector-label']) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  if (!on) return
  map.setPaintProperty('sector-fill', 'fill-color', SECTOR_COLOR[mode])
  map.setPaintProperty('sector-line', 'line-color', SECTOR_COLOR[mode])
}

// Same radius the API uses to call three leaks a zone.
const ZONE_RADIUS_M = 250
// ponytail: a 48-sided polygon stands in for the circle; exact enough at street scale.
const ring = (lat: number, lng: number) => Array.from({ length: 49 }, (_, i) => {
  const a = i / 48 * 2 * Math.PI
  return [lng + ZONE_RADIUS_M * Math.sin(a) / (111_320 * Math.cos(lat * Math.PI / 180)), lat + ZONE_RADIUS_M * Math.cos(a) / 111_320]
})
const zonesGeojson = computed(() => ({
  type: 'FeatureCollection' as const,
  features: (props.zones ?? []).map(z => ({
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [ring(z.center_lat, z.center_lng)] },
    properties: {}
  }))
}))

const pad = () => ({ top: 0, bottom: 0, left: 0, right: 0, ...props.padding })
// Last flyTo destination. Selecting a leak opens the detail panel, which changes the padding mid-flight;
// that move re-aims at the destination instead of cancelling the flight. Cleared when the operator moves the map.
let target: { center: [number, number], zoom: number } | undefined

// Leaks arrive after the map exists: frame the city's once, then leave the camera to the operator.
// Only leaks within ~30 km of the city count, so one report from another state can't zoom the map out to the whole country.
const CITY_SPAN_DEG = 0.3
let fitted = false
function fitOnce() {
  const local = props.leaks.filter(l => Math.abs(l.lat - CITY_CENTER.lat) < CITY_SPAN_DEG && Math.abs(l.lng - CITY_CENTER.lng) < CITY_SPAN_DEG)
  if (fitted || !map || !local.length) return
  fitted = true
  const b = new maplibregl.LngLatBounds()
  for (const l of local) b.extend([l.lng, l.lat])
  map.fitBounds(b, { padding: 72, maxZoom: 15, duration: 0 })
}

onMounted(async () => {
  map = new maplibregl.Map({
    container: container.value!,
    style: await gotaMapStyle(),
    center: [CITY_CENTER.lng, CITY_CENTER.lat],
    zoom: 14,
    attributionControl: { compact: true }
  })
  map.setPadding(pad())
  fitOnce()
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

  map.on('load', () => {
    map.addSource('sectors', { type: 'geojson', data: sectorsGeojson.value })
    map.addLayer({ id: 'sector-fill', type: 'fill', source: 'sectors', paint: { 'fill-color': '#0278C0', 'fill-opacity': 0.16 } })
    map.addLayer({ id: 'sector-line', type: 'line', source: 'sectors', paint: { 'line-color': '#0278C0', 'line-width': 1.5, 'line-opacity': 0.8 } })
    map.addLayer({
      id: 'sector-label',
      type: 'symbol',
      source: 'sectors',
      layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] },
      paint: { 'text-color': '#002F59', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 }
    })
    paintSectors()
    map.addSource('zones', { type: 'geojson', data: zonesGeojson.value })
    map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zones', paint: { 'fill-color': LEVEL.critica.hex, 'fill-opacity': 0.07 } })
    map.addLayer({ id: 'zone-line', type: 'line', source: 'zones', paint: { 'line-color': LEVEL.critica.hex, 'line-width': 1.5, 'line-dasharray': [3, 2] } })
    map.addSource('leaks', { type: 'geojson', data: geojson.value })
    map.addLayer({
      id: 'inc-halo',
      type: 'circle',
      source: 'leaks',
      filter: ['get', 'critical'],
      paint: { 'circle-color': ['get', 'color'], 'circle-opacity': 0.18, 'circle-radius': ['*', radius, 2.6] }
    })
    // Crew on site: a ring that keeps expanding and fading (see the loop below).
    map.addLayer({
      id: 'inc-working',
      type: 'circle',
      source: 'leaks',
      filter: ['get', 'working'],
      paint: { 'circle-color': 'transparent', 'circle-stroke-color': '#0278C0', 'circle-stroke-width': 3, 'circle-radius': 14 }
    })
    map.addLayer({
      id: 'inc-dot',
      type: 'circle',
      source: 'leaks',
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': radius,
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2.5
      }
    })
    map.addLayer({
      id: 'inc-selected',
      type: 'circle',
      source: 'leaks',
      filter: ['==', ['get', 'id'], props.selectedId ?? ''],
      paint: {
        'circle-color': 'transparent',
        'circle-radius': ['+', radius, 5],
        'circle-stroke-color': '#002F59',
        'circle-stroke-width': 3
      }
    })
    map.addLayer({
      id: 'inc-new',
      type: 'circle',
      source: 'leaks',
      filter: ['==', ['get', 'id'], props.flashId ?? ''],
      paint: {
        'circle-color': 'transparent',
        'circle-radius': ['+', radius, 10],
        'circle-stroke-color': '#04D7F2',
        'circle-stroke-width': 4
      }
    })
    map.addLayer({
      id: 'inc-count',
      type: 'symbol',
      source: 'leaks',
      filter: ['>', ['get', 'count'], 1],
      layout: { 'text-field': ['to-string', ['get', 'count']], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
      paint: { 'text-color': '#FFFFFF' }
    })
  })

  map.on('click', DOT_LAYERS, (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties?.id
    if (id) emit('select', id)
  })
  map.on('movestart', (e) => {
    if ('originalEvent' in e && e.originalEvent) target = undefined
  })
  map.on('mouseenter', DOT_LAYERS, () => (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', DOT_LAYERS, () => (map.getCanvas().style.cursor = ''))
})

// ponytail: one rAF loop drives the ring through setPaintProperty; fine for a few crews on site,
// move to a sprite/feature-state if dozens work at once.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
let raf = 0
function pulse(t: number) {
  if (map?.getLayer('inc-working')) {
    const p = (t % 1800) / 1800
    map.setPaintProperty('inc-working', 'circle-radius', ['+', radius, 4 + p * 26])
    map.setPaintProperty('inc-working', 'circle-stroke-opacity', calm ? 0.6 : 0.9 * (1 - p))
  }
  if (!calm) raf = requestAnimationFrame(pulse)
}
onMounted(() => {
  raf = requestAnimationFrame(pulse)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  map?.remove()
})

watch(geojson, (data) => {
  (map?.getSource('leaks') as GeoJSONSource | undefined)?.setData(data)
  fitOnce()
})
watch(sectorsGeojson, data => (map?.getSource('sectors') as GeoJSONSource | undefined)?.setData(data))
watch(() => props.sectorMode, paintSectors)
watch(zonesGeojson, data => (map?.getSource('zones') as GeoJSONSource | undefined)?.setData(data))
watch(() => props.flashId, id => map?.getLayer('inc-new') && map.setFilter('inc-new', ['==', ['get', 'id'], id ?? '']))
watch(() => props.padding, () => map?.easeTo({ padding: pad(), ...target, duration: 300 }), { deep: true })
watch(() => props.selectedId, id => map?.getLayer('inc-selected') && map.setFilter('inc-selected', ['==', ['get', 'id'], id ?? '']))

function flyTo(pos: { lat: number, lng: number }, zoom = 16) {
  if (!map) return
  target = { center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), zoom) }
  map.flyTo({ ...target, padding: pad(), duration: 800 })
}

defineExpose({ flyTo })
</script>

<template>
  <div
    ref="container"
    class="size-full bg-[#F6F6F6]"
  />
</template>
