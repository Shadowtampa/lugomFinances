import { describe, expect, it } from 'vitest'
import type { RecorrenciaMesRow, SaidaRow } from '../types/api'
import { deRecorrencia, paraRecorrenciaDoMes, paraSaida } from './mappers'

describe('paraSaida', () => {
  it('desempacota os splits aninhados', () => {
    const row: SaidaRow = {
      id: 's1',
      user_id: 'u1',
      categoria_id: 'c1',
      titulo: 'Almoço',
      valor_total_centavos: 8000,
      data: '2026-09-05',
      eh_pagamento_fatura: false,
      created_at: '2026-09-05T12:00:00Z',
      saida_splits: [
        { fonte_id: 'f1', valor_centavos: 5000 },
        { fonte_id: 'f2', valor_centavos: 3000 },
      ],
    }

    expect(paraSaida(row)).toEqual({
      id: 's1',
      categoriaId: 'c1',
      titulo: 'Almoço',
      valorTotalCentavos: 8000,
      data: '2026-09-05',
      ehPagamentoFatura: false,
      splits: [
        { fonteId: 'f1', valorCentavos: 5000 },
        { fonteId: 'f2', valorCentavos: 3000 },
      ],
    })
  })

  it('devolve splits vazio quando saida_splits não veio no embed', () => {
    const row: SaidaRow = {
      id: 's2',
      user_id: 'u1',
      categoria_id: 'c1',
      titulo: 'Uber',
      valor_total_centavos: 2200,
      data: '2026-09-06',
      eh_pagamento_fatura: false,
      created_at: '2026-09-06T12:00:00Z',
    }

    expect(paraSaida(row).splits).toEqual([])
  })
})

describe('paraRecorrenciaDoMes', () => {
  it('converte competência para YYYY-MM e mantém campos de pagamento', () => {
    const row: RecorrenciaMesRow = {
      recorrencia_id: 'r1',
      user_id: 'u1',
      titulo: 'Internet',
      valor_previsto_centavos: 9990,
      dia: 7,
      categoria_id: 'c1',
      categoria_nome: 'Casa',
      total_parcelas: null,
      ativa: true,
      competencia: '2026-11-01',
      parcela: 3,
      pagamento_id: 'p1',
      pago_em: '2026-11-07',
      saida_id: null,
      valor_pago_centavos: null,
    }
    expect(paraRecorrenciaDoMes(row)).toEqual({
      recorrenciaId: 'r1',
      titulo: 'Internet',
      valorPrevistoCentavos: 9990,
      dia: 7,
      categoriaId: 'c1',
      categoriaNome: 'Casa',
      totalParcelas: null,
      ativa: true,
      competencia: '2026-11',
      parcela: 3,
      pagamentoId: 'p1',
      pagoEm: '2026-11-07',
      saidaId: null,
      valorPagoCentavos: null,
    })
  })
})

describe('deRecorrencia', () => {
  it('converte mesInicio para o dia 1 e só envia campos presentes', () => {
    expect(deRecorrencia({ mesInicio: '2026-11', categoriaId: null })).toEqual({
      mes_inicio: '2026-11-01',
      categoria_id: null,
    })
  })
})
