<script setup lang="ts">
import type { Leak } from '~/services/leaks'

const props = defineProps<{ leak: Pick<Leak, 'urgency_score' | 'urgency_level' | 'status'>, size?: 'md' | 'lg' }>()

// Filled = needs attention (crítica, alta). Everything else is a quiet outline, so colour keeps its meaning.
const QUIET = 'bg-default text-highlighted ring-1 ring-inset ring-accented'
const TONE: Record<Level, string> = { critica: 'bg-critica text-white', alta: 'bg-alta text-gota-950', media: QUIET, baja: QUIET }
const tone = computed(() => isOpen(props.leak.status) ? TONE[props.leak.urgency_level] : 'text-muted ring-1 ring-inset ring-accented')
</script>

<template>
  <span
    class="display grid shrink-0 place-items-center rounded-drop font-bold tabular-nums"
    :class="[tone, size === 'lg' ? 'size-14 text-2xl' : 'size-11 text-lg']"
  >
    <span class="sr-only">Urgencia</span>
    {{ leak.urgency_score }}
    <span class="sr-only">de 100, {{ LEVEL[leak.urgency_level].label }}</span>
  </span>
</template>
