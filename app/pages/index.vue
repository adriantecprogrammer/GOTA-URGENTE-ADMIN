<script setup lang="ts">
import { useStorage, useIntervalFn, useMediaQuery, useNow, useTimeoutFn } from '@vueuse/core'
import type { AdminLeak, AdminLeakPatch, SectorMode, Warning } from '~/services/admin'
import type { Zone } from '~/services/zones'

useSeoMeta({ title: 'Panel operativo · Gota Urgente' })

const { $api } = useNuxtApp()
const { logout } = useAdminSession()
const { leaks: { data: leaks, error, refresh }, zones: { data: zones }, crews: { data: crews }, sectors: { data: sectors }, update, updateCrew, assignZone, realtime } = useAdminLeaks()
const { data: me } = useAsyncData('me', () => $api.admin.me())
const toast = useToast()

const LIVE: Record<RealtimeStatus, { label: string, dot: string }> = {
  'en-vivo': { label: 'En vivo', dot: 'bg-success animate-pulse' },
  'conectando': { label: 'Conectando…', dot: 'bg-(--ui-border-accented)' },
  'reconectando': { label: 'Reconectando…', dot: 'bg-warning' },
  'sin-mqtt': { label: 'Actualiza cada 10 s', dot: 'bg-(--ui-border-accented)' }
}

// The doorbell only says "something changed"; the toast points at it, the data still comes from the refetch.
// The leak it names also gets a ring on the map for a while, so it can be found without reading the toast.
const flashId = ref<string | null>(null)
const { start: fadeFlash } = useTimeoutFn(() => (flashId.value = null), 20_000, { immediate: false })
watch(realtime.lastEvent, (e) => {
  if (!e) return
  flashId.value = e.leak_id
  fadeFlash()
  toast.add({
    title: e.tipo === 'created' ? 'Nueva fuga reportada' : 'Una fuga recibió otra confirmación',
    icon: e.tipo === 'created' ? 'i-lucide-bell-ring' : 'i-lucide-users',
    actions: [{ label: 'Ver', color: 'neutral', variant: 'outline', onClick: () => showLeak(e.leak_id) }]
  })
})
const map = useTemplateRef('map')

type Filter = 'activas' | Status
const filter = ref<Filter>('activas')
const selectedId = ref<string | null>(null)

const count = (s: Status) => leaks.value.filter(l => l.status === s).length
const filters = computed(() => [
  { value: 'activas', label: `Activas · ${count('pendiente') + count('en_atencion')}` },
  { value: 'pendiente', label: `Pendientes · ${count('pendiente')}` },
  { value: 'en_atencion', label: `En atención · ${count('en_atencion')}` },
  { value: 'resuelta', label: `Resueltas · ${count('resuelta')}` },
  { value: 'descartada', label: `Descartadas · ${count('descartada')}` }
])

// The API already sorts by urgency, most urgent first.
const rows = computed(() => leaks.value.filter(l => filter.value === 'activas' ? isOpen(l.status) : l.status === filter.value))
const selected = computed(() => leaks.value.find(l => l.id === selectedId.value))

// Live liters counter: server total at fetch time + what open leaks have lost since, ticking every second.
const now = useNow({ scheduler: cb => useIntervalFn(cb, 1000) })
const fetchedAt = ref(Date.now())
watch(leaks, () => (fetchedAt.value = Date.now()))
const open = computed(() => leaks.value.filter(l => isOpen(l.status)))
const litersLive = computed(() => {
  const perDay = open.value.reduce((s, l) => s + l.liters_per_day, 0)
  return open.value.reduce((s, l) => s + l.liters_wasted, 0) + perDay * (now.value.getTime() - fetchedAt.value) / 864e5
})

const litersPerDay = computed(() => open.value.reduce((s, l) => s + l.liters_per_day, 0))
// Full digits, not compact: the point of this figure is to watch it tick.
const litersNow = computed(() => `${new Intl.NumberFormat('es-MX').format(Math.round(litersLive.value))} L`)

// The briefing: what an operator needs to decide the next dispatch.
const criticalUnassigned = computed(() => leaks.value.filter(l => l.urgency_level === 'critica' && l.status === 'pendiente').length)
const oldestPending = computed(() => {
  const times = leaks.value.filter(l => l.status === 'pendiente').map(l => Date.parse(l.first_reported_at))
  return times.length ? timeAgo(Math.min(...times)) : '—'
})

