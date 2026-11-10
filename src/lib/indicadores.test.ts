import { describe, expect, it } from 'vitest'
import {
  agruparPorCategoria,
  avaliarOrcamento,
  comprometimentoRenda,
  compromissosFuturos,
  concentracaoTopN,
  contarExcedidas,
  crescimentoPorCategoria,
  diasDoMes,
  diferencaPontos,
  faturaMedia,
  filtrarPorPeriodo,
  diasNoPeriodo,
  faixaOrcamento,
  maiorAumentoAbsoluto,
  maiorCompra,
  maiorCrescimentoPercentual,
  mesesDoGrafico,
  mesesTocados,
  patrimonioLiquido,
  percentual,
  periodoAnterior,
  planejadoDoPeriodo,
  projetarFechamento,
  rankingCategorias,
  resolverPeriodo,
  saldoOperacional,
  somarPorChave,
  somarPorMes,
  taxaEconomia,
  ticketMedio,
  totalCompromissos,
  utilizacaoLimite,
  variacaoAbsoluta,
  variacaoPercentual,
} from './indicadores'

const HOJE = '2026-11-10'

describe('resolverPeriodo', () => {
  it('Mês atual vai do dia 1º até hoje', () => {
    expect(resolverPeriodo('mes', HOJE)).toEqual({ de: '2026-11-01', ate: '2026-11-10' })
  })
  it('Mês anterior é o mês fechado', () => {
    expect(resolverPeriodo('mes-anterior', HOJE)).toEqual({ de: '2026-10-01', ate: '2026-10-31' })
  })
  it('Últimos N meses termina no mês atual, até hoje', () => {
    expect(resolverPeriodo('3m', HOJE)).toEqual({ de: '2026-09-01', ate: HOJE })
    expect(resolverPeriodo('6m', HOJE)).toEqual({ de: '2026-06-01', ate: HOJE })
    expect(resolverPeriodo('12m', HOJE)).toEqual({ de: '2025-12-01', ate: HOJE })
  })
  it('Ano atual começa em 1º de janeiro', () => {
    expect(resolverPeriodo('ano', HOJE)).toEqual({ de: '2026-01-01', ate: HOJE })
  })
  it('Personalizado usa o intervalo dado e corrige datas invertidas', () => {
    expect(resolverPeriodo('custom', HOJE, { de: '2026-10-05', ate: '2026-10-20' })).toEqual({
      de: '2026-10-05',
      ate: '2026-10-20',
    })
    expect(resolverPeriodo('custom', HOJE, { de: '2026-10-20', ate: '2026-10-05' })).toEqual({
      de: '2026-10-05',
      ate: '2026-10-20',
    })
  })
  it('Personalizado sem datas cai no mês atual', () => {
    expect(resolverPeriodo('custom', HOJE)).toEqual({ de: '2026-11-01', ate: HOJE })
  })
})

describe('meses e dias do período', () => {
  it('lista os meses tocados, virando o ano', () => {
    expect(mesesTocados({ de: '2025-11-20', ate: '2026-02-03' })).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })
  it('conta dias inclusive nas duas pontas', () => {
    expect(diasNoPeriodo({ de: '2026-11-01', ate: '2026-11-01' })).toBe(1)
    expect(diasNoPeriodo({ de: '2026-02-01', ate: '2026-02-28' })).toBe(28)
  })
  it('gráfico com menos de 2 meses mostra os 6 que terminam no último', () => {
    expect(mesesDoGrafico({ de: '2026-11-01', ate: HOJE })).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ])
  })
  it('gráfico com 2 meses ou mais usa só os do período', () => {
    expect(mesesDoGrafico({ de: '2026-09-01', ate: HOJE })).toEqual(['2026-09', '2026-10', '2026-11'])
  })
  it('meses de 28 a 31 dias', () => {
    expect(diasDoMes('2026-02')).toBe(28)
    expect(diasDoMes('2028-02')).toBe(29)
    expect(diasDoMes('2026-04')).toBe(30)
    expect(diasDoMes('2026-12')).toBe(31)
  })
})

