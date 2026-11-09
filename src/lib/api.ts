import { PostgrestClient } from '@supabase/postgrest-js'
import { sessaoAtual } from './auth'
import { env } from './env'

// Cliente único de dados (M17): só PostgREST, sem Supabase.
// Injeta o JWT da sessão atual em cada requisição. Componentes nunca importam isto:
// só a camada de serviços (src/services/*.ts).
function fetchComToken(entrada: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const sessao = sessaoAtual()
  if (sessao) headers.set('Authorization', `Bearer ${sessao.accessToken}`)
  // no-store: nunca reaproveitar GET do cache do navegador (dado velho após mutação).
  return fetch(entrada, { ...init, headers, cache: 'no-store' })
}

// URL absoluta: o PostgrestClient monta URLs com `new URL(...)`, que exige origem.
const base = new URL(env.apiUrl, window.location.origin).toString().replace(/\/$/, '')

export const db = new PostgrestClient(base, { fetch: fetchComToken })
