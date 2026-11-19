<script setup lang="ts">
useSeoMeta({ title: 'Iniciar sesión · Panel operativo' })

const { login } = useAdminSession()
const email = ref('')
const password = ref('')
const error = ref<string>()
const sending = ref(false)

async function submit() {
  sending.value = true
  error.value = undefined
  try {
    await login(email.value, password.value)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <main class="grid min-h-dvh place-items-center bg-muted p-4">
    <form
      class="w-full max-w-sm space-y-6 rounded-2xl bg-default p-6 ring ring-default"
      @submit.prevent="submit"
    >
      <div class="space-y-3">
        <AppLogo />
        <h1 class="text-2xl font-bold tracking-tight text-highlighted">
          Panel operativo
        </h1>
      </div>

      <UFormField label="Correo">
        <UInput
          v-model="email"
          type="email"
          autocomplete="username"
          required
          class="w-full"
        />
      </UFormField>
      <UFormField label="Contraseña">
        <UInput
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="w-full"
        />
      </UFormField>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="error"
      />

      <UButton
        type="submit"
        block
        size="lg"
        color="primary"
        label="Entrar"
        :loading="sending"
      />
    </form>
  </main>
</template>