describe('periodoAnterior', () => {
  it('Mês atual compara com o mês anterior inteiro', () => {
    expect(periodoAnterior({ de: '2026-11-01', ate: HOJE }, 'mes')).toEqual({ de: '2026-10-01', ate: '2026-10-31' })
  })
  it('Mês anterior compara com o mês antes dele', () => {
    expect(periodoAnterior({ de: '2026-10-01', ate: '2026-10-31' }, 'mes-anterior')).toEqual({
      de: '2026-09-01',
      ate: '2026-09-30',
    })
  })
  it('3 meses comparam com os 3 meses antes', () => {
    expect(periodoAnterior({ de: '2026-09-01', ate: HOJE }, '3m')).toEqual({ de: '2026-06-01', ate: '2026-08-31' })
  })
  it('vira o ano', () => {
    expect(periodoAnterior({ de: '2026-01-01', ate: HOJE }, 'ano')).toEqual({ de: '2025-02-01', ate: '2025-12-31' })
  })
  it('Personalizado usa o mesmo número de dias antes', () => {
    expect(periodoAnterior({ de: '2026-10-11', ate: '2026-10-20' }, 'custom')).toEqual({
      de: '2026-10-01',
      ate: '2026-10-10',
    })
  })
})

describe('variações e proporções', () => {
  it('percentual com total zero é indisponível', () => {
    expect(percentual(10, 0)).toBeNull()
    expect(percentual(25, 100)).toBe(25)
  })
  it('variação percentual usa o módulo do anterior', () => {
    expect(variacaoPercentual(150, 100)).toBe(50)
    expect(variacaoPercentual(50, 100)).toBe(-50)
    expect(variacaoPercentual(-50, -100)).toBe(50)
  })
  it('variação com anterior zero é indisponível', () => {
    expect(variacaoPercentual(100, 0)).toBeNull()
    expect(variacaoPercentual(0, 0)).toBeNull()
  })
  it('variação absoluta', () => {
    expect(variacaoAbsoluta(70, 100)).toBe(-30)
  })
})

describe('Visão geral', () => {
  it('saldo operacional', () => {
    expect(saldoOperacional(500000, 400000)).toBe(100000)
    expect(saldoOperacional(0, 1000)).toBe(-1000)
  })
  it('taxa de economia (exemplo do VR: 5.800 de Entradas, 4.000 de Saídas)', () => {
    expect(taxaEconomia(580000, 400000)).toBeCloseTo(31.03, 2)
    expect(taxaEconomia(500000, 400000)).toBe(20)
  })
  it('taxa de economia negativa quando gasta mais do que entra', () => {
    expect(taxaEconomia(100000, 150000)).toBe(-50)
  })
  it('sem Entradas, taxas ficam indisponíveis', () => {
    expect(taxaEconomia(0, 5000)).toBeNull()
    expect(comprometimentoRenda(0, 5000)).toBeNull()
  })
  it('comprometimento da renda', () => {
    expect(comprometimentoRenda(500000, 400000)).toBe(80)
    expect(comprometimentoRenda(500000, 0)).toBe(0)
  })
  it('patrimônio líquido = saldos não-cartão − dívida dos cartões', () => {
    expect(patrimonioLiquido(1000000, 250000)).toBe(750000)
    expect(patrimonioLiquido(100000, 250000)).toBe(-150000)
    expect(patrimonioLiquido(0, 0)).toBe(0)
  })
  it('ticket médio arredonda ao centavo e some sem lançamentos', () => {
    expect(ticketMedio(10000, 3)).toBe(3333)
    expect(ticketMedio(10001, 2)).toBe(5001)
    expect(ticketMedio(0, 0)).toBeNull()
  })
})

describe('somarPorMes', () => {
  it('preenche meses sem lançamento com zero e ignora o que está fora', () => {
    const itens = [
      { data: '2026-09-03', totalCentavos: 1000 },
      { data: '2026-09-20', totalCentavos: 500 },
      { data: '2026-11-01', totalCentavos: 200 },
      { data: '2026-01-01', totalCentavos: 9999 },
    ]
    expect(somarPorMes(itens, ['2026-09', '2026-10', '2026-11'])).toEqual([
      { mes: '2026-09', totalCentavos: 1500 },
      { mes: '2026-10', totalCentavos: 0 },
      { mes: '2026-11', totalCentavos: 200 },
    ])
  })
  it('período sem movimentação soma zero', () => {
    expect(somarPorMes([], ['2026-11'])).toEqual([{ mes: '2026-11', totalCentavos: 0 }])
  })
})

