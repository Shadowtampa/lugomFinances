// M31 — Todas as fórmulas do Dashboard analítico. Funções puras, em centavos inteiros.
// Divisão por zero (ou base indisponível) devolve `null`, nunca NaN/Infinity.
// Componentes só desenham o que sai daqui.
import { deslocarMes, primeiroDiaDoMes, somarDias, ultimoDiaDoMes } from './date'

// ---------- períodos ----------

export type Periodo = { de: string; ate: string }

export const PRESETS_PERIODO = ['mes', 'mes-anterior', '3m', '6m', '12m', 'ano', 'custom'] as const
export type PresetPeriodo = (typeof PRESETS_PERIODO)[number]

export const ROTULOS_PRESET: Record<PresetPeriodo, string> = {
  mes: 'Mês atual',
  'mes-anterior': 'Mês anterior',
  '3m': 'Últimos 3 meses',
  '6m': 'Últimos 6 meses',
  '12m': 'Últimos 12 meses',
  ano: 'Ano atual',
  custom: 'Personalizado',
}

export function ehPreset(valor: string | null): valor is PresetPeriodo {
  return valor !== null && (PRESETS_PERIODO as readonly string[]).includes(valor)
}

function mesDe(iso: string): string {
  return iso.slice(0, 7)
}

/** Meses de calendário que o período toca (inclusive). */
export function mesesTocados(periodo: Periodo): string[] {
  const meses: string[] = []
  let ym = mesDe(periodo.de)
  const fim = mesDe(periodo.ate)
  while (ym <= fim) {
    meses.push(ym)
    ym = deslocarMes(ym, 1)
  }
  return meses
}

/** Dias de calendário do período, inclusive nas duas pontas. */
export function diasNoPeriodo(periodo: Periodo): number {
  const ms = Date.parse(`${periodo.ate}T12:00:00Z`) - Date.parse(`${periodo.de}T12:00:00Z`)
  return Math.round(ms / 86_400_000) + 1
}

/** Resolve o preset em datas. "Últimos N meses" = N meses terminando no mês atual, até hoje. */
export function resolverPeriodo(
  preset: PresetPeriodo,
  hoje: string,
  custom?: { de: string; ate: string },
): Periodo {
  const atual = mesDe(hoje)
  switch (preset) {
    case 'mes':
      return { de: primeiroDiaDoMes(atual), ate: hoje }
    case 'mes-anterior': {
      const ant = deslocarMes(atual, -1)
      return { de: primeiroDiaDoMes(ant), ate: ultimoDiaDoMes(ant) }
    }
    case '3m':
      return { de: primeiroDiaDoMes(deslocarMes(atual, -2)), ate: hoje }
    case '6m':
      return { de: primeiroDiaDoMes(deslocarMes(atual, -5)), ate: hoje }
    case '12m':
      return { de: primeiroDiaDoMes(deslocarMes(atual, -11)), ate: hoje }
    case 'ano':
      return { de: `${atual.slice(0, 4)}-01-01`, ate: hoje }
    case 'custom': {
      const de = custom?.de && custom.ate ? custom.de : primeiroDiaDoMes(atual)
      const ate = custom?.de && custom.ate ? custom.ate : hoje
      return de <= ate ? { de, ate } : { de: ate, ate: de }
    }
  }
}

/**
 * Janela do mesmo tamanho imediatamente antes do período.
 * Presets de meses: os mesmos N meses de calendário antes do primeiro mês tocado.
 * Personalizado: o mesmo número de dias antes de `de`.
 */
export function periodoAnterior(periodo: Periodo, preset: PresetPeriodo): Periodo {
  if (preset === 'custom') {
    const dias = diasNoPeriodo(periodo)
    return { de: somarDias(periodo.de, -dias), ate: somarDias(periodo.de, -1) }
  }
  const n = mesesTocados(periodo).length
  const primeiro = mesDe(periodo.de)
  return {
    de: primeiroDiaDoMes(deslocarMes(primeiro, -n)),
    ate: ultimoDiaDoMes(deslocarMes(primeiro, -1)),
  }
}

