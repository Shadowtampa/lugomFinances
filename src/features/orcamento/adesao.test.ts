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
  it('necessidades abaixo da meta não alerta e mostra a sobra', () => {
    expect(avaliarGrupo('necessidades', 380000, 1000000)).toMatchObject({
      percentual: 38,
      meta: 50,
      alerta: false,
      texto: 'dentro da meta · sobram 12%',
    })
  })

  it('desejos acima da meta alerta', () => {
    expect(avaliarGrupo('desejos', 220000, 1000000)).toMatchObject({
      percentual: 22,
      alerta: true,
      texto: '7% acima da meta',
    })
  })

  it('exatamente na meta não alerta', () => {
    expect(avaliarGrupo('desejos', 150000, 1000000)).toMatchObject({
      alerta: false,
      texto: 'na meta',
    })
  })

  it('investimentos abaixo da meta alerta (lógica invertida)', () => {
    expect(avaliarGrupo('investimentos', 150000, 1000000)).toMatchObject({
      percentual: 15,
      meta: 35,
      alerta: true,
      texto: '20% abaixo da meta',
    })
  })

  it('investimentos na meta ou acima não alerta', () => {
    expect(avaliarGrupo('investimentos', 350000, 1000000).alerta).toBe(false)
    expect(avaliarGrupo('investimentos', 500000, 1000000)).toMatchObject({
      alerta: false,
      texto: 'meta atingida',
    })
  })
})

describe('avaliarAdesao', () => {
  it('devolve os 3 grupos na ordem 50-15-35', () => {
    const avaliacoes = avaliarAdesao({
      totalEntradasMesCentavos: 1000000,
      gastoNecessidadesCentavos: 380000,
      gastoDesejosCentavos: 220000,
      gastoInvestimentosCentavos: 150000,
      gastoNaoClassificadoCentavos: 15000,
    })
    expect(avaliacoes.map((a) => [a.grupo, a.percentual])).toEqual([
      ['necessidades', 38],
      ['desejos', 22],
      ['investimentos', 15],
    ])
  })
})
