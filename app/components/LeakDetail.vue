<script setup lang="ts">
import type { AdminLeak, AdminLeakPatch, Crew } from '~/services/admin'

const props = defineProps<{ leak: AdminLeak, crews: Crew[] }>()
const emit = defineEmits<{ update: [patch: AdminLeakPatch], close: [] }>()

const severities = Object.entries(SEVERITY).map(([value, s]) => ({ value: value as Severity, label: s.label, icon: s.icon }))
const when = (iso: string | null) => iso ? timeAgo(Date.parse(iso)) : '—'
const open = computed(() => isOpen(props.leak.status))
</script>

<template>
  <section class="space-y-4 rounded-xl bg-default p-4 ring ring-default">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs text-muted uppercase tabular-nums">
          #{{ leak.id.slice(0, 8) }}
        </p>
        <h2 class="truncate font-semibold text-highlighted">
          {{ addressOf(leak) ?? fmtCoords(leak) }}
        </h2>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Cerrar detalle"
        @click="emit('close')"
      />
    </div>

    <div
      v-if="leak.is_recurrent || leak.zone_size >= 3"
      class="flex flex-wrap gap-2"
    >
      <UBadge
        v-if="leak.is_recurrent"
        color="warning"
        variant="subtle"
        icon="i-lucide-history"
        label="Reincidente: ya se había reparado aquí"
      />
      <UBadge
        v-if="leak.zone_size >= 3"
        color="error"
        variant="subtle"
        icon="i-lucide-network"
        :label="`Zona de ${leak.zone_size} fugas · posible falla en red primaria`"
      />
    </div>

    <!-- The photo justifies a "descartada". -->
    <img
      v-if="leak.photo_url"
      :src="leak.photo_url"
      alt="Foto más reciente de la fuga"
      class="aspect-video w-full rounded-lg object-cover"
    >

    <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <div>
        <dt class="text-muted">
          Urgencia
        </dt>
        <dd class="font-semibold text-highlighted">
          {{ leak.urgency_score }} · {{ LEVEL[leak.urgency_level].label }}
        </dd>
      </div>
      <div>
        <dt class="text-muted">
          Reportes
        </dt>
        <dd class="font-semibold text-highlighted">
          {{ leak.report_count }} <span class="font-normal text-muted">· {{ leak.confirmation_count }} confirmaciones</span>
        </dd>
      </div>
      <div>
        <dt class="text-muted">
          Agua perdida
        </dt>
        <dd class="font-semibold text-highlighted">
          {{ fmtLiters(leak.liters_wasted) }} <span class="font-normal text-muted">· {{ fmtLiters(leak.liters_per_day) }}/día</span>
        </dd>
      </div>
      <div>
        <dt class="text-muted">
          Cuadrilla
        </dt>
        <dd class="font-semibold text-highlighted">
          {{ leak.crew_name ?? 'Sin asignar' }}
        </dd>
      </div>
      <div>
        <dt class="text-muted">
          Reportada
        </dt>
        <dd>{{ when(leak.first_reported_at) }}</dd>
      </div>
      <div>
        <dt class="text-muted">
          {{ leak.resolved_at ? 'Cerrada' : 'Atendida' }}
        </dt>
        <dd>{{ when(leak.resolved_at ?? leak.attended_at) }}</dd>
      </div>
    </dl>

    <!-- Answers "¿y si alguien miente?": the admin corrects the severity. -->
    <UFormField label="Severidad">
      <USelect
        :model-value="leak.max_severity"
        :items="severities"
        class="w-full"
        @update:model-value="v => v !== leak.max_severity && emit('update', { severity: v as Severity })"
      />
    </UFormField>

    <div
      v-if="open"
      class="flex flex-col gap-2"
    >
      <CrewMenu
        v-if="leak.status === 'pendiente'"
        :crews="crews"
        @pick="crew_id => emit('update', { status: 'en_atencion', crew_id })"
      >
        <UButton
          block
          size="lg"
          color="primary"
          icon="i-lucide-hard-hat"
          trailing-icon="i-lucide-chevron-down"
          label="Asignar cuadrilla"
        />
      </CrewMenu>
      <template v-else>
        <UButton
          block
          size="lg"
          color="primary"
          icon="i-lucide-check"
          label="Marcar resuelta"
          @click="emit('update', { status: 'resuelta' })"
        />
        <CrewMenu
          :crews="crews"
          @pick="crew_id => emit('update', { crew_id })"
        >
          <UButton
            block
            color="neutral"
            variant="outline"
            icon="i-lucide-repeat"
            label="Cambiar cuadrilla"
          />
        </CrewMenu>
      </template>
      <UButton
        block
        color="error"
        variant="ghost"
        icon="i-lucide-ban"
        label="Descartar (reporte falso)"
        @click="emit('update', { status: 'descartada' })"
      />
    </div>
  </section>
</template>