/** Lançamentos (ou somas por dia) dentro do período, inclusive nas duas pontas. */
export function filtrarPorPeriodo<T extends { data: string }>(itens: T[], periodo: Periodo): T[] {
  return itens.filter((i) => i.data >= periodo.de && i.data <= periodo.ate)
}

// ---------- variações e proporções ----------

/** parte / total × 100; total 0 → null. */
export function percentual(parte: number, total: number): number | null {
  return total === 0 ? null : (parte / total) * 100
}

/** Diferença em pontos percentuais (taxas); indisponível se alguma das pontas for. */
export function diferencaPontos(atual: number | null, anterior: number | null): number | null {
  return atual === null || anterior === null ? null : atual - anterior
}

export function variacaoAbsoluta(atual: number, anterior: number): number {
  return atual - anterior
}

/** (atual − anterior) / |anterior| × 100; anterior 0 → null. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : ((atual - anterior) / Math.abs(anterior)) * 100
}

// ---------- Visão geral ----------

export function saldoOperacional(entradas: number, saidas: number): number {
  return entradas - saidas
}

/** (E − S) / E × 100; sem Entradas → null. */
export function taxaEconomia(entradas: number, saidas: number): number | null {
  return percentual(entradas - saidas, entradas)
}

/** S / E × 100; sem Entradas → null. */
export function comprometimentoRenda(entradas: number, saidas: number): number | null {
  return percentual(saidas, entradas)
}

/** Patrimônio líquido = saldos das Fontes que não são cartão − dívida atual dos cartões. */
export function patrimonioLiquido(saldosNaoCartaoCentavos: number, dividaCartoesCentavos: number): number {
  return saldosNaoCartaoCentavos - dividaCartoesCentavos
}

/** total / quantidade, arredondado ao centavo; quantidade 0 → null. */
export function ticketMedio(totalCentavos: number, quantidade: number): number | null {
  return quantidade === 0 ? null : Math.round(totalCentavos / quantidade)
}

export function somaCentavos(itens: { totalCentavos: number }[]): number {
  return itens.reduce((acc, i) => acc + i.totalCentavos, 0)
}

// ---------- séries mensais ----------

export type PontoMensal = { mes: string; totalCentavos: number }

/** Soma por mês de calendário (YYYY-MM), incluindo meses sem lançamento como zero. */
export function somarPorMes(itens: { data: string; totalCentavos: number }[], meses: string[]): PontoMensal[] {
  const mapa = new Map<string, number>(meses.map((m) => [m, 0]))
  for (const i of itens) {
    const m = mesDe(i.data)
    if (mapa.has(m)) mapa.set(m, (mapa.get(m) ?? 0) + i.totalCentavos)
  }
  return meses.map((mes) => ({ mes, totalCentavos: mapa.get(mes) ?? 0 }))
}

/**
 * Meses exibidos nos gráficos de evolução: os do período; com menos de 2 meses, os 6 meses
 * que terminam no último mês do período.
 */
export function mesesDoGrafico(periodo: Periodo): string[] {
  const meses = mesesTocados(periodo)
  if (meses.length >= 2) return meses
  const ultimo = meses[meses.length - 1]
  return Array.from({ length: 6 }, (_, k) => deslocarMes(ultimo, k - 5))
}

// ---------- Categorias ----------

export type TotalCategoria = {
  categoriaId: string
  totalCentavos: number
  quantidade: number
}

export function agruparPorCategoria(
  somas: { categoriaId: string; totalCentavos: number; quantidade: number }[],
): TotalCategoria[] {
  const mapa = new Map<string, TotalCategoria>()
  for (const s of somas) {
    const atual = mapa.get(s.categoriaId) ?? { categoriaId: s.categoriaId, totalCentavos: 0, quantidade: 0 }
    atual.totalCentavos += s.totalCentavos
    atual.quantidade += s.quantidade
    mapa.set(s.categoriaId, atual)
  }
  return [...mapa.values()]
}

