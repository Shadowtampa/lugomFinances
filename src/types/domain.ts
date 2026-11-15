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
  cor: string
  arquivada: boolean
}

export type SaldoCategoria = Categoria & {
  /** Gasto do mês corrente (sem lançamentos futuros). RN-05: o limite não acumula. */
  gastoMesAtualCentavos: number
  saldoDisponivelCentavos: number | null
}

export type GrupoOrcamentario = 'essenciais' | 'prioridades' | 'estilo_de_vida'

export type CategoriaGrupo = {
  categoriaId: string
  grupo: GrupoOrcamentario
}

export type AdesaoMetodo = {
  totalEntradasMesCentavos: number
  gastoEssenciaisCentavos: number
  gastoPrioridadesCentavos: number
  gastoEstiloDeVidaCentavos: number
  gastoNaoClassificadoCentavos: number
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

/** Vínculo 1:1 entre uma Saída e uma competência de recorrência (M28). Não afeta saldo. */
export type VinculoRecorrencia = {
  recorrenciaId: string
  /** YYYY-MM */
  competencia: string
  /** Título da recorrência; só na leitura. */
  titulo?: string
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
  /** Competência de recorrência que esta Saída quita (M28). */
  recorrencia?: VinculoRecorrencia | null
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
  formaPagamento: FormaPagamento
  nota?: string | null
  /** Meio de pagamento previsto (M27): ids de Fonte, só autocontrole. */
  fontesPrevistas?: string[]
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
  fontesPrevistas: string[]
  /** Saída ligada (M28), quando paga por um lançamento. */
  saidaTitulo: string | null
  saidaData: string | null
  formaPagamento: FormaPagamento
}

/** Forma de pagamento de um Planejamento (M30): manual = o usuário transfere; automática = cartão/débito. */
export type FormaPagamento = 'manual' | 'automatica'

/** Pago / previsto / falta de uma competência (YYYY-MM) por forma de pagamento e duração. */
export type ResumoPlanejamento = {
  competencia: string
  formaPagamento: FormaPagamento
  /** true = recorrente (sem parcelas); false = parcelado. */
  recorrente: boolean
  quantidade: number
  previstoCentavos: number
  pagoCentavos: number
  faltaCentavos: number
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

/** Soma de Saídas num dia para uma Categoria (M31). */
export type SomaSaidaDia = {
  data: string
  categoriaId: string
  totalCentavos: number
  quantidade: number
}

/** Soma de Entradas num dia para uma Fonte (M31). */
export type SomaEntradaDia = {
  data: string
  fonteId: string
  totalCentavos: number
  quantidade: number
}

/** Parcela de uma Saída numa Fonte (M32): o split, já sem fatura/saldo inicial/futuros. */
export type SaidaNaFonte = {
  saidaId: string
  data: string
  fonteId: string
  categoriaId: string
  titulo: string
  valorCentavos: number
}

/** Pagamentos de fatura de um cartão num mês (M32). `mes` = YYYY-MM. */
export type PagamentoFaturaMes = {
  fonteId: string
  mes: string
  totalCentavos: number
}

/** Parcelas que ainda vão vencer numa compra no cartão (M32). `proximoMes` = YYYY-MM. */
export type ParcelaCartaoRestante = {
  fonteId: string
  descricao: string
  parcela: number
  totalParcelas: number
  restantes: number
  valorParcelaCentavos: number
  proximoMes: string
}

/** Competência de Planejamento parcelado ainda não paga (M32). `competencia` = YYYY-MM-DD. */
export type ParcelaPlanejamentoFutura = {
  titulo: string
  competencia: string
  valorPrevistoCentavos: number
}

/** Uma Saída para a análise de comportamento (M33). `chave` agrupa o estabelecimento. */
export type SaidaLancamento = {
  saidaId: string
  data: string
  chave: string
  nome: string
  valorCentavos: number
}
