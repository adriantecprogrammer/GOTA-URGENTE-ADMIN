<script setup lang="ts">
defineProps<{ status: Status }>()
</script>

<template>
  <!-- Status as progress, not as a coloured pill: three drops that fill up. Colour stays reserved for urgency. -->
  <span class="inline-flex items-center gap-2.5 whitespace-nowrap font-medium text-highlighted">
    <span
      class="flex gap-1.5 px-0.5"
      aria-hidden="true"
    >
      <span
        v-for="n in 3"
        :key="n"
        class="size-2.5 rotate-45 rounded-drop"
        :class="n <= STATUS[status].step ? 'bg-primary' : 'bg-(--ui-border-accented)'"
      />
    </span>
    {{ STATUS[status].label }}
    <span class="sr-only">(paso {{ STATUS[status].step }} de 3)</span>
  </span>
</template>
