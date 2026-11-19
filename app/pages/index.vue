<script setup lang="ts">
const { incidents, reports, setStatus, reset } = useReports()
const toast = useToast()
const map = useTemplateRef('map')

type Filter = 'activas' | Status
const filter = ref<Filter>('activas')
const selectedId = ref<string | null>(null)

const count = (s: Status) => incidents.value.filter(i => i.status === s).length
const tabs = computed(() => [
  { value: 'activas', label: 'Activas', badge: count('pendiente') + count('atencion') },
  { value: 'pendiente', label: 'Pendientes', badge: count('pendiente') },
  { value: 'atencion', label: 'En atención', badge: count('atencion') },
  { value: 'resuelto', label: 'Resueltas', badge: count('resuelto') }
])

const rows = computed(() => incidents.value.filter(i => filter.value === 'activas' ? i.status !== 'resuelto' : i.status === filter.value))
const selected = computed(() => incidents.value.find(i => i.id === selectedId.value))

const kpis = computed(() => [
  { label: 'Fugas críticas', value: incidents.value.filter(i => i.level === 'critica' && i.status === 'pendiente').length, hint: 'pendientes de asignar', icon: 'i-lucide-siren' },
  { label: 'Pendientes', value: count('pendiente'), hint: 'sin cuadrilla', icon: 'i-lucide-clock' },
  { label: 'En atención', value: count('atencion'), hint: 'cuadrillas en sitio', icon: 'i-lucide-hard-hat' },
  { label: 'Reportes ciudadanos', value: reports.value.length, hint: `agrupados en ${incidents.value.length} fugas`, icon: 'i-lucide-users' }
])

const NEXT: Partial<Record<Status, { to: Status, label: string, icon: string }>> = {
  pendiente: { to: 'atencion', label: 'Asignar cuadrilla', icon: 'i-lucide-hard-hat' },
  atencion: { to: 'resuelto', label: 'Marcar resuelta', icon: 'i-lucide-check' }
}

function advance(i: Incident) {
  const next = NEXT[i.status]
  if (!next) return
  const prev = i.status
  setStatus(i, next.to)
  toast.add({
    title: `${i.id} · ${STATUS[next.to].label}`,
    description: i.address,
    icon: next.icon,
    actions: [{ label: 'Deshacer', color: 'neutral', variant: 'outline', onClick: () => setStatus(i, prev) }]
  })
}

function select(id: string) {
  selectedId.value = id
  const i = selected.value
  if (i) map.value?.flyTo(i, 15)
}

function onReset() {
  reset()
  selectedId.value = null
  toast.add({ title: 'Datos de demostración restaurados', icon: 'i-lucide-rotate-ccw' })
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
      <div class="ms-auto flex items-center gap-1">
        <UTooltip text="Restaurar datos de demostración">
          <UButton
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="ghost"
            aria-label="Restaurar datos de demostración"
            @click="onReset"
          />
        </UTooltip>
        <UColorModeButton />
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
            <p class="mt-2 text-[32px] font-bold leading-none tracking-tight text-highlighted tabular-nums">
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
            />
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
                    class="hidden py-3 pl-6 font-medium xl:table-cell"
                    scope="col"
                  >
                    Abierta
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
                  v-for="(i, n) in rows"
                  :key="i.id"
                  class="cursor-pointer border-b border-default transition-colors last:border-0 hover:bg-muted"
                  :class="i.id === selectedId ? 'bg-muted' : ''"
                  :aria-selected="i.id === selectedId"
                  tabindex="0"
                  @click="select(i.id)"
                  @keydown.enter.self="select(i.id)"
                >
                  <td class="py-3 pl-4 pr-4 text-muted tabular-nums">
                    {{ n + 1 }}
                  </td>
                  <td class="py-3">
                    <div class="flex flex-col gap-1.5">
                      <UrgencyBadge :incident="i" />
                      <div class="h-1 w-24 overflow-hidden rounded-full bg-elevated">
                        <div
                          class="h-full rounded-full"
                          :style="{ width: `${i.urgency}%`, backgroundColor: i.status === 'resuelto' ? '#AFAFAF' : LEVEL[i.level].hex }"
                        />
                      </div>
                    </div>
                  </td>
                  <td class="max-w-0 py-3 pl-4 pr-6">
                    <p class="truncate font-medium text-highlighted">
                      {{ i.address ?? fmtCoords(i) }}
                    </p>
                    <p class="truncate text-muted">
                      {{ i.id }} · {{ SEVERITY[i.severity].label }}
                    </p>
                  </td>
                  <td class="hidden py-3 text-right font-medium text-highlighted tabular-nums md:table-cell">
                    {{ i.reports.length }}
                  </td>
                  <td class="hidden whitespace-nowrap py-3 pl-6 text-muted xl:table-cell">
                    {{ timeAgo(i.firstAt) }}
                  </td>
                  <td class="py-3 pl-6">
                    <UBadge
                      :color="STATUS[i.status].color"
                      variant="subtle"
                      :label="STATUS[i.status].label"
                      class="whitespace-nowrap"
                    />
                  </td>
                  <td class="py-3 pl-3 pr-4 text-right">
                    <UButton
                      v-if="NEXT[i.status]"
                      size="sm"
                      color="neutral"
                      :variant="i.status === 'pendiente' ? 'solid' : 'outline'"
                      :label="NEXT[i.status]!.label"
                      class="whitespace-nowrap"
                      @click.stop="advance(i)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <UEmpty
              v-if="!rows.length"
              icon="i-lucide-inbox"
              title="Sin fugas en esta vista"
              description="Cuando lleguen reportes aparecerán aquí."
              class="py-16"
            />
          </div>
        </section>
      </div>

      <!-- Map + detail -->
      <aside class="flex min-h-0 flex-col gap-4">
        <div class="h-72 shrink-0 overflow-hidden rounded-xl ring ring-default lg:h-auto lg:flex-1">
          <MapView
            ref="map"
            :incidents="rows"
            :selected-id="selectedId"
            @select="select"
          />
        </div>

        <section
          v-if="selected"
          class="max-h-[46%] shrink-0 space-y-4 overflow-y-auto rounded-xl bg-default p-4 ring ring-default"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-muted tabular-nums">
                {{ selected.id }} · {{ SEVERITY[selected.severity].label }}
              </p>
              <h2 class="truncate font-semibold text-highlighted">
                {{ selected.address ?? fmtCoords(selected) }}
              </h2>
            </div>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Cerrar detalle"
              @click="selectedId = null"
            />
          </div>

          <UButton
            v-if="NEXT[selected.status]"
            block
            color="neutral"
            :icon="NEXT[selected.status]!.icon"
            :label="NEXT[selected.status]!.label"
            @click="advance(selected)"
          />

          <ol class="space-y-3">
            <li
              v-for="r in [...selected.reports].reverse()"
              :key="r.id"
              class="flex gap-3"
            >
              <img
                v-if="r.photo"
                :src="r.photo"
                :alt="`Foto del reporte ${r.id}`"
                class="size-12 shrink-0 rounded-lg object-cover"
              >
              <SeverityIcon
                v-else
                :severity="r.severity"
                class="size-12!"
              />
              <div class="min-w-0 text-sm">
                <p class="font-medium text-highlighted">
                  {{ SEVERITY[r.severity].label }} <span class="font-normal text-muted">· {{ timeAgo(r.createdAt) }}</span>
                </p>
                <p class="truncate text-muted">
                  {{ r.note ?? r.address ?? r.id }}
                </p>
              </div>
            </li>
          </ol>
        </section>
      </aside>
    </main>
  </div>
</template>
