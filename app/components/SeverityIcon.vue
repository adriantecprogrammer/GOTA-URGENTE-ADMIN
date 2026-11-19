<script setup lang="ts">
defineProps<{ severity: Severity }>()
</script>

<template>
  <span
    class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-highlighted"
    :title="SEVERITY[severity].label"
  >
    <UIcon
      :name="SEVERITY[severity].icon"
      class="size-5"
    />
  </span>
</template>