/** Ranking decrescente por total (empate: mais lançamentos primeiro, depois id, para ser estável). */
export function rankingCategorias(totais: TotalCategoria[]): TotalCategoria[] {
  return [...totais].sort(
    (a, b) =>
      b.totalCentavos - a.totalCentavos ||
      b.quantidade - a.quantidade ||
      a.categoriaId.localeCompare(b.categoriaId),
  )
}

/** Quanto as N maiores Categorias pesam no total de Saídas (%); total 0 → null. */
export function concentracaoTopN(totais: TotalCategoria[], n: number, totalSaidasCentavos: number): number | null {
  const topo = rankingCategorias(totais)
    .slice(0, n)
    .reduce((acc, t) => acc + t.totalCentavos, 0)
  return percentual(topo, totalSaidasCentavos)
}

export type CrescimentoCategoria = {
  categoriaId: string
  atualCentavos: number
  anteriorCentavos: number
  variacaoAbsolutaCentavos: number
  variacaoPercentual: number | null
}

/** Compara cada Categoria do período atual com o anterior (Categoria só no anterior entra com atual 0). */
export function crescimentoPorCategoria(atual: TotalCategoria[], anterior: TotalCategoria[]): CrescimentoCategoria[] {
  const ids = new Set([...atual.map((t) => t.categoriaId), ...anterior.map((t) => t.categoriaId)])
  const valor = (lista: TotalCategoria[], id: string) => lista.find((t) => t.categoriaId === id)?.totalCentavos ?? 0
  return [...ids].map((categoriaId) => {
    const a = valor(atual, categoriaId)
    const b = valor(anterior, categoriaId)
    return {
      categoriaId,
      atualCentavos: a,
      anteriorCentavos: b,
      variacaoAbsolutaCentavos: variacaoAbsoluta(a, b),
      variacaoPercentual: variacaoPercentual(a, b),
    }
  })
}

/** Maior crescimento em %: ignora Categoria sem base anterior e sem aumento. */
export function maiorCrescimentoPercentual(itens: CrescimentoCategoria[]): CrescimentoCategoria | null {
  const candidatos = itens.filter((i) => i.variacaoPercentual !== null && i.variacaoPercentual > 0)
  if (candidatos.length === 0) return null
  return candidatos.reduce((m, i) => ((i.variacaoPercentual ?? 0) > (m.variacaoPercentual ?? 0) ? i : m))
}

/** Maior aumento em centavos (só aumentos). */
export function maiorAumentoAbsoluto(itens: CrescimentoCategoria[]): CrescimentoCategoria | null {
  const candidatos = itens.filter((i) => i.variacaoAbsolutaCentavos > 0)
  if (candidatos.length === 0) return null
  return candidatos.reduce((m, i) => (i.variacaoAbsolutaCentavos > m.variacaoAbsolutaCentavos ? i : m))
}

// ---------- Planejado × realizado (limite mensal da Categoria) ----------

/** Limites das faixas, em % utilizado. Configuráveis aqui (constantes do código). */
export const FAIXAS_ORCAMENTO = { atencao: 70, proximo: 90, excedido: 100 } as const

export type FaixaOrcamento = 'dentro' | 'atencao' | 'proximo' | 'excedido'

export const ROTULOS_FAIXA: Record<FaixaOrcamento, string> = {
  dentro: 'Dentro do orçamento',
  atencao: 'Atenção',
  proximo: 'Próximo do limite',
  excedido: 'Orçamento excedido',
}

/** ≤70 dentro; >70 e ≤90 atenção; >90 e ≤100 próximo; >100 excedido. */
export function faixaOrcamento(percentualUtilizado: number): FaixaOrcamento {
  if (percentualUtilizado > FAIXAS_ORCAMENTO.excedido) return 'excedido'
  if (percentualUtilizado > FAIXAS_ORCAMENTO.proximo) return 'proximo'
  if (percentualUtilizado > FAIXAS_ORCAMENTO.atencao) return 'atencao'
  return 'dentro'
}

