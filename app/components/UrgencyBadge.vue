<script setup lang="ts">
const props = defineProps<{ incident: Pick<Incident, 'urgency' | 'level' | 'status'>, size?: 'sm' | 'md' }>()
const hex = computed(() => props.incident.status === 'resuelto' ? '#AFAFAF' : LEVEL[props.incident.level].hex)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold text-highlighted tabular-nums"
    :class="size === 'md' ? 'h-7 px-3 text-sm' : 'h-6 px-2.5 text-xs'"
    :style="{ backgroundColor: `${hex}1F` }"
  >
    <span
      class="size-1.5 rounded-full"
      :style="{ backgroundColor: hex }"
    />
    {{ LEVEL[incident.level].label }} · {{ incident.urgency }}
  </span>
</template>
