// Formato usado pelo app — camelCase. Único formato que componentes React conhecem.

export type FonteTipo = 'livre' | 'restrita'

export type Fonte = {
  id: string
  nome: string
  tipo: FonteTipo
  cor: string
  arquivada: boolean
  ehCartao: boolean
  limiteCentavos: number | null
  diaFatura: number | null
  /** M20 — só vem de `fontes` (não de v_saldo_fontes) */
  origem?: 'manual' | 'pluggy'
  pluggyAccountId?: string | null
  categoriasPermitidas?: string[] // ids, só quando tipo === 'restrita'
}

export type SaldoFonte = Fonte & {
  totalEntradasCentavos: number
  totalSaidasCentavos: number
  saldoCentavos: number
}

export type Categoria = {
  id: string
  nome: string
  limiteMensalCentavos: number | null
  vigenciaInicio: string
  cor: string
  arquivada: boolean
}

export type SaldoCategoria = Categoria & {
  mesesAtivos: number | null
  limiteAcumuladoCentavos: number | null
  totalGastoCentavos: number
  gastoMesAtualCentavos: number
  saldoDisponivelCentavos: number | null
}

export type Entrada = {
  id: string
  fonteId: string
  titulo: string
  valorCentavos: number
  data: string
  ehPagamentoFatura: boolean
  /** Observação livre (M24). */
  nota?: string | null
  /** Só em lançamentos vindos da Pluggy (M22). */
  chaveEstabelecimento?: string | null
  /** Apelido do estabelecimento; null quando não há ou o título foi editado (M22). */
  apelido?: string | null
  descricaoPluggy?: string | null
}

export type SaidaSplit = {
  fonteId: string
  valorCentavos: number
}

export type Saida = {
  id: string
  categoriaId: string
  titulo: string
  valorTotalCentavos: number
  data: string
  ehPagamentoFatura: boolean
  /** Observação livre (M24). */
  nota?: string | null
  splits: SaidaSplit[]
  /** Só em lançamentos vindos da Pluggy (M22). */
  chaveEstabelecimento?: string | null
  /** Apelido do estabelecimento; null quando não há ou o título foi editado (M22). */
  apelido?: string | null
  descricaoPluggy?: string | null
}

export type ApelidoEstabelecimento = {
  chave: string
  apelido: string
}

export type ResumoGeral = {
  saldoTotalCentavos: number
  saldoLivreCentavos: number
  saldoRestritoCentavos: number
}

export type ResultadoCriarSaida = {
  saidaId: string
  fontes: { fonteId: string; nome: string; tipo: FonteTipo; saldoCentavos: number }[]
  categoria: {
    categoriaId: string
    nome: string
    limiteMensalCentavos: number | null
    saldoDisponivelCentavos: number | null
    gastoMesAtualCentavos: number
  } | null
}

export type Recorrencia = {
  id: string
  titulo: string
  valorPrevistoCentavos: number
  dia: number
  categoriaId: string | null
  /** YYYY-MM */
  mesInicio: string
  totalParcelas: number | null
  ativa: boolean
  nota?: string | null
}

export type StatusRecorrencia = 'paga' | 'pendente' | 'atrasada'

export type RecorrenciaDoMes = {
  recorrenciaId: string
  titulo: string
  valorPrevistoCentavos: number
  dia: number
  categoriaId: string | null
  categoriaNome: string | null
  totalParcelas: number | null
  ativa: boolean
  /** YYYY-MM */
  competencia: string
  parcela: number
  pagamentoId: string | null
  pagoEm: string | null
  saidaId: string | null
  valorPagoCentavos: number | null
  nota: string | null
}

export type PluggyItem = {
  id: string
  itemId: string
  nome: string | null
  status: string | null
  executionStatus: string | null
  atualizadoNaPluggyEm: string | null
}

export type PluggyConta = {
  pluggyAccountId: string
  itemId: string
  nome: string
  tipo: 'BANK' | 'CREDIT'
  numero: string | null
  saldoCentavos: number
  limiteCentavos: number | null
  diaFatura: number | null
  dataCorte: string | null
  saldoInicialPendente: boolean
}

export type TransacaoImportada = {
  id: string
  pluggyAccountId: string
  fonteId: string | null
  data: string
  descricao: string
  valorCentavos: number
  direcao: 'entrada' | 'saida'
  statusPluggy: 'PENDING' | 'POSTED'
  parcela: number | null
  totalParcelas: number | null
  estado: 'pendente' | 'divergente'
  entradaId: string | null
  saidaId: string | null
  categoriaSugeridaId: string | null
  /** Parcela de compra anterior ao corte: já contada no saldo inicial (M21). */
  sugerirIgnorarParcela: boolean
  chaveEstabelecimento: string
  apelido: string | null
}

/** Débito na conta + crédito no cartão com o mesmo valor: pagamento de fatura (M21). */
export type ParPagamentoFatura = {
  bancoId: string
  cartaoId: string
  fontePagadoraId: string
  cartaoFonteId: string
  valorCentavos: number
  data: string
}

/** Saldo do app × saldo Pluggy de uma conta vinculada (M21). */
export type ConciliacaoConta = {
  pluggyAccountId: string
  fonteId: string
  saldoAppCentavos: number
  pendentesCentavos: number
  saldoPluggyCentavos: number
  /** pluggy − (app + pendentes); 0 = bate. */
  diferencaCentavos: number
  saldoInicialPendente: boolean
}

export type SugestaoRecorrencia = {
  transacaoId: string
  recorrenciaId: string
  titulo: string
  /** YYYY-MM */
  competencia: string
}

export type StatusIntegracao = {
  totalItens: number
  ultimaSincronizacaoEm: string | null
  ultimaSincronizacaoSucesso: boolean | null
  ultimaSincronizacaoErro: string | null
  ultimaSincronizacaoImportadas: number | null
  ultimaSincronizacaoOkEm: string | null
  itensComProblema: { itemId: string; nome: string | null; status: string }[]
}

export type FaturaPendente = {
  fonteId: string
  nome: string
  valorSugeridoCentavos: number
  diaFatura: number
}
