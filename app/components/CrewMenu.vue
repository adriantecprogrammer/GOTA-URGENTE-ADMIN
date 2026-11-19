<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Crew } from '~/services/admin'

const props = defineProps<{ crews: Crew[] }>()
const emit = defineEmits<{ pick: [crewId: number] }>()

const items = computed<DropdownMenuItem[]>(() => props.crews.length
  ? props.crews.map(c => ({ label: c.name, icon: 'i-lucide-hard-hat', onSelect: () => emit('pick', c.id) }))
  : [{ label: 'Sin cuadrillas activas', disabled: true }])
</script>

<template>
  <!-- Default slot is the trigger button. -->
  <UDropdownMenu :items="items">
    <slot />
  </UDropdownMenu>
</template>
