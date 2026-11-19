<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Crew } from '~/services/admin'

const props = defineProps<{ crews: Crew[], sectorId?: number | null, suggestedId?: number | null }>()
const emit = defineEmits<{ pick: [crewId: number] }>()

// Suggested first, then the zone's own crews, then the least loaded. Saturated ones stay pickable: the API only warns.
const rank = (c: Crew) => (c.id === props.suggestedId ? 0 : c.sector_id === props.sectorId ? 1 : 2)
const items = computed<DropdownMenuItem[]>(() => props.crews.length
  ? [...props.crews]
      .sort((a, b) => rank(a) - rank(b) || a.active_leaks / a.max_active_leaks - b.active_leaks / b.max_active_leaks)
      .map(c => ({
        label: c.id === props.suggestedId ? `${c.name} · sugerida` : c.name,
        description: `${c.active_leaks}/${c.max_active_leaks} fugas${c.sector_name ? ` · ${c.sector_name}` : ''}${c.saturated ? ' · saturada' : ''}`,
        icon: 'i-lucide-hard-hat',
        color: c.saturated ? 'error' : undefined,
        onSelect: () => emit('pick', c.id)
      }))
  : [{ label: 'Sin cuadrillas activas', disabled: true }])
</script>

<template>
  <!-- Default slot is the trigger button. -->
  <UDropdownMenu :items="items">
    <slot />
  </UDropdownMenu>
</template>