// Desktop: the map is the whole screen and the panels float over it, so the camera centers between them.
const desktop = useMediaQuery('(min-width: 1024px)', { ssrWidth: window.innerWidth })
// Operator can hide the queue to see the bare map (desktop only; on small screens the panels stack).
const hidden = ref(false)
const showQueue = computed(() => !desktop.value || !hidden.value)
const padding = computed(() => desktop.value
  ? { left: hidden.value ? 0 : 452, right: selectedId.value || zones.value.length ? 412 : 0 }
  : { left: 0, right: 0 })

/** Every change gets a toast with Deshacer, which re-PATCHes the previous values. */
async function act(leak: AdminLeak, patch: AdminLeakPatch) {
  const undo: AdminLeakPatch = {}
  if ('status' in patch) undo.status = leak.status
  if ('crew_id' in patch) undo.crew_id = leak.crew_id
  if ('severity' in patch) undo.severity = leak.max_severity
  try {
    const l = await update(leak.id, patch)
    warn(l.warnings)
    toast.add({
      title: patch.status ? `#${l.id.slice(0, 8)} · ${STATUS[l.status].label}` : 'Fuga actualizada',
      description: [l.crew_name, patch.severity && `Severidad: ${SEVERITY[l.max_severity].label}`].filter(Boolean).join(' · ') || undefined,
      icon: 'i-lucide-check',
      actions: [{ label: 'Deshacer', color: 'neutral', variant: 'outline', onClick: () => { update(leak.id, undo).catch(fail) } }]
    })
  } catch (e) {
    fail(e)
  }
}

async function onAssignZone(zone: Zone, crewId: number) {
  try {
    const r = await assignZone(zone.leak_ids, crewId)
    warn(r.warnings)
    toast.add({ title: `Cuadrilla asignada a ${r.updated} fugas`, description: crews.value.find(c => c.id === crewId)?.name, icon: 'i-lucide-hard-hat' })
  } catch (e) {
    fail(e)
  }
}

/** Assignment notices from the API (other zone, over capacity): shown, never blocking. */
const warn = (ws?: Warning[]) => ws?.forEach(w => toast.add({ title: w.message, color: 'warning', icon: 'i-lucide-triangle-alert' }))

const crewsOpen = ref(false)
const sectorMode = useStorage<SectorMode>('gota-admin:sectors', 'zona')
const SECTOR_MODES = [
  { value: 'off', label: 'Sin zonas', icon: 'i-lucide-eye-off' },
  { value: 'zona', label: 'Color por zona', icon: 'i-lucide-palette' },
  { value: 'carga', label: 'Carga de cuadrillas', icon: 'i-lucide-gauge' },
  { value: 'prioridad', label: 'Prioridad de la zona', icon: 'i-lucide-flag' }
]
async function saveCrew(id: number, patch: { sector_id?: number | null, max_active_leaks?: number }) {
  try {
    await updateCrew(id, patch)
  } catch (e) {
    fail(e)
  }
}

function fail(e: unknown) {
  toast.add({ title: 'No se pudo guardar el cambio', description: apiErrorMessage(e), color: 'error', icon: 'i-lucide-circle-alert' })
}

// From a realtime toast: the new leak is open, so make sure the queue shows it.
function showLeak(id: string) {
  filter.value = 'activas'
  select(id)
}