/** Planejado do período = limite mensal × meses que o período toca. */
export function planejadoDoPeriodo(limiteMensalCentavos: number, meses: number): number {
  return limiteMensalCentavos * meses
}

export type AvaliacaoOrcamento = {
  planejadoCentavos: number
  realizadoCentavos: number
  desvioAbsolutoCentavos: number
  desvioPercentual: number | null
  saldoDisponivelCentavos: number
  percentualUtilizado: number | null
  faixa: FaixaOrcamento | null
  excedida: boolean
}

export function avaliarOrcamento(planejadoCentavos: number, realizadoCentavos: number): AvaliacaoOrcamento {
  const percentualUtilizado = percentual(realizadoCentavos, planejadoCentavos)
  return {
    planejadoCentavos,
    realizadoCentavos,
    desvioAbsolutoCentavos: realizadoCentavos - planejadoCentavos,
    desvioPercentual: percentual(realizadoCentavos - planejadoCentavos, planejadoCentavos),
    saldoDisponivelCentavos: planejadoCentavos - realizadoCentavos,
    percentualUtilizado,
    faixa: percentualUtilizado === null ? null : faixaOrcamento(percentualUtilizado),
    excedida: realizadoCentavos > planejadoCentavos,
  }
}

export function contarExcedidas(itens: AvaliacaoOrcamento[]): number {
  return itens.filter((i) => i.excedida).length
}

export type ProjecaoOrcamento = {
  projecaoCentavos: number
  desvioProjetadoCentavos: number
  utilizacaoProjetada: number | null
}

/** Projeção de fechamento do mês: realizado / dias decorridos × dias do mês (estimativa). */
export function projetarFechamento(
  realizadoCentavos: number,
  planejadoCentavos: number,
  diasDecorridos: number,
  diasNoMes: number,
): ProjecaoOrcamento | null {
  if (diasDecorridos <= 0 || diasNoMes <= 0) return null
  const projecaoCentavos = Math.round((realizadoCentavos / diasDecorridos) * diasNoMes)
  return {
    projecaoCentavos,
    desvioProjetadoCentavos: projecaoCentavos - planejadoCentavos,
    utilizacaoProjetada: percentual(projecaoCentavos, planejadoCentavos),
  }
}

/** Dias do mês (YYYY-MM). */
export function diasDoMes(ym: string): number {
  return Number(ultimoDiaDoMes(ym).slice(8, 10))
}

/** Dia do mês de uma data (1–31): dias decorridos quando a data é hoje. */
export function diaDoMes(iso: string): number {
  return Number(iso.slice(8, 10))
}

// ---------- Cartões e meios de pagamento (M32) ----------

/** dívida / limite × 100; sem limite (ou limite 0) → null. Dívida negativa conta como zero. */
export function utilizacaoLimite(dividaCentavos: number, limiteCentavos: number | null): number | null {
  if (limiteCentavos === null) return null
  return percentual(Math.max(0, dividaCentavos), limiteCentavos)
}

export type TotalPorChave = { chave: string; totalCentavos: number; quantidade: number }

/** Soma por chave (instituição, Fonte...), maior total primeiro; empate pela chave, para ser estável. */
export function somarPorChave(itens: { chave: string; valorCentavos: number }[]): TotalPorChave[] {
  const mapa = new Map<string, TotalPorChave>()
  for (const i of itens) {
    const atual = mapa.get(i.chave) ?? { chave: i.chave, totalCentavos: 0, quantidade: 0 }
    atual.totalCentavos += i.valorCentavos
    atual.quantidade += 1
    mapa.set(i.chave, atual)
  }
  return [...mapa.values()].sort((a, b) => b.totalCentavos - a.totalCentavos || a.chave.localeCompare(b.chave))
}

