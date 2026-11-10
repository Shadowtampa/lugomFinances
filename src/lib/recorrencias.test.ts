import { describe, expect, it } from 'vitest'
import {
  avisosFontesPrevistas,
  filtrarRecorrencias,
  lerFiltroRecorrencia,
  opcoesDeVinculo,
  rotuloCompetencia,
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
    saidaTitulo: null,
    saidaData: null,
    tipoPlanejamentoId: 5,
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

describe('rotuloCompetencia', () => {
  it('formata mês curto e ano', () => {
    expect(rotuloCompetencia('2026-11')).toBe('nov/2026')
    expect(rotuloCompetencia('2027-01')).toBe('jan/2027')
  })
})

describe('opcoesDeVinculo', () => {
  const hoje = '2026-11-09'
  const outPendente = item({ recorrenciaId: 'aluguel', competencia: '2026-10', dia: 5 })
  const outManualAntiga = item({ recorrenciaId: 'luz', competencia: '2026-10', pagamentoId: 'p0' })
  const novAtrasada = item({ recorrenciaId: 'aluguel', competencia: '2026-11', dia: 5 })
  const novPendente = item({ recorrenciaId: 'net', competencia: '2026-11', dia: 20 })
  const novManual = item({ recorrenciaId: 'luz', competencia: '2026-11', pagamentoId: 'p1' })
  const novOutraSaida = item({ recorrenciaId: 'agua', competencia: '2026-11', pagamentoId: 'p2', saidaId: 's9' })
  const novEstaSaida = item({ recorrenciaId: 'gas', competencia: '2026-11', pagamentoId: 'p3', saidaId: 's1' })
  const dezFuturo = item({ recorrenciaId: 'net', competencia: '2026-12' })
  const todos = [novPendente, novManual, novOutraSaida, novEstaSaida, outPendente, outManualAntiga, novAtrasada, dezFuturo]

  it('lista não pagas (inclusive atrasadas de meses anteriores) e manuais do próprio mês', () => {
    const r = opcoesDeVinculo(todos, '2026-11', hoje)
    expect(r.map((o) => [o.recorrenciaId, o.competencia, o.situacao])).toEqual([
      ['aluguel', '2026-10', 'atrasada'],
      ['aluguel', '2026-11', 'atrasada'],
      ['luz', '2026-11', 'manual'],
      ['net', '2026-11', 'pendente'],
    ])
  })

  it('inclui a competência já ligada à Saída em edição', () => {
    const r = opcoesDeVinculo(todos, '2026-11', hoje, 's1')
    expect(r.find((o) => o.recorrenciaId === 'gas')?.situacao).toBe('vinculada')
    expect(r.some((o) => o.recorrenciaId === 'agua')).toBe(false)
  })
})
