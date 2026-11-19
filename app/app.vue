<script setup lang="ts">
import { es } from '@nuxt/ui/locale'

useHead({
  htmlAttrs: { lang: 'es-MX' },
  link: [{ rel: 'icon', href: '/favicon.ico' }]
})
useSeoMeta({
  title: 'Panel operativo · Gota Urgente',
  description: 'Cola de reparación de fugas priorizada por urgencia.'
})
</script>

<template>
  <UApp
    :locale="es"
    :toaster="{ position: 'top-center' }"
  >
    <NuxtPage />
  </UApp>
</template>