describe('Categorias', () => {
  const somas = [
    { categoriaId: 'a', totalCentavos: 3000, quantidade: 2 },
    { categoriaId: 'b', totalCentavos: 1000, quantidade: 1 },
    { categoriaId: 'a', totalCentavos: 2000, quantidade: 1 },
    { categoriaId: 'c', totalCentavos: 4000, quantidade: 4 },
    { categoriaId: 'd', totalCentavos: 500, quantidade: 1 },
  ]
  const totais = agruparPorCategoria(somas)

  it('agrupa totais e quantidades por Categoria', () => {
    expect(totais.find((t) => t.categoriaId === 'a')).toEqual({ categoriaId: 'a', totalCentavos: 5000, quantidade: 3 })
  })
  it('ranking decrescente por total', () => {
    expect(rankingCategorias(totais).map((t) => t.categoriaId)).toEqual(['a', 'c', 'b', 'd'])
  })
  it('empate no total: mais lançamentos primeiro, depois id', () => {
    const empate = [
      { categoriaId: 'x', totalCentavos: 100, quantidade: 1 },
      { categoriaId: 'y', totalCentavos: 100, quantidade: 3 },
      { categoriaId: 'w', totalCentavos: 100, quantidade: 1 },
    ]
    expect(rankingCategorias(empate).map((t) => t.categoriaId)).toEqual(['y', 'w', 'x'])
  })
  it('concentração das 3 e das 5 maiores', () => {
    const total = 10500
    expect(concentracaoTopN(totais, 3, total)).toBeCloseTo(((5000 + 4000 + 1000) / total) * 100, 5)
    expect(concentracaoTopN(totais, 5, total)).toBeCloseTo(100, 5)
  })
  it('concentração sem Saídas é indisponível', () => {
    expect(concentracaoTopN([], 3, 0)).toBeNull()
  })
  it('ticket médio por Categoria', () => {
    const a = totais.find((t) => t.categoriaId === 'a')!
    expect(ticketMedio(a.totalCentavos, a.quantidade)).toBe(1667)
  })

  describe('crescimento', () => {
    const atual = [
      { categoriaId: 'a', totalCentavos: 3000, quantidade: 1 },
      { categoriaId: 'b', totalCentavos: 1500, quantidade: 1 },
      { categoriaId: 'n', totalCentavos: 800, quantidade: 1 },
    ]
    const anterior = [
      { categoriaId: 'a', totalCentavos: 1000, quantidade: 1 },
      { categoriaId: 'b', totalCentavos: 1000, quantidade: 1 },
      { categoriaId: 'z', totalCentavos: 700, quantidade: 1 },
    ]
    const cresc = crescimentoPorCategoria(atual, anterior)

    it('inclui Categoria só no atual (sem base) e só no anterior (caiu a zero)', () => {
      const n = cresc.find((c) => c.categoriaId === 'n')!
      expect(n.variacaoPercentual).toBeNull()
      expect(n.variacaoAbsolutaCentavos).toBe(800)
      const z = cresc.find((c) => c.categoriaId === 'z')!
      expect(z.atualCentavos).toBe(0)
      expect(z.variacaoPercentual).toBe(-100)
    })
    it('maior crescimento % e maior aumento absoluto podem ser Categorias diferentes', () => {
      expect(maiorCrescimentoPercentual(cresc)?.categoriaId).toBe('a') // +200%
      expect(maiorAumentoAbsoluto(cresc)?.categoriaId).toBe('a') // +2000
      const outro = crescimentoPorCategoria(
        [
          { categoriaId: 'p', totalCentavos: 200, quantidade: 1 },
          { categoriaId: 'q', totalCentavos: 11000, quantidade: 1 },
        ],
        [
          { categoriaId: 'p', totalCentavos: 100, quantidade: 1 },
          { categoriaId: 'q', totalCentavos: 10000, quantidade: 1 },
        ],
      )
      expect(maiorCrescimentoPercentual(outro)?.categoriaId).toBe('p') // +100%
      expect(maiorAumentoAbsoluto(outro)?.categoriaId).toBe('q') // +1000
    })
    it('sem nenhum aumento não destaca ninguém', () => {
      const queda = crescimentoPorCategoria(
        [{ categoriaId: 'a', totalCentavos: 100, quantidade: 1 }],
        [{ categoriaId: 'a', totalCentavos: 500, quantidade: 1 }],
      )
      expect(maiorCrescimentoPercentual(queda)).toBeNull()
      expect(maiorAumentoAbsoluto(queda)).toBeNull()
      expect(maiorCrescimentoPercentual([])).toBeNull()
    })
  })
})