/** A maior compra (maior valor); lista vazia → null. */
export function maiorCompra<T extends { valorCentavos: number }>(itens: T[]): T | null {
  if (itens.length === 0) return null
  return itens.reduce((m, i) => (i.valorCentavos > m.valorCentavos ? i : m))
}

/** Fatura média dos últimos `n` meses que tiveram fatura paga (meses sem pagamento não entram). */
export function faturaMedia(pontos: PontoMensal[], n = 6): { mediaCentavos: number | null; meses: number } {
  const com = [...pontos]
    .filter((p) => p.totalCentavos > 0)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .slice(-n)
  if (com.length === 0) return { mediaCentavos: null, meses: 0 }
  const soma = com.reduce((acc, p) => acc + p.totalCentavos, 0)
  return { mediaCentavos: Math.round(soma / com.length), meses: com.length }
}

export type CompromissoMes = {
  mes: string
  cartaoCentavos: number
  planejamentoCentavos: number
  totalCentavos: number
}

/**
 * Compromissos futuros por mês de vencimento, de `mesInicial` por `nMeses`: parcelas restantes
 * de compras no cartão + competências não pagas de Planejamentos parcelados. Não é dívida.
 */
export function compromissosFuturos(
  parcelasCartao: { restantes: number; valorParcelaCentavos: number; proximoMes: string }[],
  planejamentos: { competencia: string; valorPrevistoCentavos: number }[],
  mesInicial: string,
  nMeses = 12,
): CompromissoMes[] {
  const meses = Array.from({ length: nMeses }, (_, k) => deslocarMes(mesInicial, k))
  const cartao = new Map<string, number>()
  for (const p of parcelasCartao) {
    for (let k = 0; k < p.restantes; k++) {
      const mes = deslocarMes(p.proximoMes, k)
      cartao.set(mes, (cartao.get(mes) ?? 0) + p.valorParcelaCentavos)
    }
  }
  const plano = new Map<string, number>()
  for (const p of planejamentos) {
    const mes = p.competencia.slice(0, 7)
    plano.set(mes, (plano.get(mes) ?? 0) + p.valorPrevistoCentavos)
  }
  return meses.map((mes) => {
    const c = cartao.get(mes) ?? 0
    const pl = plano.get(mes) ?? 0
    return { mes, cartaoCentavos: c, planejamentoCentavos: pl, totalCentavos: c + pl }
  })
}

export function totalCompromissos(lista: CompromissoMes[]): number {
  return lista.reduce((acc, m) => acc + m.totalCentavos, 0)
}

// ---------- Comportamento financeiro (M33) ----------

/** Período até hoje: o que ainda não aconteceu não conta como dia decorrido. */
export function periodoDecorrido(periodo: Periodo, hoje: string): Periodo | null {
  if (periodo.de > hoje) return null
  return { de: periodo.de, ate: periodo.ate < hoje ? periodo.ate : hoje }
}

/** Dias decorridos (DI) do período, até hoje; período inteiro no futuro → 0. */
export function diasDecorridos(periodo: Periodo, hoje: string): number {
  const p = periodoDecorrido(periodo, hoje)
  return p ? diasNoPeriodo(p) : 0
}

/** total / dias, arredondado ao centavo; 0 dias → null. */
export function gastoMedioDiario(totalCentavos: number, dias: number): number | null {
  return dias <= 0 ? null : Math.round(totalCentavos / dias)
}

/** Lançamentos por dia; 0 dias → null. */
export function frequenciaCompras(quantidade: number, dias: number): number | null {
  return dias <= 0 ? null : quantidade / dias
}

export type GastoDia = { data: string; totalCentavos: number }

/** Uma linha por dia do período (inclusive), com zero nos dias sem Saída. */
export function gastoPorDia(itens: { data: string; valorCentavos: number }[], periodo: Periodo): GastoDia[] {
  const mapa = new Map<string, number>()
  for (const i of itens) mapa.set(i.data, (mapa.get(i.data) ?? 0) + i.valorCentavos)
  const dias: GastoDia[] = []
  for (let d = periodo.de; d <= periodo.ate; d = somarDias(d, 1)) {
    dias.push({ data: d, totalCentavos: mapa.get(d) ?? 0 })
  }
  return dias
}

