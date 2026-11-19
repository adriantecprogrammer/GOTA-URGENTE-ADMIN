<script setup lang="ts">
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre v6 looks for its worker next to the bundle chunk, where Vite never copies it; ?url emits it as an asset.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Leak } from '~/services/leaks'

maplibregl.setWorkerUrl(workerUrl)

const props = defineProps<{ leaks: Leak[], selectedId?: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()

const container = ref<HTMLDivElement>()
let map: maplibregl.Map

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
      critical: l.urgency_level === 'critica' && l.status === 'pendiente'
    }
  }))
}))

onMounted(async () => {
  map = new maplibregl.Map({
    container: container.value!,
    style: await gotaMapStyle(),
    center: [CITY_CENTER.lng, CITY_CENTER.lat],
    zoom: 14,
    attributionControl: { compact: true }
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

  map.on('load', () => {
    map.addSource('leaks', { type: 'geojson', data: geojson.value })
    const radius: ExpressionSpecification = ['interpolate', ['linear'], ['get', 'count'], 1, 7, 6, 14]
    map.addLayer({
      id: 'inc-halo',
      type: 'circle',
      source: 'leaks',
      filter: ['get', 'critical'],
      paint: { 'circle-color': ['get', 'color'], 'circle-opacity': 0.18, 'circle-radius': ['*', radius, 2.6] }
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
  map.on('mouseenter', DOT_LAYERS, () => (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', DOT_LAYERS, () => (map.getCanvas().style.cursor = ''))
})

onBeforeUnmount(() => map?.remove())

watch(geojson, data => (map?.getSource('leaks') as GeoJSONSource | undefined)?.setData(data))
watch(() => props.selectedId, id => map?.getLayer('inc-selected') && map.setFilter('inc-selected', ['==', ['get', 'id'], id ?? '']))

function flyTo(pos: { lat: number, lng: number }, zoom = 16) {
  map?.flyTo({ center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), zoom), duration: 800 })
}

defineExpose({ flyTo })
</script>

<template>
  <div
    ref="container"
    class="size-full bg-[#F6F6F6]"
  />
</template>
