// Formato cru do PostgREST — snake_case, espelha exatamente o schema do M2.
// Nenhum componente React deve importar deste arquivo.

export type FonteTipoRow = 'livre' | 'restrita'

export interface CategoriaRow {
  id: string
  user_id: string
  nome: string
  limite_mensal_centavos: number | null
  cor: string
  arquivada: boolean
  created_at: string
}

export interface FonteRow {
  id: string
  user_id: string
  nome: string
  tipo: FonteTipoRow
  cor: string
  arquivada: boolean
  eh_cartao: boolean
  limite_centavos: number | null
  dia_fatura: number | null
  origem: 'manual' | 'pluggy'
  pluggy_account_id: string | null
  created_at: string
}

export interface FonteCategoriaRow {
  fonte_id: string
  categoria_id: string
}

export interface EntradaRow {
  id: string
  user_id: string
  fonte_id: string
  titulo: string
  valor_centavos: number
  data: string
  eh_pagamento_fatura: boolean
  created_at: string
  nota: string | null
  /** Campos computados (M22), presentes quando pedidos no select. */
  chave_estabelecimento?: string | null
  apelido_estabelecimento?: string | null
  descricao_pluggy?: string | null
}

export interface SaidaSplitRow {
  id: string
  saida_id: string
  fonte_id: string
  valor_centavos: number
}

export interface SaidaRow {
  id: string
  user_id: string
  categoria_id: string
  titulo: string
  valor_total_centavos: number
  data: string
  eh_pagamento_fatura: boolean
  created_at: string
  nota: string | null
  saida_splits?: Pick<SaidaSplitRow, 'fonte_id' | 'valor_centavos'>[]
  /** Campos computados (M22), presentes quando pedidos no select. */
  chave_estabelecimento?: string | null
  apelido_estabelecimento?: string | null
  descricao_pluggy?: string | null
}

export interface ApelidoEstabelecimentoRow {
  id: string
  user_id: string
  chave: string
  apelido: string
  created_at: string
  updated_at: string
}

export interface SaldoFonteRow {
  fonte_id: string
  user_id: string
  nome: string
  tipo: FonteTipoRow
  cor: string
  arquivada: boolean
  total_entradas_centavos: number
  total_saidas_centavos: number
  saldo_centavos: number
  eh_cartao: boolean
  limite_centavos: number | null
  dia_fatura: number | null
}

export interface SaldoCategoriaRow {
  categoria_id: string
  user_id: string
  nome: string
  cor: string
  arquivada: boolean
  limite_mensal_centavos: number | null
  gasto_mes_atual_centavos: number
  saldo_disponivel_centavos: number | null
}

export interface ResumoGeralRow {
  user_id: string
  saldo_total_centavos: number
  saldo_livre_centavos: number
  saldo_restrito_centavos: number
}

export interface RecorrenciaRow {
  id: string
  user_id: string
  titulo: string
  valor_previsto_centavos: number
  dia: number
  categoria_id: string | null
  mes_inicio: string
  total_parcelas: number | null
  ativa: boolean
  nota: string | null
  created_at: string
}

export interface RecorrenciaMesRow {
  recorrencia_id: string
  user_id: string
  titulo: string
  valor_previsto_centavos: number
  dia: number
  categoria_id: string | null
  categoria_nome: string | null
  total_parcelas: number | null
  ativa: boolean
  competencia: string
  parcela: number
  pagamento_id: string | null
  pago_em: string | null
  saida_id: string | null
  valor_pago_centavos: number | null
  nota: string | null
}

export interface FaturaPendenteRow {
  fonte_id: string
  user_id: string
  nome: string
  valor_sugerido_centavos: number
  dia_fatura: number
}

export interface PluggyItemRow {
  id: string
  user_id: string
  item_id: string
  nome: string | null
  status: string | null
  execution_status: string | null
  atualizado_na_pluggy_em: string | null
  created_at: string
}

export interface PluggyContaRow {
  pluggy_account_id: string
  user_id: string
  item_id: string
  nome: string
  tipo: 'BANK' | 'CREDIT'
  numero: string | null
  saldo_centavos: number
  limite_centavos: number | null
  dia_fatura: number | null
  data_corte: string | null
  saldo_inicial_pendente_desde: string | null
  updated_at: string
}

export interface ImportadaPendenteRow {
  id: string
  user_id: string
  pluggy_transaction_id: string
  pluggy_account_id: string
  fonte_id: string | null
  data: string
  descricao: string
  valor_centavos: number
  direcao: 'entrada' | 'saida'
  status_pluggy: 'PENDING' | 'POSTED'
  categoria_pluggy: string | null
  parcela: number | null
  total_parcelas: number | null
  estado: 'pendente' | 'divergente'
  entrada_id: string | null
  saida_id: string | null
  categoria_sugerida_id: string | null
  data_compra: string | null
  sugerir_ignorar_parcela: boolean
  chave_estabelecimento: string
  apelido: string | null
}

export interface ParPagamentoFaturaRow {
  user_id: string
  banco_id: string
  cartao_id: string
  fonte_pagadora_id: string
  cartao_fonte_id: string
  valor_centavos: number
  data: string
  data_cartao: string
}

export interface ConciliacaoContaRow {
  user_id: string
  pluggy_account_id: string
  fonte_id: string
  saldo_app_centavos: number
  pendentes_centavos: number
  saldo_pluggy_centavos: number
  saldo_inicial_pendente: boolean
}

export interface SugestaoRecorrenciaRow {
  transacao_id: string
  user_id: string
  recorrencia_id: string
  titulo: string
  competencia: string
}

export interface StatusIntegracaoRow {
  user_id: string
  total_itens: number
  ultima_sincronizacao_em: string | null
  ultima_sincronizacao_sucesso: boolean | null
  ultima_sincronizacao_erro: string | null
  ultima_sincronizacao_importadas: number | null
  ultima_sincronizacao_ok_em: string | null
  itens_com_problema: { item_id: string; nome: string | null; status: string }[]
}

// Retorno de criar_saida / atualizar_saida (RPC)
export interface ResultadoCriarSaidaRow {
  saida_id: string
  fontes: {
    fonte_id: string
    nome: string
    tipo: FonteTipoRow
    saldo_centavos: number
  }[]
  categoria: {
    categoria_id: string
    nome: string
    limite_mensal_centavos: number | null
    saldo_disponivel_centavos: number | null
    gasto_mes_atual_centavos: number
  } | null
}
