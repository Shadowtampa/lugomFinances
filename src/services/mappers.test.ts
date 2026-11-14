import { describe, expect, it } from 'vitest'
import type { AdesaoMetodoRow, SaidaRow } from '../types/api'
import { paraAdesaoMetodo, paraSaida } from './mappers'

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
      created_at: '2026-09-06T12:00:00Z',
    }

    expect(paraSaida(row).splits).toEqual([])
  })
})

describe('paraAdesaoMetodo', () => {
  it('traduz a linha de v_adesao_50_15_35', () => {
    const row: AdesaoMetodoRow = {
      user_id: 'u1',
      total_entradas_mes_centavos: 1000000,
      gasto_necessidades_centavos: 380000,
      gasto_desejos_centavos: 220000,
      gasto_investimentos_centavos: 150000,
      gasto_nao_classificado_centavos: 15000,
    }

    expect(paraAdesaoMetodo(row)).toEqual({
      totalEntradasMesCentavos: 1000000,
      gastoNecessidadesCentavos: 380000,
      gastoDesejosCentavos: 220000,
      gastoInvestimentosCentavos: 150000,
      gastoNaoClassificadoCentavos: 15000,
    })
  })
})
