<script setup lang="ts">
const props = defineProps<{ incident: Pick<Incident, 'urgency' | 'level' | 'status'>, size?: 'md' | 'lg' }>()

// Filled = needs attention (crítica, alta). Everything else is a quiet outline, so colour keeps its meaning.
const QUIET = 'bg-default text-highlighted ring-1 ring-inset ring-accented'
const TONE: Record<Level, string> = { critica: 'bg-critica text-white', alta: 'bg-alta text-gota-950', media: QUIET, baja: QUIET }
const tone = computed(() => props.incident.status === 'resuelto' ? 'text-muted ring-1 ring-inset ring-accented' : TONE[props.incident.level])
</script>

<template>
  <span
    class="display grid shrink-0 place-items-center rounded-drop font-bold tabular-nums"
    :class="[tone, size === 'lg' ? 'size-14 text-2xl' : 'size-11 text-lg']"
  >
    <span class="sr-only">Urgencia</span>
    {{ incident.urgency }}
    <span class="sr-only">de 100, {{ LEVEL[incident.level].label }}</span>
  </span>
</template>
