import type { FetchError } from 'ofetch'

/** Every API error is `{ error: string }`, already written for the user. */
export interface ApiError { error: string }

export function apiErrorMessage(e: unknown, fallback = 'No se pudo conectar con el servidor') {
  return (e as FetchError<ApiError>)?.data?.error ?? fallback
}
