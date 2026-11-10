import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import CartoesAnalise from './CartoesAnalise'
import CategoriasAnalise from './CategoriasAnalise'
import type { DadosAnaliticos } from './dadosAnaliticos'
import type { DadosCartoes } from './dadosCartoes'
import VisaoGeral from './VisaoGeral'

beforeAll(() => {
  // recharts mede o contêiner com ResizeObserver, que o jsdom não tem.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const PERIODO = { de: '2026-11-01', ate: '2026-11-10' }
const ANTERIOR = { de: '2026-10-01', ate: '2026-10-31' }

const VAZIO: DadosAnaliticos = {
  saidas: [],
  entradas: [],
  categorias: [],
  fontes: [],
  saldosNaoCartaoCentavos: 0,
  dividaCartoesCentavos: 0,
}

const COM_DADOS: DadosAnaliticos = {
  saidas: [
    { data: '2026-11-03', categoriaId: 'c1', totalCentavos: 60000, quantidade: 2 },
    { data: '2026-10-10', categoriaId: 'c1', totalCentavos: 20000, quantidade: 1 },
    { data: '2026-11-05', categoriaId: 'c2', totalCentavos: 10000, quantidade: 1 },
  ],
  entradas: [{ data: '2026-11-01', fonteId: 'f1', totalCentavos: 500000, quantidade: 1 }],
  categorias: [
    { id: 'c1', nome: 'Alimentação', limiteMensalCentavos: 50000, cor: '#0F6E4F', arquivada: false },
    { id: 'c2', nome: 'Transporte', limiteMensalCentavos: null, cor: '#3D52A8', arquivada: false },
  ],
  fontes: [
    { id: 'f1', nome: 'Conta Corrente', tipo: 'livre', cor: '#0F6E4F', arquivada: false, ehCartao: false, limiteCentavos: null, diaFatura: null },
  ],
  saldosNaoCartaoCentavos: 300000,
  dividaCartoesCentavos: 50000,
}

describe('Visão geral', () => {
  it('sem lançamentos: totais zerados e taxas indisponíveis', () => {
    render(<VisaoGeral dados={VAZIO} periodo={PERIODO} anterior={ANTERIOR} />)
    expect(screen.getByText('Taxa de economia')).toBeInTheDocument()
    expect(screen.getAllByText('Indisponível: sem Entradas no período')).toHaveLength(2)
    expect(screen.getAllByText('Sem lançamentos no período.').length).toBeGreaterThan(0)
  })

  it('com lançamentos: calcula saldo, economia e patrimônio', () => {
    render(<VisaoGeral dados={COM_DADOS} periodo={PERIODO} anterior={ANTERIOR} />)
    // Entradas 5.000, Saídas 700 → saldo 4.300, economia 86%, comprometimento 14%, patrimônio 2.500.
    expect(screen.getByText(/4\.300,00/)).toBeInTheDocument()
    expect(screen.getByText('86,0%')).toBeInTheDocument()
    expect(screen.getByText('14,0%')).toBeInTheDocument()
    expect(screen.getByText(/2\.500,00/)).toBeInTheDocument()
  })
})

describe('Categorias', () => {
  it('sem lançamentos nem limites: estados vazios', () => {
    render(<CategoriasAnalise dados={VAZIO} periodo={PERIODO} anterior={ANTERIOR} preset="mes" hoje="2026-11-10" />)
    expect(screen.getByText(/Nenhuma Categoria tem limite mensal/)).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('mostra ranking, orçamento excedido e projeção só no Mês atual', () => {
    const { rerender } = render(
      <CategoriasAnalise dados={COM_DADOS} periodo={PERIODO} anterior={ANTERIOR} preset="mes" hoje="2026-11-10" />,
    )
    expect(screen.getAllByText('Alimentação').length).toBeGreaterThan(0)
    expect(screen.getByText('Orçamento excedido')).toBeInTheDocument()
    expect(screen.getByText(/Estimativa de fechamento do mês/)).toBeInTheDocument()

    rerender(
      <CategoriasAnalise dados={COM_DADOS} periodo={PERIODO} anterior={ANTERIOR} preset="mes-anterior" hoje="2026-11-10" />,
    )
    expect(screen.queryByText(/Estimativa de fechamento do mês/)).not.toBeInTheDocument()
  })
})

describe('Cartões (M32)', () => {
  const VAZIO_C: DadosCartoes = {
    saidas: [],
    faturas: [],
    parcelasCartao: [],
    parcelasPlanejamento: [],
    fontes: [],
    saldosFontes: [],
    instituicaoPorFonte: {},
    mesAtual: '2026-11',
  }

  it('sem nada: indicadores indisponíveis e estados vazios', () => {
    render(<CartoesAnalise dados={VAZIO_C} periodo={PERIODO} anterior={ANTERIOR} />)
    expect(screen.getByText('Indisponível: nenhuma fatura paga nos últimos 12 meses')).toBeInTheDocument()
    expect(screen.getByText('Nenhum cartão cadastrado.')).toBeInTheDocument()
    expect(screen.getByText('Nenhum compromisso futuro cadastrado.')).toBeInTheDocument()
  })

  it('com dados: compras no cartão, maior compra, utilização e compromissos', () => {
    const cartao = { id: 'f2', nome: 'Nubank', tipo: 'livre' as const, cor: '#7A3E9D', arquivada: false, ehCartao: true, limiteCentavos: 100000, diaFatura: 10 }
    const conta = { id: 'f1', nome: 'Conta', tipo: 'livre' as const, cor: '#0F6E4F', arquivada: false, ehCartao: false, limiteCentavos: null, diaFatura: null }
    const dados: DadosCartoes = {
      ...VAZIO_C,
      saidas: [
        { saidaId: 's1', data: '2026-11-02', fonteId: 'f2', categoriaId: 'c1', titulo: 'Notebook', valorCentavos: 30000 },
        { saidaId: 's2', data: '2026-11-04', fonteId: 'f2', categoriaId: 'c1', titulo: 'Mercado', valorCentavos: 10000 },
        { saidaId: 's3', data: '2026-11-05', fonteId: 'f1', categoriaId: 'c1', titulo: 'Aluguel', valorCentavos: 50000 },
      ],
      fontes: [conta, cartao],
      saldosFontes: [{ ...cartao, totalEntradasCentavos: 0, totalSaidasCentavos: 40000, saldoCentavos: -40000 }],
      instituicaoPorFonte: { f1: 'Manual', f2: 'Nubank' },
      faturas: [{ fonteId: 'f2', mes: '2026-10', totalCentavos: 90000 }],
      parcelasCartao: [{ fonteId: 'f2', descricao: 'Notebook', parcela: 1, totalParcelas: 3, restantes: 2, valorParcelaCentavos: 10000, proximoMes: '2026-12' }],
    }
    render(<CartoesAnalise dados={dados} periodo={PERIODO} anterior={ANTERIOR} />)
    // Compras no cartão: 300 + 100 = 400; ticket 200; maior 300 (Notebook); fatura média 900.
    expect(screen.getByText('Notebook')).toBeInTheDocument()
    expect(screen.getByText('2 compras no período')).toBeInTheDocument()
    expect(screen.getAllByText(/200,00/).length).toBeGreaterThan(0) // ticket médio
    expect(screen.getByText('Média de 1 mês com fatura paga (até 6)')).toBeInTheDocument()
    expect(screen.getAllByText(/900,00/).length).toBeGreaterThan(0) // fatura média e barra do gráfico
    expect(screen.getByText('40%')).toBeInTheDocument() // 400 de 1.000 de limite
    expect(screen.getByText(/Total:/)).toHaveTextContent('200,00') // 2 parcelas de 100
  })
})
