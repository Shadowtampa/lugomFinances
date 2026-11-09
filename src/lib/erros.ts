import type { PostgrestError } from '@supabase/postgrest-js'
import { sair } from './auth'

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
  'LIMITE_CARTAO_EXCEDIDO',
  'CONTA_INVALIDA',
  'CONTA_JA_VINCULADA',
  'FONTE_JA_VINCULADA',
  'IMPORTADA_NAO_PENDENTE',
  'IMPORTADA_NAO_IGNORADA',
  'CONTA_NAO_VINCULADA',
  'CATEGORIA_OBRIGATORIA',
  'RECORRENCIA_JA_PAGA',
  'SINCRONIZACAO_EM_ANDAMENTO',
  'SINCRONIZACAO_INDISPONIVEL',
  'CORTE_INVALIDO',
  'CORTE_COM_CONFIRMADAS',
  'PAR_INVALIDO',
  'APELIDO_INVALIDO',
  'NOTA_INVALIDA',
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
  LIMITE_CARTAO_EXCEDIDO: 'Limite do cartão excedido.',
  CONTA_INVALIDA: 'Conta da Pluggy não encontrada.',
  CONTA_JA_VINCULADA: 'Essa conta já está vinculada a uma fonte.',
  FONTE_JA_VINCULADA: 'Essa fonte já está vinculada a outra conta.',
  IMPORTADA_NAO_PENDENTE: 'Essa transação já foi revisada.',
  IMPORTADA_NAO_IGNORADA: 'Essa transação não está ignorada.',
  CONTA_NAO_VINCULADA: 'Vincule a conta a uma fonte em Conexões antes de confirmar.',
  CATEGORIA_OBRIGATORIA: 'Escolha uma categoria.',
  RECORRENCIA_JA_PAGA: 'Essa recorrência já está paga neste mês.',
  SINCRONIZACAO_EM_ANDAMENTO: 'Sincronização em andamento. Aguarde terminar.',
  SINCRONIZACAO_INDISPONIVEL: 'O serviço de sincronização não respondeu.',
  CORTE_INVALIDO: 'A data de início não pode estar no futuro.',
  CORTE_COM_CONFIRMADAS: 'Já há transações confirmadas antes dessa data. Escolha uma data de início igual ou anterior à mais antiga delas.',
  PAR_INVALIDO: 'Esse pagamento de fatura já foi revisado.',
  APELIDO_INVALIDO: 'Apelido inválido: use até 60 caracteres.',
  NOTA_INVALIDA: 'A nota pode ter no máximo 500 caracteres.',
  ITEM_ID_INVALIDO: 'Item ID inválido: deve ser um UUID (ex.: 1a2b3c4d-…).',
  DUPLICADO: 'Já existe um registro com esse nome.',
  UNKNOWN: 'Algo deu errado. Tente novamente.',
}

function ehErroDeRede(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('Failed to fetch') ||
    error.name === 'TypeError'
  )
}

function normalizar(error: PostgrestError | Error, status?: number): ApiError {
  if (status === 401 || status === 403 || error.message === 'AUTH_REQUIRED') {
    sair()
    return { codigo: 'UNAUTHORIZED', mensagem: MENSAGENS.UNAUTHORIZED, detalhe: error.message, status }
  }

  const code = 'code' in error ? error.code : undefined

  if (code === 'PGRST301') {
    sair()
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

const MENSAGENS_SYNC: Record<string, string> = {
  PLUGGY_AUTH_FALHOU: 'credenciais da Pluggy recusadas',
  PLUGGY_INDISPONIVEL: 'Pluggy indisponível',
  PLUGGY_NAO_ENCONTRADO: 'recurso não encontrado na Pluggy',
  PLUGGY_REQUISICAO_INVALIDA: 'a Pluggy recusou a requisição (confira o Item ID)',
  ITEM_NAO_ENCONTRADO: 'conexão não encontrada na Pluggy (confira o Item ID)',
  ERRO_INTERNO: 'erro interno do sincronizador',
}

/** Texto do erro gravado em sincronizacoes.erro ("CODIGO: detalhe; ...") pronto para o usuário. */
export function mensagemErroSincronizacao(erro: string | null): string {
  if (!erro) return MENSAGENS_SYNC.ERRO_INTERNO
  const textos = erro.split(';').map((parte) => {
    const codigo = parte.split(':')[0]?.trim() ?? ''
    return MENSAGENS_SYNC[codigo] ?? MENSAGENS_SYNC.ERRO_INTERNO
  })
  return [...new Set(textos)].join(', ')
}

/** Erro de uma chamada que não passa pelo PostgREST (ex.: /sync do worker). */
export function erroDeCodigo(codigo: string, status?: number): ApiError {
  if (status === 401) return { codigo: 'UNAUTHORIZED', mensagem: MENSAGENS.UNAUTHORIZED, status }
  return { codigo, mensagem: MENSAGENS[codigo] ?? MENSAGENS.UNKNOWN, status }
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