describe('Planejado × realizado', () => {
  it('limite × meses do período', () => {
    expect(planejadoDoPeriodo(150000, 1)).toBe(150000)
    expect(planejadoDoPeriodo(150000, 3)).toBe(450000)
  })

  describe('faixas', () => {
    it('respeita as bordas: 70, 90 e 100 pertencem à faixa de baixo', () => {
      expect(faixaOrcamento(0)).toBe('dentro')
      expect(faixaOrcamento(70)).toBe('dentro')
      expect(faixaOrcamento(70.01)).toBe('atencao')
      expect(faixaOrcamento(90)).toBe('atencao')
      expect(faixaOrcamento(90.01)).toBe('proximo')
      expect(faixaOrcamento(100)).toBe('proximo')
      expect(faixaOrcamento(100.01)).toBe('excedido')
    })
  })

  it('realizado abaixo do planejado', () => {
    const a = avaliarOrcamento(100000, 60000)
    expect(a.desvioAbsolutoCentavos).toBe(-40000)
    expect(a.desvioPercentual).toBe(-40)
    expect(a.saldoDisponivelCentavos).toBe(40000)
    expect(a.percentualUtilizado).toBe(60)
    expect(a.faixa).toBe('dentro')
    expect(a.excedida).toBe(false)
  })
  it('realizado acima do planejado', () => {
    const a = avaliarOrcamento(100000, 130000)
    expect(a.desvioAbsolutoCentavos).toBe(30000)
    expect(a.desvioPercentual).toBe(30)
    expect(a.saldoDisponivelCentavos).toBe(-30000)
    expect(a.percentualUtilizado).toBe(130)
    expect(a.faixa).toBe('excedido')
    expect(a.excedida).toBe(true)
  })
  it('realizado igual ao planejado não é excedido', () => {
    const a = avaliarOrcamento(100000, 100000)
    expect(a.excedida).toBe(false)
    expect(a.faixa).toBe('proximo')
  })
  it('planejado zero deixa percentuais indisponíveis', () => {
    const a = avaliarOrcamento(0, 5000)
    expect(a.desvioPercentual).toBeNull()
    expect(a.percentualUtilizado).toBeNull()
    expect(a.faixa).toBeNull()
    expect(a.excedida).toBe(true)
  })
  it('sem gasto nenhum', () => {
    const a = avaliarOrcamento(100000, 0)
    expect(a.percentualUtilizado).toBe(0)
    expect(a.faixa).toBe('dentro')
  })
  it('conta Categorias excedidas', () => {
    const lista = [avaliarOrcamento(100, 150), avaliarOrcamento(100, 100), avaliarOrcamento(100, 10), avaliarOrcamento(100, 101)]
    expect(contarExcedidas(lista)).toBe(2)
  })

  describe('projeção de fechamento', () => {
    it('realizado / dias decorridos × dias do mês', () => {
      const p = projetarFechamento(50000, 120000, 10, 30)!
      expect(p.projecaoCentavos).toBe(150000)
      expect(p.desvioProjetadoCentavos).toBe(30000)
      expect(p.utilizacaoProjetada).toBe(125)
    })
    it('arredonda ao centavo', () => {
      expect(projetarFechamento(10000, 0, 3, 30)!.projecaoCentavos).toBe(100000)
      expect(projetarFechamento(1000, 0, 7, 30)!.projecaoCentavos).toBe(4286)
    })
    it('planejado zero deixa a utilização projetada indisponível', () => {
      expect(projetarFechamento(5000, 0, 10, 30)!.utilizacaoProjetada).toBeNull()
    })
    it('sem dias decorridos não projeta', () => {
      expect(projetarFechamento(5000, 1000, 0, 30)).toBeNull()
    })
  })
})

describe('filtrarPorPeriodo e diferencaPontos', () => {
  it('inclui as duas pontas do período', () => {
    const itens = [{ data: '2026-10-31' }, { data: '2026-11-01' }, { data: '2026-11-10' }, { data: '2026-11-11' }]
    expect(filtrarPorPeriodo(itens, { de: '2026-11-01', ate: '2026-11-10' })).toEqual([
      { data: '2026-11-01' },
      { data: '2026-11-10' },
    ])
  })
  it('diferença em pontos percentuais, indisponível se faltar uma ponta', () => {
    expect(diferencaPontos(30, 20)).toBe(10)
    expect(diferencaPontos(10, 25)).toBe(-15)
    expect(diferencaPontos(null, 20)).toBeNull()
    expect(diferencaPontos(20, null)).toBeNull()
  })
})

