<script setup lang="ts">
import type { Crew } from '~/services/admin'
import type { Zone } from '~/services/zones'

defineProps<{ zones: Zone[], crews: Crew[] }>()
const emit = defineEmits<{ assign: [zone: Zone, crewId: number], focus: [zone: Zone] }>()

const center = (z: Zone) => ({ lat: z.center_lat, lng: z.center_lng })
</script>

<template>
  <!-- ≥3 distinct leaks within 250 m: one crew, one trip, several leaks. -->
  <section class="space-y-3 p-5">
    <div>
      <h2 class="font-semibold text-highlighted">
        Zonas con falla conjunta
      </h2>
      <p class="text-sm text-muted">
        3 o más fugas a menos de 250 m: posible falla en la red primaria
      </p>
    </div>

    <ul
      v-if="zones.length"
      class="space-y-2"
    >
      <!-- zone_id changes on every request, so the key is the leak set. -->
      <li
        v-for="z in zones"
        :key="z.leak_ids.join()"
        class="space-y-3 rounded-lg bg-muted p-3"
      >
        <button
          type="button"
          class="block w-full text-left"
          @click="emit('focus', z)"
        >
          <span class="block truncate font-medium text-highlighted">{{ addressOf(center(z)) ?? fmtCoords(center(z)) }}</span>
          <span class="block text-sm text-muted tabular-nums">
            {{ z.leak_count }} fugas · {{ fmtLiters(z.liters_per_day) }}/día · urgencia máx. {{ z.max_urgency }}
          </span>
        </button>
        <CrewMenu
          :crews="crews"
          @pick="crewId => emit('assign', z, crewId)"
        >
          <UButton
            block
            size="sm"
            color="primary"
            variant="subtle"
            icon="i-lucide-hard-hat"
            label="Asignar una cuadrilla a toda la zona"
          />
        </CrewMenu>
      </li>
    </ul>
    <p
      v-else
      class="text-sm text-muted"
    >
      Sin zonas críticas por ahora.
    </p>
  </section>
</template>
