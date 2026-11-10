import type { FormaPagamento, ResumoPlanejamento } from '../types/domain'

/** Forma de pagamento pré-selecionada no formulário (M30). */
export const FORMA_PADRAO: FormaPagamento = 'manual'

/** Registros por requisição na lista de Planejamento (M29). */
export const PAGINA_PLANEJAMENTO = 10

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  manual: 'Manual',
  automatica: 'Automática',
}

/** Subseções da aba: slug na URL ↔ forma de pagamento. A Geral não tem slug. */
const SLUG_DA_FORMA: Record<FormaPagamento, string> = { manual: 'manuais', automatica: 'automaticas' }
const NOME_DA_SUBSECAO: Record<FormaPagamento, string> = { manual: 'Manuais', automatica: 'Automáticas' }

export const SUBSECOES: { forma: FormaPagamento; slug: string; nome: string }[] = (
  ['manual', 'automatica'] as FormaPagamento[]
).map((forma) => ({ forma, slug: SLUG_DA_FORMA[forma], nome: NOME_DA_SUBSECAO[forma] }))

/** Links das subseções (sidebar no desktop, chips no mobile): Geral + Manuais + Automáticas. */
export const LINKS_SUBSECOES = [
  { to: '/recorrencias', label: 'Geral' },
  ...SUBSECOES.map((s) => ({ to: `/recorrencias/${s.slug}`, label: s.nome })),
]

export function slugDaForma(forma: FormaPagamento): string {
  return SLUG_DA_FORMA[forma]
}

export function formaPorSlug(slug: string | undefined): FormaPagamento | undefined {
  return SUBSECOES.find((s) => s.slug === slug)?.forma
}

export function subtituloPlanejamento(forma?: FormaPagamento): string {
  return `Planejamento Financeiro - ${forma ? NOME_DA_SUBSECAO[forma] : 'Geral'}`
}

/** Duração (M30): derivada de `total_parcelas`. "todas" = sem filtro. */
export type FiltroDuracao = 'todas' | 'recorrente' | 'parcelado'

const DURACOES: FiltroDuracao[] = ['todas', 'recorrente', 'parcelado']

/** Lê o `?duracao=` da URL; ausente ou inválido vale "todas". */
export function lerFiltroDuracao(valor: string | null): FiltroDuracao {
  return DURACOES.includes(valor as FiltroDuracao) ? (valor as FiltroDuracao) : 'todas'
}

/** Soma o resumo, opcionalmente só de uma forma de pagamento e/ou duração. */
export function resumoDe(
  linhas: ResumoPlanejamento[],
  filtro: { forma?: FormaPagamento; duracao?: FiltroDuracao } = {},
) {
  return linhas
    .filter((l) => filtro.forma === undefined || l.formaPagamento === filtro.forma)
    .filter(
      (l) =>
        filtro.duracao === undefined ||
        filtro.duracao === 'todas' ||
        l.recorrente === (filtro.duracao === 'recorrente'),
    )
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
