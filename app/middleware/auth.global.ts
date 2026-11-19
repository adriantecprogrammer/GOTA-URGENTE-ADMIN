// The whole dashboard needs the JWT; only /login is public.
export default defineNuxtRouteMiddleware((to) => {
  const loggedIn = !!useAdminToken().value
  if (to.path === '/login') return loggedIn ? navigateTo('/') : undefined
  if (!loggedIn) return navigateTo('/login')
})
