import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'

const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron'

/** Prefer Spanish names, fall back to the local name. */
const NAME = ['coalesce', ['get', 'name:es'], ['get', 'name']]

const C = {
  land: '#F2F2F0',
  residential: '#ECECEA',
  park: '#E2EDE2',
  water: '#CDEBF7',
  waterway: '#A6DBF0',
  waterText: '#0278C0',
  building: '#E4E4E2',
  buildingLine: '#D8D8D6',
  road: '#FFFFFF',
  casing: '#DCDCDA',
  motorwayCasing: '#CFCFCD',
  path: '#E6E6E4',
  rail: '#DADAD8',
  text: '#5E5E5E',
  textStrong: '#2B2B2B',
  textSoft: '#8D8D8D',
  halo: '#FFFFFF'
}

type Patch = { paint?: Record<string, unknown>, layout?: Record<string, unknown> }
const halo = { 'text-halo-color': C.halo, 'text-halo-width': 1.5, 'text-halo-blur': 0 }

// Keyed by OpenFreeMap positron layer id. Unlisted layers keep positron's look.
const PATCH: Record<string, Patch> = {
  'background': { paint: { 'background-color': C.land } },
  'landuse_residential': { paint: { 'fill-color': C.residential } },
  'park': { paint: { 'fill-color': C.park } },
  'landcover_wood': { paint: { 'fill-color': C.park } },
  'water': { paint: { 'fill-color': C.water } },
  'waterway': { paint: { 'line-color': C.waterway } },
  'building': { paint: { 'fill-color': C.building, 'fill-outline-color': C.buildingLine } },
  'highway_path': { paint: { 'line-color': C.path } },
  'highway_minor': { paint: { 'line-color': C.road, 'line-opacity': 1 } },
  'highway_major_casing': { paint: { 'line-color': C.casing } },
  'highway_major_inner': { paint: { 'line-color': C.road } },
  'highway_major_subtle': { paint: { 'line-color': C.casing } },
  'highway_motorway_casing': { paint: { 'line-color': C.motorwayCasing } },
  'highway_motorway_inner': { paint: { 'line-color': C.road } },
  'highway_motorway_bridge_casing': { paint: { 'line-color': C.motorwayCasing } },
  'highway_motorway_bridge_inner': { paint: { 'line-color': C.road } },
  'tunnel_motorway_casing': { paint: { 'line-color': C.casing } },
  'railway': { paint: { 'line-color': C.rail } },
  'railway_transit': { paint: { 'line-color': C.rail } },
  'railway_service': { paint: { 'line-color': C.rail } },

  'highway-name-path': { paint: { 'text-color': C.textSoft, ...halo } },
  'highway-name-minor': { paint: { 'text-color': C.text, ...halo } },
  'highway-name-major': { paint: { 'text-color': C.text, ...halo } },
  'waterway_line_label': { layout: { 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': C.waterText, ...halo } },
  'water_name_point_label': { layout: { 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': C.waterText, ...halo } },
  'water_name_line_label': { layout: { 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': C.waterText, ...halo } },
  // Colonias: small caps-like, tracked out, quiet.
  'label_other': {
    layout: { 'text-font': ['Noto Sans Bold'], 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-size': 10 },
    paint: { 'text-color': C.textSoft, ...halo }
  },
  'label_village': { paint: { 'text-color': C.textStrong, ...halo } },
  'label_town': { paint: { 'text-color': C.textStrong, ...halo } },
  'label_city': { layout: { 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': C.textStrong, ...halo } },
  'label_state': { layout: { 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': C.textSoft, ...halo } },
  'airport': { paint: { 'text-color': C.text, ...halo } }
}

/** Layers that add noise at street level for this use case. */
const HIDE = new Set(['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us', 'railway_transit_dashline', 'railway_service_dashline', 'railway_dashline'])

export async function gotaMapStyle(): Promise<StyleSpecification> {
  const style = await $fetch<StyleSpecification>(BASE_STYLE)
  style.layers = style.layers
    .filter(l => !HIDE.has(l.id))
    .map((l) => {
      const p = PATCH[l.id]
      const layout = { ...(l as { layout?: object }).layout, ...p?.layout } as Record<string, unknown>
      if ('text-field' in layout && l.id !== 'airport') layout['text-field'] = NAME
      return { ...l, layout, paint: { ...(l as { paint?: object }).paint, ...p?.paint } } as LayerSpecification
    })
  return style
}
