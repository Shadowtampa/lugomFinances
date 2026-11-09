import { describe, expect, it } from 'vitest'
import {
  avisosFontesPrevistas,
  filtrarRecorrencias,
  lerFiltroRecorrencia,
  resumoDoMes,
  rotuloFontesPrevistas,
  statusDaRecorrencia,
} from './recorrencias'
import type { RecorrenciaDoMes } from '../types/domain'

function item(parcial: Partial<RecorrenciaDoMes>): RecorrenciaDoMes {
  return {
    recorrenciaId: 'r1',
    titulo: 'Internet',
    valorPrevistoCentavos: 9990,
    dia: 7,
    categoriaId: null,
    categoriaNome: null,
    totalParcelas: null,
    ativa: true,
    competencia: '2026-11',
    parcela: 3,
    pagamentoId: null,
    pagoEm: null,
    saidaId: null,
    valorPagoCentavos: null,
    nota: null,
    fontesPrevistas: [],
    ...parcial,
  }
}

describe('statusDaRecorrencia', () => {
  it('paga quando tem pagamento, mesmo depois do dia', () => {
    expect(statusDaRecorrencia(item({ pagamentoId: 'p1' }), '2026-11-20')).toBe('paga')
  })
  it('pendente antes do dia e no próprio dia', () => {
    expect(statusDaRecorrencia(item({}), '2026-11-06')).toBe('pendente')
    expect(statusDaRecorrencia(item({}), '2026-11-07')).toBe('pendente')
  })
  it('atrasada depois do dia', () => {
    expect(statusDaRecorrencia(item({}), '2026-11-08')).toBe('atrasada')
  })
  it('dia 31 em mês de 30 dias resolve para o dia 30', () => {
    expect(statusDaRecorrencia(item({ dia: 31 }), '2026-11-30')).toBe('pendente')
    expect(statusDaRecorrencia(item({ dia: 31, competencia: '2026-11' }), '2026-12-01')).toBe('atrasada')
  })
  it('mês futuro é pendente', () => {
    expect(statusDaRecorrencia(item({ competencia: '2027-01' }), '2026-11-30')).toBe('pendente')
  })
  it('mês passado sem pagamento é atrasada', () => {
    expect(statusDaRecorrencia(item({ competencia: '2026-10' }), '2026-11-01')).toBe('atrasada')
  })
})

describe('resumoDoMes', () => {
  it('usa valor real da Saída ligada no pago e previsto no que falta', () => {
    const r = resumoDoMes([
      item({ valorPrevistoCentavos: 10000, pagamentoId: 'p1', valorPagoCentavos: 10500 }),
      item({ valorPrevistoCentavos: 5000, pagamentoId: 'p2' }),
      item({ valorPrevistoCentavos: 2000 }),
    ])
    expect(r).toEqual({ previstoCentavos: 17000, pagoCentavos: 15500, faltaCentavos: 2000 })
  })
})

describe('lerFiltroRecorrencia', () => {
  it('aceita os três valores', () => {
    expect(lerFiltroRecorrencia('todas')).toBe('todas')
    expect(lerFiltroRecorrencia('pagas')).toBe('pagas')
    expect(lerFiltroRecorrencia('a-pagar')).toBe('a-pagar')
  })
  it('sem parâmetro ou inválido vale a-pagar', () => {
    expect(lerFiltroRecorrencia(null)).toBe('a-pagar')
    expect(lerFiltroRecorrencia('xyz')).toBe('a-pagar')
  })
})

describe('filtrarRecorrencias', () => {
  const paga = item({ recorrenciaId: 'paga', pagamentoId: 'p1' })
  const aberta = item({ recorrenciaId: 'aberta' })
  const itens = [paga, aberta]

  it('a-pagar mantém só as sem pagamento (pendentes e atrasadas)', () => {
    expect(filtrarRecorrencias(itens, 'a-pagar')).toEqual([aberta])
  })
  it('pagas mantém só as com pagamento', () => {
    expect(filtrarRecorrencias(itens, 'pagas')).toEqual([paga])
  })
  it('todas não filtra', () => {
    expect(filtrarRecorrencias(itens, 'todas')).toEqual(itens)
  })
})

describe('rotuloFontesPrevistas', () => {
  const fontes = new Map([
    ['inter', { nome: 'Inter', arquivada: false }],
    ['vr', { nome: 'VR Flash', arquivada: false }],
    ['mp', { nome: 'Mercado Pago', arquivada: true }],
  ])
  it('vazio quando não há fonte prevista', () => {
    expect(rotuloFontesPrevistas([], fontes)).toBe('')
  })
  it('uma ou duas fontes pelo nome; arquivada marcada', () => {
    expect(rotuloFontesPrevistas(['inter'], fontes)).toBe('Inter')
    expect(rotuloFontesPrevistas(['inter', 'mp'], fontes)).toBe('Inter + Mercado Pago (arquivada)')
  })
  it('três ou mais viram contagem', () => {
    expect(rotuloFontesPrevistas(['inter', 'vr', 'mp'], fontes)).toBe('3 fontes')
  })
})

describe('avisosFontesPrevistas', () => {
  const fontes = [
    { id: 'inter', nome: 'Inter', tipo: 'livre' as const },
    { id: 'vr', nome: 'VR Flash', tipo: 'restrita' as const, categoriasPermitidas: ['alimentacao'] },
  ]
  it('avisa fonte restrita que não aceita a categoria', () => {
    expect(avisosFontesPrevistas(['inter', 'vr'], fontes, 'contas', 'Contas')).toEqual([
      'VR Flash não aceita Contas; o pagamento por ela vai ser recusado.',
    ])
  })
  it('não avisa quando a categoria é permitida ou não há categoria', () => {
    expect(avisosFontesPrevistas(['vr'], fontes, 'alimentacao', 'Alimentação')).toEqual([])
    expect(avisosFontesPrevistas(['vr'], fontes, null, null)).toEqual([])
  })
})
