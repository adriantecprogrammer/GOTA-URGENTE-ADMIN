<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AdminLeak, Crew } from '~/services/admin'

const props = defineProps<{ crews: Crew[] }>()
const emit = defineEmits<{ pick: [crewId: number] }>()

// Who is free is the first thing to know when assigning: read it from the leaks already on screen.
const { data: leaks } = useNuxtData<AdminLeak[]>('admin-leaks')
const busy = (id: number) => leaks.value?.filter(l => l.status === 'en_atencion' && Number(l.crew_id) === id).length ?? 0

const items = computed<DropdownMenuItem[]>(() => props.crews.length
  ? [...props.crews].sort((a, b) => busy(a.id) - busy(b.id)).map(c => ({
      label: c.name,
      description: busy(c.id) ? `${busy(c.id)} ${busy(c.id) === 1 ? 'fuga' : 'fugas'} en curso` : 'Libre',
      icon: 'i-lucide-hard-hat',
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
