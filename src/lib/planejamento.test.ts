import { describe, expect, it } from 'vitest'
import {
  FORMA_PADRAO,
  PAGINA_PLANEJAMENTO,
  formaPorSlug,
  lerFiltroDuracao,
  resumoDe,
  slugDaForma,
  subtituloPlanejamento,
} from './planejamento'
import type { ResumoPlanejamento } from '../types/domain'

function resumo(p: Partial<ResumoPlanejamento>): ResumoPlanejamento {
  return {
    competencia: '2026-11',
    formaPagamento: 'manual',
    recorrente: true,
    quantidade: 1,
    previstoCentavos: 100,
    pagoCentavos: 40,
    faltaCentavos: 60,
    ...p,
  }
}

describe('formaPorSlug / slugDaForma', () => {
  it('traduz slug da URL para a forma e de volta', () => {
    expect(formaPorSlug('manuais')).toBe('manual')
    expect(formaPorSlug('automaticas')).toBe('automatica')
    expect(slugDaForma('manual')).toBe('manuais')
    expect(slugDaForma('automatica')).toBe('automaticas')
  })

  it('slug desconhecido (inclusive os do M29) ou ausente devolve undefined', () => {
    expect(formaPorSlug('assinaturas')).toBeUndefined()
    expect(formaPorSlug(undefined)).toBeUndefined()
  })
})

describe('subtituloPlanejamento', () => {
  it('Geral sem forma; Manuais / Automáticas com ela', () => {
    expect(subtituloPlanejamento()).toBe('Planejamento Financeiro - Geral')
    expect(subtituloPlanejamento('manual')).toBe('Planejamento Financeiro - Manuais')
    expect(subtituloPlanejamento('automatica')).toBe('Planejamento Financeiro - Automáticas')
  })
})

describe('lerFiltroDuracao', () => {
  it('aceita os valores válidos; o resto vale "todas"', () => {
    expect(lerFiltroDuracao('recorrente')).toBe('recorrente')
    expect(lerFiltroDuracao('parcelado')).toBe('parcelado')
    expect(lerFiltroDuracao('xpto')).toBe('todas')
    expect(lerFiltroDuracao(null)).toBe('todas')
  })
})

describe('resumoDe', () => {
  const linhas = [
    resumo({ formaPagamento: 'manual', recorrente: true, quantidade: 2, previstoCentavos: 300, pagoCentavos: 100, faltaCentavos: 200 }),
    resumo({ formaPagamento: 'manual', recorrente: false }),
    resumo({ formaPagamento: 'automatica', recorrente: true, quantidade: 4, previstoCentavos: 1000, pagoCentavos: 1000, faltaCentavos: 0 }),
  ]

  it('sem filtro soma tudo', () => {
    expect(resumoDe(linhas)).toEqual({ quantidade: 7, previstoCentavos: 1400, pagoCentavos: 1140, faltaCentavos: 260 })
  })

  it('filtra por forma', () => {
    expect(resumoDe(linhas, { forma: 'manual' }).quantidade).toBe(3)
    expect(resumoDe(linhas, { forma: 'automatica' }).quantidade).toBe(4)
  })

  it('filtra por duração', () => {
    expect(resumoDe(linhas, { duracao: 'recorrente' }).quantidade).toBe(6)
    expect(resumoDe(linhas, { duracao: 'parcelado' }).quantidade).toBe(1)
    expect(resumoDe(linhas, { duracao: 'todas' }).quantidade).toBe(7)
  })

  it('combina forma e duração', () => {
    expect(resumoDe(linhas, { forma: 'manual', duracao: 'recorrente' }).quantidade).toBe(2)
  })

  it('zera quando nada casa', () => {
    expect(resumoDe([], { forma: 'manual' })).toEqual({ quantidade: 0, previstoCentavos: 0, pagoCentavos: 0, faltaCentavos: 0 })
  })
})

describe('constantes', () => {
  it('forma padrão é manual e página tem 10', () => {
    expect(FORMA_PADRAO).toBe('manual')
    expect(PAGINA_PLANEJAMENTO).toBe(10)
  })
})
