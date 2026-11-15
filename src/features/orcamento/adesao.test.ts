import { describe, expect, it } from 'vitest'
import { avaliarAdesao, avaliarGrupo, percentualDaRenda } from './adesao'

describe('percentualDaRenda', () => {
  it('calcula sobre a renda do mês', () => {
    expect(percentualDaRenda(380000, 1000000)).toBe(38)
  })

  it('renda zero devolve 0, nunca NaN ou Infinity', () => {
    expect(percentualDaRenda(5000, 0)).toBe(0)
    expect(percentualDaRenda(0, 0)).toBe(0)
  })

  it('pode passar de 100% quando gasta mais do que entrou no mês', () => {
    expect(percentualDaRenda(1200000, 1000000)).toBe(120)
  })
})

describe('avaliarGrupo', () => {
  it('essenciais abaixo da meta não alerta e mostra a sobra', () => {
    expect(avaliarGrupo('essenciais', 380000, 1000000)).toMatchObject({
      percentual: 38,
      meta: 50,
      alerta: false,
      texto: 'dentro da meta · sobram 12%',
    })
  })

  it('estilo de vida acima da meta alerta', () => {
    expect(avaliarGrupo('estilo_de_vida', 420000, 1000000)).toMatchObject({
      percentual: 42,
      meta: 35,
      alerta: true,
      texto: '7% acima da meta',
    })
  })

  it('exatamente na meta não alerta', () => {
    expect(avaliarGrupo('estilo_de_vida', 350000, 1000000)).toMatchObject({
      alerta: false,
      texto: 'na meta',
    })
  })

  it('prioridades abaixo da meta alerta (lógica invertida)', () => {
    expect(avaliarGrupo('prioridades', 50000, 1000000)).toMatchObject({
      percentual: 5,
      meta: 15,
      alerta: true,
      texto: '10% abaixo da meta',
    })
  })

  it('prioridades na meta ou acima não alerta', () => {
    expect(avaliarGrupo('prioridades', 150000, 1000000).alerta).toBe(false)
    expect(avaliarGrupo('prioridades', 300000, 1000000)).toMatchObject({
      alerta: false,
      texto: 'meta atingida',
    })
  })
})

describe('avaliarAdesao', () => {
  it('devolve os 3 grupos na ordem 50-15-35', () => {
    const avaliacoes = avaliarAdesao({
      totalEntradasMesCentavos: 1000000,
      gastoEssenciaisCentavos: 380000,
      gastoPrioridadesCentavos: 150000,
      gastoEstiloDeVidaCentavos: 220000,
      gastoNaoClassificadoCentavos: 15000,
    })
    expect(avaliacoes.map((a) => [a.grupo, a.meta, a.percentual])).toEqual([
      ['essenciais', 50, 38],
      ['prioridades', 15, 15],
      ['estilo_de_vida', 35, 22],
    ])
  })
})
