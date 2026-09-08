import { describe, expect, it } from 'vitest'
import type { SaidaRow } from '../types/api'
import { paraSaida } from './mappers'

describe('paraSaida', () => {
  it('desempacota os splits aninhados', () => {
    const row: SaidaRow = {
      id: 's1',
      user_id: 'u1',
      categoria_id: 'c1',
      titulo: 'Almoço',
      valor_total_centavos: 8000,
      data: '2026-09-05',
      recorrente: false,
      dia_recorrencia: null,
      recorrencia_ativa: true,
      template_id: null,
      total_parcelas: null,
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
      recorrente: false,
      diaRecorrencia: null,
      recorrenciaAtiva: true,
      templateId: null,
      totalParcelas: null,
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
      recorrente: false,
      dia_recorrencia: null,
      recorrencia_ativa: true,
      template_id: null,
      total_parcelas: null,
      created_at: '2026-09-06T12:00:00Z',
    }

    expect(paraSaida(row).splits).toEqual([])
  })
})
