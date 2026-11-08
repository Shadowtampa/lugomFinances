// Formato cru do PostgREST — snake_case, espelha exatamente o schema do M2.
// Nenhum componente React deve importar deste arquivo.

export type FonteTipoRow = 'livre' | 'restrita'

export interface CategoriaRow {
  id: string
  user_id: string
  nome: string
  limite_mensal_centavos: number | null
  vigencia_inicio: string
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
  saida_splits?: Pick<SaidaSplitRow, 'fonte_id' | 'valor_centavos'>[]
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
  meses_ativos: number | null
  limite_acumulado_centavos: number | null
  total_gasto_centavos: number
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
}

export interface FaturaPendenteRow {
  fonte_id: string
  user_id: string
  nome: string
  valor_sugerido_centavos: number
  dia_fatura: number
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
