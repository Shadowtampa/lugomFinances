import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type ApiError = {
  codigo: string // 'SALDO_INSUFICIENTE' | 'NETWORK' | 'UNAUTHORIZED' | 'UNKNOWN' ...
  mensagem: string // já pronta para exibir ao usuário
  detalhe?: string // texto cru, só para log
  status?: number
}

const CODIGOS_RPC_CONHECIDOS = new Set([
  'AUTH_REQUIRED',
  'CATEGORIA_INVALIDA',
  'SPLIT_SOMA_DIVERGENTE',
  'SPLIT_VAZIO',
  'FONTE_INVALIDA',
  'CATEGORIA_NAO_PERMITIDA_NA_FONTE',
  'SALDO_INSUFICIENTE',
  'SAIDA_INVALIDA',
])

const MENSAGENS: Record<string, string> = {
  AUTH_REQUIRED: 'Sua sessão expirou. Entre novamente.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
  NETWORK: 'Não foi possível conectar. Verifique sua internet.',
  CATEGORIA_INVALIDA: 'Categoria inválida.',
  SPLIT_SOMA_DIVERGENTE: 'A soma dos splits não bate com o valor total.',
  SPLIT_VAZIO: 'Informe pelo menos uma fonte.',
  FONTE_INVALIDA: 'Fonte inválida.',
  CATEGORIA_NAO_PERMITIDA_NA_FONTE: 'Essa fonte não aceita saídas dessa categoria.',
  SALDO_INSUFICIENTE: 'Saldo insuficiente nessa fonte.',
  SAIDA_INVALIDA: 'Saída não encontrada.',
  DUPLICADO: 'Já existe um registro com esse nome.',
  UNKNOWN: 'Algo deu errado. Tente novamente.',
}

function ehErroDeRede(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('Failed to fetch') ||
    error.name === 'TypeError' ||
    error.name === 'AuthRetryableFetchError'
  )
}

function normalizar(error: PostgrestError | Error, status?: number): ApiError {
  if (status === 401 || status === 403 || error.message === 'AUTH_REQUIRED') {
    void supabase.auth.signOut()
    return { codigo: 'UNAUTHORIZED', mensagem: MENSAGENS.UNAUTHORIZED, detalhe: error.message, status }
  }

  const code = 'code' in error ? error.code : undefined

  if (code === 'PGRST301') {
    void supabase.auth.signOut()
    return { codigo: 'UNAUTHORIZED', mensagem: MENSAGENS.UNAUTHORIZED, detalhe: error.message, status }
  }

  if (ehErroDeRede(error)) {
    return { codigo: 'NETWORK', mensagem: MENSAGENS.NETWORK, detalhe: error.message, status }
  }

  const prefixo = error.message.split(':')[0]?.trim()
  if (prefixo && CODIGOS_RPC_CONHECIDOS.has(prefixo)) {
    return { codigo: prefixo, mensagem: MENSAGENS[prefixo], detalhe: error.message, status }
  }

  if (code === '23505') {
    return { codigo: 'DUPLICADO', mensagem: MENSAGENS.DUPLICADO, detalhe: error.message, status }
  }

  return { codigo: 'UNKNOWN', mensagem: MENSAGENS.UNKNOWN, detalhe: error.message, status }
}

export function unwrap<T>(resultado: {
  data: T | null
  error: PostgrestError | null
  status?: number
}): T {
  if (resultado.error) {
    throw normalizar(resultado.error, resultado.status)
  }
  return resultado.data as T
}

export function mensagemDoErro(e: unknown): string {
  if (e && typeof e === 'object' && 'codigo' in e && 'mensagem' in e) {
    return (e as ApiError).mensagem
  }
  if (e instanceof Error) {
    return normalizar(e).mensagem
  }
  return MENSAGENS.UNKNOWN
}
