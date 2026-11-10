import { describe, expect, it } from 'vitest'
import {
  PAGINA_PLANEJAMENTO,
  TIPO_PADRAO_SLUG,
  resumoDoTipo,
  subtituloPlanejamento,
  tipoPorSlug,
} from './planejamento'
import type { ResumoPlanejamento, TipoPlanejamento } from '../types/domain'

const tipos: TipoPlanejamento[] = [
  { id: 1, slug: 'assinaturas', nome: 'Assinaturas', ordem: 1 },
  { id: 5, slug: 'contas', nome: 'Contas', ordem: 5 },
]

function resumo(p: Partial<ResumoPlanejamento>): ResumoPlanejamento {
  return {
    competencia: '2026-11',
    tipoPlanejamentoId: 5,
    quantidade: 1,
    previstoCentavos: 100,
    pagoCentavos: 40,
    faltaCentavos: 60,
    ...p,
  }
}

describe('tipoPorSlug', () => {
  it('acha o Tipo pelo slug e devolve undefined para slug inválido', () => {
    expect(tipoPorSlug(tipos, 'assinaturas')?.id).toBe(1)
    expect(tipoPorSlug(tipos, 'xpto')).toBeUndefined()
    expect(tipoPorSlug(tipos, undefined)).toBeUndefined()
  })
})

describe('subtituloPlanejamento', () => {
  it('usa Geral sem Tipo e o nome do Tipo com ele', () => {
    expect(subtituloPlanejamento()).toBe('Planejamento Financeiro - Geral')
    expect(subtituloPlanejamento(tipos[0])).toBe('Planejamento Financeiro - Assinaturas')
  })
})

describe('resumoDoTipo', () => {
  const linhas = [
    resumo({ tipoPlanejamentoId: 1, quantidade: 2, previstoCentavos: 300, pagoCentavos: 100, faltaCentavos: 200 }),
    resumo({ tipoPlanejamentoId: 5 }),
  ]

  it('soma todos os Tipos quando não há Tipo', () => {
    expect(resumoDoTipo(linhas)).toEqual({
      quantidade: 3,
      previstoCentavos: 400,
      pagoCentavos: 140,
      faltaCentavos: 260,
    })
  })

  it('filtra por Tipo', () => {
    expect(resumoDoTipo(linhas, 1)).toEqual({
      quantidade: 2,
      previstoCentavos: 300,
      pagoCentavos: 100,
      faltaCentavos: 200,
    })
  })

  it('zera quando o Tipo não tem registros', () => {
    expect(resumoDoTipo(linhas, 4).quantidade).toBe(0)
  })
})

describe('constantes', () => {
  it('padrão é Contas e página tem 10', () => {
    expect(TIPO_PADRAO_SLUG).toBe('contas')
    expect(PAGINA_PLANEJAMENTO).toBe(10)
  })
})