describe('Cartões (M32)', () => {
  it('utilização do limite', () => {
    expect(utilizacaoLimite(250000, 1000000)).toBe(25)
    expect(utilizacaoLimite(1200000, 1000000)).toBe(120)
    expect(utilizacaoLimite(0, 1000000)).toBe(0)
    expect(utilizacaoLimite(-500, 1000000)).toBe(0)
  })
  it('limite ausente ou zero deixa a utilização indisponível', () => {
    expect(utilizacaoLimite(1000, null)).toBeNull()
    expect(utilizacaoLimite(1000, 0)).toBeNull()
  })

  it('soma por chave, maior total primeiro, empate pela chave', () => {
    const r = somarPorChave([
      { chave: 'Nubank', valorCentavos: 3000 },
      { chave: 'Manual', valorCentavos: 5000 },
      { chave: 'Nubank', valorCentavos: 2000 },
      { chave: 'Itaú', valorCentavos: 5000 },
    ])
    expect(r.map((x) => x.chave)).toEqual(['Itaú', 'Manual', 'Nubank'])
    expect(r.find((x) => x.chave === 'Nubank')).toEqual({ chave: 'Nubank', totalCentavos: 5000, quantidade: 2 })
    expect(somarPorChave([])).toEqual([])
  })

  it('maior compra', () => {
    const itens = [
      { titulo: 'a', valorCentavos: 100 },
      { titulo: 'b', valorCentavos: 900 },
      { titulo: 'c', valorCentavos: 400 },
    ]
    expect(maiorCompra(itens)?.titulo).toBe('b')
    expect(maiorCompra([])).toBeNull()
  })

  describe('fatura média', () => {
    const mes = (m: string, total: number) => ({ mes: m, totalCentavos: total })
    it('média dos últimos 6 meses com fatura', () => {
      const pontos = [
        mes('2026-01', 100000),
        mes('2026-02', 100000),
        mes('2026-03', 200000),
        mes('2026-04', 200000),
        mes('2026-05', 300000),
        mes('2026-06', 300000),
        mes('2026-07', 400000),
      ]
      // Fica de fora janeiro: (100+200+200+300+300+400)/6
      expect(faturaMedia(pontos)).toEqual({ mediaCentavos: 250000, meses: 6 })
    })
    it('ignora meses sem fatura em vez de contar como zero', () => {
      expect(faturaMedia([mes('2026-08', 0), mes('2026-09', 90000), mes('2026-10', 0), mes('2026-11', 110000)])).toEqual({
        mediaCentavos: 100000,
        meses: 2,
      })
    })
    it('menos de 6 meses usa os que existem; nenhum → indisponível', () => {
      expect(faturaMedia([mes('2026-11', 50000)])).toEqual({ mediaCentavos: 50000, meses: 1 })
      expect(faturaMedia([])).toEqual({ mediaCentavos: null, meses: 0 })
      expect(faturaMedia([mes('2026-11', 0)])).toEqual({ mediaCentavos: null, meses: 0 })
    })
    it('arredonda ao centavo', () => {
      expect(faturaMedia([mes('2026-10', 100), mes('2026-11', 101)]).mediaCentavos).toBe(101)
    })
  })

  describe('compromissos futuros', () => {
    it('espalha as parcelas restantes do cartão a partir do próximo mês', () => {
      const r = compromissosFuturos(
        [{ restantes: 3, valorParcelaCentavos: 25000, proximoMes: '2026-12' }],
        [],
        '2026-11',
        4,
      )
      expect(r.map((m) => m.cartaoCentavos)).toEqual([0, 25000, 25000, 25000])
      expect(totalCompromissos(r)).toBe(75000)
    })
    it('soma Planejamentos parcelados no mês de vencimento, virando o ano', () => {
      const r = compromissosFuturos(
        [{ restantes: 2, valorParcelaCentavos: 10000, proximoMes: '2026-12' }],
        [
          { competencia: '2026-12-01', valorPrevistoCentavos: 30000 },
          { competencia: '2027-01-01', valorPrevistoCentavos: 30000 },
          { competencia: '2027-01-01', valorPrevistoCentavos: 5000 },
        ],
        '2026-11',
        3,
      )
      expect(r).toEqual([
        { mes: '2026-11', cartaoCentavos: 0, planejamentoCentavos: 0, totalCentavos: 0 },
        { mes: '2026-12', cartaoCentavos: 10000, planejamentoCentavos: 30000, totalCentavos: 40000 },
        { mes: '2027-01', cartaoCentavos: 10000, planejamentoCentavos: 35000, totalCentavos: 45000 },
      ])
    })
    it('o que vence depois da janela não entra', () => {
      const r = compromissosFuturos([{ restantes: 10, valorParcelaCentavos: 100, proximoMes: '2026-11' }], [], '2026-11', 3)
      expect(totalCompromissos(r)).toBe(300)
    })
    it('sem compromissos, tudo zero', () => {
      const r = compromissosFuturos([], [], '2026-11', 12)
      expect(r).toHaveLength(12)
      expect(totalCompromissos(r)).toBe(0)
    })
  })
})