function select(id: string) {
  selectedId.value = id
  focusSelected()
}
function focusSelected() {
  const l = selected.value
  if (l) map.value?.flyTo(l, 16)
}
// A leak picked from a realtime toast can be selected before the refetch brings its data:
// the camera goes to it as soon as it exists. Keyed on the id so the periodic refetch doesn't re-centre the map.
watch(() => selected.value?.id, focusSelected)
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-default lg:relative lg:block lg:h-dvh lg:min-h-0 lg:overflow-hidden">
    <!-- Map: the whole screen on desktop. isolate keeps MapLibre's z-indexed controls under the panels. -->
    <div class="isolate h-[45dvh] shrink-0 lg:absolute lg:inset-0 lg:h-auto">
      <MapView
        ref="map"
        :sectors="sectors"
        :sector-mode="sectorMode"
        :leaks="rows"
        :zones="filter === 'resuelta' || filter === 'descartada' ? [] : zones"
        :selected-id="selectedId"
        :flash-id="flashId"
        :padding="padding"
        @select="select"
      />
    </div>

    <!-- Left: briefing + queue -->
    <section
      v-show="showQueue"
      class="flex min-h-0 flex-col bg-default lg:absolute lg:inset-y-4 lg:left-4 lg:w-[420px] lg:surface-float"
      aria-label="Cola de reparación"
    >
      <header class="flex items-center gap-3 px-5 pt-4">
        <AppLogo class="shrink-0 whitespace-nowrap" />
        <span
          class="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-muted"
          role="status"
        >
          <span
            class="size-2 rounded-full"
            :class="LIVE[realtime.status.value].dot"
            aria-hidden="true"
          />
          {{ LIVE[realtime.status.value].label }}
        </span>
        <span
          v-if="me"
          class="ms-auto hidden min-w-0 truncate text-sm text-muted sm:inline"
        >{{ me.name }}</span>
        <UButton
          v-if="me?.role === 'admin'"
          icon="i-lucide-hard-hat"
          color="neutral"
          variant="ghost"
          :class="me ? '' : 'ms-auto'"
          aria-label="Gestionar cuadrillas"
          @click="crewsOpen = true"
        />
        <UButton
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          :class="me ? '' : 'ms-auto'"
          aria-label="Cerrar sesión"
          @click="logout"
        />
      </header>

      <!-- Briefing: the three facts that decide the next dispatch. -->
      <div class="grid grid-cols-[auto_1fr] gap-x-6 px-5 pt-4">
        <div>
          <p
            class="display text-[32px] font-bold leading-none tabular-nums"
            :class="criticalUnassigned ? 'text-critica' : 'text-highlighted'"
          >
            {{ criticalUnassigned }}
          </p>
          <p class="mt-1.5 text-sm text-muted">
            críticas sin cuadrilla
          </p>
        </div>
        <div class="min-w-0">
          <p class="display truncate text-[32px] font-bold leading-none text-highlighted tabular-nums">
            {{ litersNow }}
          </p>
          <p class="mt-1.5 truncate text-sm text-muted">
            perdidos · {{ fmtLiters(litersPerDay) }} más cada día
          </p>
        </div>
      </div>
      <dl class="mx-5 mt-4 grid grid-cols-3 divide-x divide-default border-y border-default py-2.5 text-sm">
        <div class="pr-3">
          <dt class="text-muted">
            Sin asignar
          </dt>
          <dd class="font-semibold text-highlighted tabular-nums">
            {{ count('pendiente') }}
          </dd>
        </div>
        <div class="px-3">
          <dt class="text-muted">
            En atención
          </dt>
          <dd class="font-semibold text-highlighted tabular-nums">
            {{ count('en_atencion') }}
          </dd>
        </div>
        <div class="pl-3">
          <dt class="text-muted">
            Más antigua
          </dt>
          <dd class="truncate font-semibold text-highlighted">
            {{ oldestPending }}
          </dd>
        </div>
      </dl>

      <!-- Queue -->
      <div class="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <div>
          <h1 class="font-semibold text-highlighted">
            Cola de reparación
          </h1>
          <p class="text-sm text-muted">
            La más urgente primero
          </p>
        </div>
        <USelect
          v-model="filter"
          :items="filters"
          size="sm"
          color="neutral"
          variant="soft"
          aria-label="Filtrar por estado"
        />
      </div>

      <ul class="min-h-0 flex-1 overflow-y-auto">
        <li
          v-for="l in rows"
          :key="l.id"
          class="flex items-center gap-2 border-b border-default pr-3 transition-colors last:border-0 hover:bg-muted"
          :class="l.id === selectedId ? 'bg-muted' : ''"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 py-3 pl-5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            :aria-pressed="l.id === selectedId"
            @click="select(l.id)"
          >
            <UrgencyScore :leak="l" />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-highlighted">{{ addressOf(l) ?? fmtCoords(l) }}</span>
              <span class="flex items-center gap-1.5 text-sm text-muted">
                <span class="truncate">{{ l.crew_name ?? SEVERITY[l.max_severity].label }} · {{ fmtLiters(l.liters_per_day) }}/día · {{ timeAgo(Date.parse(l.first_reported_at)) }}</span>
                <UIcon
                  v-if="l.zone_size >= 3"
                  name="i-lucide-network"
                  class="size-3.5 shrink-0 text-critica"
                  aria-label="En zona de falla conjunta"
                />
                <UIcon
                  v-if="l.is_recurrent"
                  name="i-lucide-history"
                  class="size-3.5 shrink-0 text-alta"
                  aria-label="Reincidente"
                />
              </span>
            </span>
          </button>
          <!-- Quick actions; the labelled main action lives in the detail panel. -->
          <CrewMenu
            v-if="l.status === 'pendiente'"
            :crews="crews"
            @pick="crew_id => act(l, { status: 'en_atencion', crew_id })"
          >
            <UButton
              icon="i-lucide-hard-hat"
              color="primary"
              variant="subtle"
              aria-label="Asignar cuadrilla"
              title="Asignar cuadrilla"
            />
          </CrewMenu>
          <UButton
            v-else-if="l.status === 'en_atencion'"
            icon="i-lucide-check"
            color="neutral"
            variant="outline"
            aria-label="Marcar resuelta"
            title="Marcar resuelta"
            @click="act(l, { status: 'resuelta' })"
          />
        </li>
        <li v-if="error">
          <UEmpty
            icon="i-lucide-cloud-off"
            title="No pudimos cargar las fugas"
            :description="apiErrorMessage(error)"
            :actions="[{ label: 'Reintentar', icon: 'i-lucide-refresh-cw', color: 'neutral', variant: 'soft', onClick: () => { refresh() } }]"
            class="py-12"
          />
        </li>
        <li v-else-if="!rows.length">
          <UEmpty
            icon="i-lucide-inbox"
            title="Sin fugas en esta vista"
            description="Cuando lleguen reportes aparecerán aquí."
            class="py-12"
          />
        </li>
      </ul>
    </section>

    <UButton
      v-if="desktop"
      :icon="hidden ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
      color="neutral"
      variant="ghost"
      size="lg"
      class="surface-float absolute bottom-6 z-10 size-11 justify-center transition-[left] duration-300 motion-reduce:transition-none"
      :style="{ left: hidden ? '1rem' : '444px' }"
      :aria-label="hidden ? 'Mostrar la cola' : 'Ocultar la cola y ver todo el mapa'"
      :aria-expanded="!hidden"
      @click="hidden = !hidden"
    />

    <!-- What the service-zone layer paints. Desktop only: on phones the panels stack above the map. -->
    <USelect
      v-if="desktop"
      v-model="sectorMode"
      :items="SECTOR_MODES"
      icon="i-lucide-layers"
      aria-label="Capa de zonas de cuadrillas"
      class="surface-float absolute bottom-6 z-10 w-56 transition-[left] duration-300 motion-reduce:transition-none"
      :style="{ left: hidden ? '4.25rem' : '500px' }"
    />

    <!-- Right: the selected leak, or the joint-failure zones. Stops short of the bottom to leave the map controls free. -->
    <aside
      v-if="selected || zones.length"
      class="border-t border-default bg-default lg:absolute lg:right-4 lg:top-4 lg:max-h-[calc(100dvh-7.5rem)] lg:w-[380px] lg:overflow-y-auto lg:border-0 lg:surface-float"
    >
      <LeakDetail
        v-if="selected"
        :leak="selected"
        :crews="crews"
        @update="patch => act(selected!, patch)"
        @close="selectedId = null"
      />
      <ZonesPanel
        v-else
        :zones="zones"
        :crews="crews"
        @assign="onAssignZone"
        @focus="z => map?.flyTo({ lat: z.center_lat, lng: z.center_lng }, 16)"
      />
    </aside>

    <UModal
      v-model:open="crewsOpen"
      title="Cuadrillas"
      description="Zona y capacidad de cada cuadrilla"
    >
      <template #body>
        <CrewsPanel
          :crews="crews"
          :sectors="sectors"
          @save="saveCrew"
        />
      </template>
    </UModal>
  </div>
</template>
