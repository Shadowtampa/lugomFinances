// Formato usado pelo app — camelCase. Único formato que componentes React conhecem.

export type FonteTipo = 'livre' | 'restrita'

export type Fonte = {
  id: string
  nome: string
  tipo: FonteTipo
  cor: string
  arquivada: boolean
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
  recorrente: boolean
  diaRecorrencia: number | null
  recorrenciaAtiva: boolean
  templateId: string | null
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
  recorrente: boolean
  diaRecorrencia: number | null
  recorrenciaAtiva: boolean
  templateId: string | null
  splits: SaidaSplit[]
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

export type RecorrenciaPendente = {
  tipo: 'entrada' | 'saida'
  templateId: string
  titulo: string
  valorSugeridoCentavos: number
  diaRecorrencia: number | null
  fonteId: string | null
  categoriaId: string | null
}
