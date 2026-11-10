import type { ResumoPlanejamento, TipoPlanejamento } from '../types/domain'

/** Tipo pré-selecionado no formulário, em qualquer subseção (M29). */
export const TIPO_PADRAO_SLUG = 'contas'

/** Registros por requisição na lista de Planejamento (M29). */
export const PAGINA_PLANEJAMENTO = 10

export function tipoPorSlug(tipos: TipoPlanejamento[], slug: string | undefined) {
  return slug ? tipos.find((t) => t.slug === slug) : undefined
}

export function subtituloPlanejamento(tipo?: TipoPlanejamento): string {
  return `Planejamento Financeiro - ${tipo?.nome ?? 'Geral'}`
}

/** Soma o resumo de um Tipo; sem `tipoId`, de todos. */
export function resumoDoTipo(linhas: ResumoPlanejamento[], tipoId?: number) {
  return linhas
    .filter((l) => tipoId === undefined || l.tipoPlanejamentoId === tipoId)
    .reduce(
      (acc, l) => ({
        quantidade: acc.quantidade + l.quantidade,
        previstoCentavos: acc.previstoCentavos + l.previstoCentavos,
        pagoCentavos: acc.pagoCentavos + l.pagoCentavos,
        faltaCentavos: acc.faltaCentavos + l.faltaCentavos,
      }),
      { quantidade: 0, previstoCentavos: 0, pagoCentavos: 0, faltaCentavos: 0 },
    )
}
