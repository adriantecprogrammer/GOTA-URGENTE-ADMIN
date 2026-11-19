<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import type { AdminLeak, AdminLeakPatch } from '~/services/admin'
import type { Zone } from '~/services/zones'

useSeoMeta({ title: 'Panel operativo · Gota Urgente' })

const { $api } = useNuxtApp()
const { logout } = useAdminSession()
const { leaks: { data: leaks, error, refresh }, zones: { data: zones }, crews: { data: crews }, update, assignZone } = useAdminLeaks()
const { data: me } = useAsyncData('me', () => $api.admin.me())
const toast = useToast()
const map = useTemplateRef('map')

type Filter = 'activas' | Status
const filter = ref<Filter>('activas')
const selectedId = ref<string | null>(null)

const count = (s: Status) => leaks.value.filter(l => l.status === s).length
const tabs = computed(() => [
  { value: 'activas', label: 'Activas', count: count('pendiente') + count('en_atencion') },
  { value: 'pendiente', label: 'Pendientes', count: count('pendiente') },
  { value: 'en_atencion', label: 'En atención', count: count('en_atencion') },
  { value: 'resuelta', label: 'Resueltas', count: count('resuelta') },
  { value: 'descartada', label: 'Descartadas', count: count('descartada') }
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

const kpis = computed(() => [
  { label: 'Fugas críticas', value: leaks.value.filter(l => l.urgency_level === 'critica' && l.status === 'pendiente').length, hint: 'pendientes de asignar', icon: 'i-lucide-siren' },
  { label: 'Pendientes', value: count('pendiente'), hint: 'sin cuadrilla', icon: 'i-lucide-clock' },
  { label: 'En atención', value: count('en_atencion'), hint: 'cuadrillas en sitio', icon: 'i-lucide-hard-hat' },
  { label: 'Agua perdida', value: fmtLiters(Math.round(litersLive.value)), hint: `${fmtLiters(open.value.reduce((s, l) => s + l.liters_per_day, 0))} al día en fugas abiertas`, icon: 'i-lucide-droplets' }
])

/** Every change gets a toast with Deshacer, which re-PATCHes the previous values. */
async function act(leak: AdminLeak, patch: AdminLeakPatch) {
  const undo: AdminLeakPatch = {}
  if ('status' in patch) undo.status = leak.status
  if ('crew_id' in patch) undo.crew_id = leak.crew_id
  if ('severity' in patch) undo.severity = leak.max_severity
  try {
    const l = await update(leak.id, patch)
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
    toast.add({ title: `Cuadrilla asignada a ${r.updated} fugas`, description: crews.value.find(c => c.id === crewId)?.name, icon: 'i-lucide-hard-hat' })
  } catch (e) {
    fail(e)
  }
}

function fail(e: unknown) {
  toast.add({ title: 'No se pudo guardar el cambio', description: apiErrorMessage(e), color: 'error', icon: 'i-lucide-circle-alert' })
}

function select(id: string) {
  selectedId.value = id
  const l = selected.value
  if (l) map.value?.flyTo(l, 15)
}
</script>

<template>
  <div class="flex h-dvh flex-col bg-muted">
    <header class="flex h-16 shrink-0 items-center gap-4 border-b border-default bg-default px-4 lg:px-6">
      <NuxtLink
        to="/"
        aria-label="Gota Urgente, panel operativo"
      >
        <AppLogo />
      </NuxtLink>
      <USeparator
        orientation="vertical"
        class="h-6"
      />
      <span class="font-semibold text-highlighted">Panel operativo</span>
      <div class="ms-auto flex items-center gap-2">
        <span
          v-if="me"
          class="hidden text-sm text-muted sm:inline"
        >{{ me.name }}</span>
        <UButton
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          aria-label="Cerrar sesión"
          @click="logout"
        />
      </div>
    </header>

    <main class="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:overflow-hidden lg:p-6">
      <div class="flex min-h-0 flex-col gap-4">
        <!-- KPIs -->
        <ul class="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <li
            v-for="k in kpis"
            :key="k.label"
            class="rounded-xl bg-default p-4 ring ring-default"
          >
            <div class="flex items-center justify-between text-sm text-muted">
              {{ k.label }}
              <UIcon
                :name="k.icon"
                class="size-4"
              />
            </div>
            <p class="display mt-2 text-[32px] font-bold leading-none tracking-tight text-highlighted tabular-nums">
              {{ k.value }}
            </p>
            <p class="mt-1.5 text-xs text-muted">
              {{ k.hint }}
            </p>
          </li>
        </ul>

        <!-- Queue -->
        <section class="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl bg-default ring ring-default">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
            <div>
              <h1 class="text-lg font-bold tracking-tight text-highlighted">
                Cola de reparación
              </h1>
              <p class="text-sm text-muted">
                Ordenada por índice de urgencia, de mayor a menor
              </p>
            </div>
            <UTabs
              v-model="filter"
              :items="tabs"
              :content="false"
              color="neutral"
              size="sm"
            >
              <template #trailing="{ item }">
                <span class="tabular-nums opacity-60">{{ item.count }}</span>
              </template>
            </UTabs>
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            <table class="w-full text-left text-sm">
              <thead class="sticky top-0 z-10 bg-default text-xs font-medium uppercase tracking-wide text-muted shadow-[inset_0_-1px_0_var(--ui-border)]">
                <tr>
                  <th
                    class="py-3 pl-4 pr-4 font-medium"
                    scope="col"
                  >
                    #
                  </th>
                  <th
                    class="whitespace-nowrap py-3 pr-2 font-medium"
                    scope="col"
                  >
                    Urgencia
                  </th>
                  <th
                    class="w-full py-3 pl-4 font-medium"
                    scope="col"
                  >
                    Ubicación
                  </th>
                  <th
                    class="hidden py-3 text-right font-medium md:table-cell"
                    scope="col"
                  >
                    Reportes
                  </th>
                  <th
                    class="hidden whitespace-nowrap py-3 pl-6 font-medium xl:table-cell"
                    scope="col"
                  >
                    Cuadrilla
                  </th>
                  <th
                    class="py-3 pl-6 font-medium"
                    scope="col"
                  >
                    Estado
                  </th>
                  <th
                    class="py-3 pr-4"
                    scope="col"
                  >
                    <span class="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(l, n) in rows"
                  :key="l.id"
                  class="cursor-pointer border-b border-default transition-colors last:border-0 hover:bg-muted"
                  :class="l.id === selectedId ? 'bg-muted' : ''"
                  :aria-selected="l.id === selectedId"
                  tabindex="0"
                  @click="select(l.id)"
                  @keydown.enter.self="select(l.id)"
                >
                  <td class="py-3 pl-4 pr-4 text-muted tabular-nums">
                    {{ n + 1 }}
                  </td>
                  <td class="py-3">
                    <UrgencyScore :leak="l" />
                  </td>
                  <td class="max-w-0 py-3 pl-4 pr-6">
                    <p class="truncate font-medium text-highlighted">
                      {{ addressOf(l) ?? fmtCoords(l) }}
                    </p>
                    <p class="flex items-center gap-1.5 truncate text-muted">
                      {{ SEVERITY[l.max_severity].label }} · {{ fmtLiters(l.liters_wasted) }} · {{ timeAgo(Date.parse(l.first_reported_at)) }}
                      <UIcon
                        v-if="l.zone_size >= 3"
                        name="i-lucide-network"
                        class="size-3.5 shrink-0 text-error"
                        aria-label="En zona de falla conjunta"
                      />
                      <UIcon
                        v-if="l.is_recurrent"
                        name="i-lucide-history"
                        class="size-3.5 shrink-0 text-warning"
                        aria-label="Reincidente"
                      />
                    </p>
                  </td>
                  <td class="hidden py-3 text-right font-medium text-highlighted tabular-nums md:table-cell">
                    {{ l.report_count }}
                  </td>
                  <td class="hidden whitespace-nowrap py-3 pl-6 text-muted xl:table-cell">
                    {{ l.crew_name ?? '—' }}
                  </td>
                  <td class="py-3 pl-6">
                    <StatusSteps :status="l.status" />
                  </td>
                  <td
                    class="py-3 pl-3 pr-4 text-right"
                    @click.stop
                  >
                    <CrewMenu
                      v-if="l.status === 'pendiente'"
                      :crews="crews"
                      @pick="crew_id => act(l, { status: 'en_atencion', crew_id })"
                    >
                      <UButton
                        size="sm"
                        color="primary"
                        variant="subtle"
                        label="Asignar cuadrilla"
                        trailing-icon="i-lucide-chevron-down"
                        class="whitespace-nowrap"
                      />
                    </CrewMenu>
                    <UButton
                      v-else-if="l.status === 'en_atencion'"
                      size="sm"
                      color="neutral"
                      variant="outline"
                      label="Marcar resuelta"
                      class="whitespace-nowrap"
                      @click="act(l, { status: 'resuelta' })"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <UEmpty
              v-if="error"
              icon="i-lucide-cloud-off"
              title="No pudimos cargar las fugas"
              :description="apiErrorMessage(error)"
              :actions="[{ label: 'Reintentar', icon: 'i-lucide-refresh-cw', color: 'neutral', variant: 'soft', onClick: () => { refresh() } }]"
              class="py-16"
            />
            <UEmpty
              v-else-if="!rows.length"
              icon="i-lucide-inbox"
              title="Sin fugas en esta vista"
              description="Cuando lleguen reportes aparecerán aquí."
              class="py-16"
            />
          </div>
        </section>
      </div>

      <!-- Map + detail (or zones when nothing is selected) -->
      <aside class="flex min-h-0 flex-col gap-4">
        <div class="h-72 shrink-0 overflow-hidden rounded-xl ring ring-default lg:h-auto lg:flex-1">
          <MapView
            ref="map"
            :leaks="rows"
            :selected-id="selectedId"
            @select="select"
          />
        </div>

        <div class="shrink-0 overflow-y-auto lg:max-h-[55%]">
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
        </div>
      </aside>
    </main>
  </div>
</template>
