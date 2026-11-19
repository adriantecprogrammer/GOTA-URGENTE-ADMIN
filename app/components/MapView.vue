<script setup lang="ts">
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre v6 looks for its worker next to the bundle chunk, where Vite never copies it; ?url emits it as an asset.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

maplibregl.setWorkerUrl(workerUrl)

const props = defineProps<{
  incidents: Incident[]
  selectedId?: string | null
  /** Show a fixed center pin and emit `center` as the map moves. */
  picking?: boolean
  /** Area covered by floating UI; map center and pin sit in the visible remainder. */
  padding?: { left: number, bottom: number }
  /** Thumbnail mode: zoom out to show every open incident; restores the previous view when turned off. */
  overview?: boolean
}>()
const emit = defineEmits<{ select: [id: string], center: [pos: { lat: number, lng: number }] }>()

const container = ref<HTMLDivElement>()
const moving = ref(false)
let map: maplibregl.Map

let view: { center: maplibregl.LngLatLike, zoom: number } | undefined
// Last flyTo destination. Later camera moves (padding change, leaving overview) re-aim at it instead of
// cancelling the flight; cleared as soon as the user moves the map themselves.
let target: typeof view

const RESOLVED_HEX = '#AFAFAF'
const DOT_LAYERS = ['inc-dot']

const geojson = computed(() => ({
  type: 'FeatureCollection' as const,
  features: props.incidents.map(i => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [i.lng, i.lat] },
    properties: {
      id: i.id,
      count: i.reports.length,
      color: i.status === 'resuelto' ? RESOLVED_HEX : LEVEL[i.level].hex,
      active: i.status !== 'resuelto',
      critical: i.level === 'critica' && i.status === 'pendiente'
    }
  }))
}))

onMounted(async () => {
  const el = container.value!
  const style = await gotaMapStyle()
  map = new maplibregl.Map({
    container: el,
    style,
    center: [CITY_CENTER.lng, CITY_CENTER.lat],
    zoom: 14,
    attributionControl: { compact: true }
  })
  map.setPadding({ top: 0, right: 0, left: 0, bottom: 0, ...props.padding })
  if (props.overview) saveViewAndFit()
  // The thumbnail shrinks over a transition; keep refitting until it settles at its final size.
  map.on('resize', () => props.overview && fitOpen())
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

  map.on('load', () => {
    map.addSource('incidents', { type: 'geojson', data: geojson.value })
    const radius: ExpressionSpecification = ['interpolate', ['linear'], ['get', 'count'], 1, 7, 6, 14]
    map.addLayer({
      id: 'inc-halo',
      type: 'circle',
      source: 'incidents',
      filter: ['get', 'critical'],
      paint: { 'circle-color': ['get', 'color'], 'circle-opacity': 0.18, 'circle-radius': ['*', radius, 2.6] }
    })
    map.addLayer({
      id: 'inc-dot',
      type: 'circle',
      source: 'incidents',
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
      source: 'incidents',
      filter: ['==', ['get', 'id'], props.selectedId ?? ''],
      paint: {
        'circle-color': 'transparent',
        'circle-radius': ['+', radius, 5],
        'circle-stroke-color': '#002F59',
        'circle-stroke-width': 3
      }
    })
    map.addLayer({
      id: 'inc-count',
      type: 'symbol',
      source: 'incidents',
      filter: ['>', ['get', 'count'], 1],
      layout: { 'text-field': ['to-string', ['get', 'count']], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
      paint: { 'text-color': '#FFFFFF' }
    })
  })

  map.on('click', DOT_LAYERS, (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties?.id
    if (id && !props.picking) emit('select', id)
  })
  const cursor = (c: string) => () => (map.getCanvas().style.cursor = props.picking ? '' : c)
  map.on('mouseenter', DOT_LAYERS, cursor('pointer'))
  map.on('mouseleave', DOT_LAYERS, cursor(''))
  map.on('movestart', (e) => {
    moving.value = true
    if ('originalEvent' in e && e.originalEvent) target = undefined
  })
  map.on('moveend', () => {
    moving.value = false
    if (props.picking) emitCenter()
  })
})

onBeforeUnmount(() => map?.remove())

function saveViewAndFit() {
  view = { center: map.getCenter(), zoom: map.getZoom() }
  fitOpen()
}
function fitOpen() {
  const open = props.incidents.filter(i => i.status !== 'resuelto')
  if (!open.length) return
  const b = new maplibregl.LngLatBounds()
  for (const i of open) b.extend([i.lng, i.lat])
  map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 })
  map.fitBounds(b, { padding: 16, animate: false })
}
watch(() => props.overview, (on) => {
  if (!map) return
  if (on) saveViewAndFit()
  else if (target ?? view) map.jumpTo((target ?? view)!)
})

function emitCenter() {
  const c = map.getCenter()
  emit('center', { lat: c.lat, lng: c.lng })
}

watch(geojson, data => (map?.getSource('incidents') as GeoJSONSource | undefined)?.setData(data))
watch(() => props.selectedId, id => map?.getLayer('inc-selected') && map.setFilter('inc-selected', ['==', ['get', 'id'], id ?? '']))
watch(() => props.padding, p => p && !props.overview && map?.easeTo({ padding: { top: 0, right: 0, ...p }, ...target, duration: 300 }), { deep: true })
watch(() => props.picking, p => p && map && emitCenter())

function flyTo(pos: { lat: number, lng: number }, zoom = 16) {
  if (!map) return
  target = { center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), zoom) }
  map.flyTo({ ...target, duration: 800 })
}

defineExpose({ flyTo })
</script>

<template>
  <div
    class="relative size-full"
    :style="{ '--pad-left': `${padding?.left ?? 0}px`, '--pad-bottom': `${padding?.bottom ?? 0}px` }"
  >
    <div
      ref="container"
      class="size-full bg-[#F6F6F6]"
    />

    <!-- Center pin (Base "pickup" pattern): map moves, pin stays. -->
    <div
      v-if="picking"
      class="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
      :style="{ left: `calc(50% + ${(padding?.left ?? 0) / 2}px)`, top: `calc(50% - ${(padding?.bottom ?? 0) / 2}px)` }"
      aria-hidden="true"
    >
      <div
        class="flex flex-col items-center transition-transform duration-150"
        :class="moving ? '-translate-y-2' : ''"
      >
        <div class="grid size-9 place-items-center rounded-full bg-inverted text-gota-300 shadow-lg">
          <UIcon
            name="i-lucide-droplet"
            class="size-4"
          />
        </div>
        <div class="h-3 w-0.5 bg-inverted" />
      </div>
      <div class="mx-auto -mt-0.5 h-1.5 w-3 rounded-full bg-black/30 blur-[1px]" />
    </div>
  </div>
</template>