/** Dia de maior gasto (empate: o mais antigo); sem gasto nenhum → null. */
export function diaMaiorGasto(dias: GastoDia[]): GastoDia | null {
  let melhor: GastoDia | null = null
  for (const d of dias) {
    if (d.totalCentavos > 0 && (melhor === null || d.totalCentavos > melhor.totalCentavos)) melhor = d
  }
  return melhor
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay()
}

export type GastoDiaSemana = {
  dia: number
  totalCentavos: number
  ocorrencias: number
  mediaCentavos: number | null
}

/** Total por dia da semana e média por ocorrência do dia (ocorrências = dias do período com esse dia). */
export function gastoPorDiaDaSemana(dias: GastoDia[]): GastoDiaSemana[] {
  const base: GastoDiaSemana[] = Array.from({ length: 7 }, (_, dia) => ({
    dia,
    totalCentavos: 0,
    ocorrencias: 0,
    mediaCentavos: null,
  }))
  for (const d of dias) {
    const alvo = base[diaDaSemana(d.data)]
    alvo.totalCentavos += d.totalCentavos
    alvo.ocorrencias += 1
  }
  for (const b of base) b.mediaCentavos = b.ocorrencias === 0 ? null : Math.round(b.totalCentavos / b.ocorrencias)
  return base
}

/** Intensidade do calendário de calor: gasto do dia ÷ maior gasto diário × 100; sem gasto → null. */
export function intensidadeNormalizada(totalCentavos: number, maiorCentavos: number): number | null {
  return percentual(totalCentavos, maiorCentavos)
}

export function maiorGastoDiario(dias: GastoDia[]): number {
  return dias.reduce((m, d) => Math.max(m, d.totalCentavos), 0)
}

export type TicketMes = { mes: string; totalCentavos: number; quantidade: number; ticketCentavos: number | null }

/** Total, quantidade e ticket médio por mês (mês sem Saída: ticket indisponível). */
export function ticketMedioPorMes(itens: { data: string; valorCentavos: number }[], meses: string[]): TicketMes[] {
  const mapa = new Map<string, { total: number; qtd: number }>(meses.map((m) => [m, { total: 0, qtd: 0 }]))
  for (const i of itens) {
    const alvo = mapa.get(mesDe(i.data))
    if (alvo) {
      alvo.total += i.valorCentavos
      alvo.qtd += 1
    }
  }
  return meses.map((mes) => {
    const { total, qtd } = mapa.get(mes) ?? { total: 0, qtd: 0 }
    return { mes, totalCentavos: total, quantidade: qtd, ticketCentavos: ticketMedio(total, qtd) }
  })
}

export type Estabelecimento = {
  chave: string
  nome: string
  totalCentavos: number
  quantidade: number
  ticketCentavos: number | null
}

/** Agrupa por estabelecimento; o nome exibido é o da maior Saída do grupo. Maior total primeiro. */
export function rankingEstabelecimentos(
  itens: { chave: string; nome: string; valorCentavos: number }[],
): Estabelecimento[] {
  const mapa = new Map<string, Estabelecimento & { maior: number }>()
  for (const i of itens) {
    const atual = mapa.get(i.chave) ?? {
      chave: i.chave,
      nome: i.nome,
      totalCentavos: 0,
      quantidade: 0,
      ticketCentavos: null,
      maior: -1,
    }
    atual.totalCentavos += i.valorCentavos
    atual.quantidade += 1
    if (i.valorCentavos > atual.maior) {
      atual.maior = i.valorCentavos
      atual.nome = i.nome
    }
    mapa.set(i.chave, atual)
  }
  return [...mapa.values()]
    .map(({ maior: _maior, ...e }) => ({ ...e, ticketCentavos: ticketMedio(e.totalCentavos, e.quantidade) }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos || a.chave.localeCompare(b.chave))
}
