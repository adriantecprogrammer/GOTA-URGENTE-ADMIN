/** Admin JWT. The API issues it for 12 h. */
export const useAdminToken = () =>
  useCookie<string | null>('gota_token', { maxAge: 60 * 60 * 12, sameSite: 'strict', default: () => null })

export function useAdminSession() {
  const token = useAdminToken()
  const { $api } = useNuxtApp()

  async function login(email: string, password: string) {
    token.value = (await $api.admin.login(email, password)).token
    await navigateTo('/')
  }

  async function logout() {
    token.value = null
    await navigateTo('/login')
  }

  return { token, login, logout }
}
