<script setup lang="ts">
import type { Crew, Sector } from '~/services/admin'

defineProps<{ crews: Crew[], sectors: Sector[] }>()
const emit = defineEmits<{ save: [id: number, patch: { sector_id?: number | null, max_active_leaks?: number }] }>()

// Reka selects can't hold null, so "sin zona" gets its own value.
const NONE = 'none'
</script>

<template>
  <ul class="space-y-2">
    <li
      v-for="c in crews"
      :key="c.id"
      class="space-y-2 rounded-lg bg-muted p-3"
    >
      <div class="flex items-baseline justify-between gap-2">
        <span class="font-medium text-highlighted">{{ c.name }}</span>
        <span
          class="text-sm tabular-nums"
          :class="c.saturated ? 'font-semibold text-error' : 'text-muted'"
        >{{ c.active_leaks }}/{{ c.max_active_leaks }} fugas</span>
      </div>
      <div class="grid grid-cols-[1fr_6rem] gap-2">
        <USelect
          :model-value="c.sector_id === null ? NONE : String(c.sector_id)"
          :items="[{ label: 'Sin zona (comodín)', value: NONE }, ...sectors.map(s => ({ label: s.name, value: String(s.id) }))]"
          aria-label="Zona"
          @update:model-value="v => emit('save', c.id, { sector_id: v === NONE ? null : Number(v) })"
        />
        <UInputNumber
          :model-value="c.max_active_leaks"
          :min="1"
          :max="50"
          aria-label="Capacidad"
          @update:model-value="v => v && v !== c.max_active_leaks && emit('save', c.id, { max_active_leaks: v })"
        />
      </div>
    </li>
  </ul>
</template>
