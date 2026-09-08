import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import BarraLimite, { calcularPercentual } from '../features/categorias/BarraLimite'
import EntradaFormModal from '../features/entradas/EntradaFormModal'
import BarraCartao from '../features/fontes/BarraCartao'
import type { FonteComSaldo } from '../features/saidas/elegibilidade'
import SaidaFormModal from '../features/saidas/SaidaFormModal'
import { useAsync } from '../hooks/useAsync'
import { ehFuturo, formatarData } from '../lib/date'
import { formatBRL } from '../lib/money'
import { listarSaldosCategorias } from '../services/categorias'
import { listarEntradas } from '../services/entradas'
import { listarFontes, listarSaldosFontes } from '../services/fontes'
import { obterResumoGeral } from '../services/resumo'
import { listarSaidas } from '../services/saidas'
import type { Entrada, Saida } from '../types/domain'

async function carregarFontes(): Promise<FonteComSaldo[]> {
  const [fontes, saldos] = await Promise.all([
    listarFontes({ incluirArquivadas: true }),
    listarSaldosFontes(),
  ])
  const mapaSaldos = new Map(saldos.map((s) => [s.id, s.saldoCentavos]))
  return fontes
    .filter((f) => !f.arquivada)
    .map((f) => ({ ...f, saldoCentavos: mapaSaldos.get(f.id) ?? 0 }))
}

type Lancamento =
  | { tipo: 'entrada'; item: Entrada }
  | { tipo: 'saida'; item: Saida }

async function carregarLancamentos(): Promise<Lancamento[]> {
  const [entradas, saidas] = await Promise.all([
    listarEntradas({ limite: 10 }),
    listarSaidas({ limite: 10 }),
  ])
  const lancamentos: Lancamento[] = [
    ...entradas.map((item): Lancamento => ({ tipo: 'entrada', item })),
    ...saidas.map((item): Lancamento => ({ tipo: 'saida', item })),
  ].filter((l) => !ehFuturo(l.item.data))
  return lancamentos.sort((a, b) => b.item.data.localeCompare(a.item.data)).slice(0, 10)
}

function Skeleton({ altura }: { altura: string }) {
  return <div className={`animate-pulse rounded bg-line ${altura}`} />
}

function BlocoErro({ mensagem, onTentar }: { mensagem: string; onTentar(): void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-alerta">{mensagem}</p>
      <Button variant="secondary" onClick={onTentar}>
        Tentar de novo
      </Button>
    </div>
  )
}

function DashboardPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const resumo = useAsync(obterResumoGeral, [])
  const fontes = useAsync(carregarFontes, [])
  const categorias = useAsync(listarSaldosCategorias, [])
  const lancamentos = useAsync(carregarLancamentos, [])

  const [formSaidaAberto, setFormSaidaAberto] = useState(false)
  const [formEntradaAberto, setFormEntradaAberto] = useState(false)
  const [aberturaId, setAberturaId] = useState(0)

  function recarregarTudo() {
    resumo.recarregar()
    fontes.recarregar()
    categorias.recarregar()
    lancamentos.recarregar()
  }

  function abrirSaida() {
    setFormSaidaAberto(true)
    setAberturaId((id) => id + 1)
  }

  function abrirEntrada() {
    setFormEntradaAberto(true)
    setAberturaId((id) => id + 1)
  }

  const fontesOrdenadas = useMemo(() => {
    const base = (fontes.data ?? []).filter((f) => !f.ehCartao)
    return [...base].sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'livre' ? -1 : 1
      return b.saldoCentavos - a.saldoCentavos
    })
  }, [fontes.data])

  const cartoes = useMemo(() => (fontes.data ?? []).filter((f) => f.ehCartao), [fontes.data])

  const categoriasComLimite = useMemo(() => {
    const base = (categorias.data ?? []).filter((c) => c.limiteMensalCentavos !== null)
    return [...base].sort(
      (a, b) =>
        calcularPercentual(b.totalGastoCentavos, b.limiteAcumuladoCentavos ?? 0) -
        calcularPercentual(a.totalGastoCentavos, a.limiteAcumuladoCentavos ?? 0),
    )
  }, [categorias.data])

  const categoriasNaoArquivadas = useMemo(
    () => (categorias.data ?? []).filter((c) => !c.arquivada),
    [categorias.data],
  )

  const semFontesECategorias =
    fontes.data !== undefined &&
    categorias.data !== undefined &&
    fontes.data.length === 0 &&
    categoriasNaoArquivadas.length === 0

  return (
    <>
      <PageHeader
        title="Painel"
        action={
          <div className="hidden gap-2 md:flex">
            <Button variant="secondary" onClick={abrirEntrada}>
              Registrar entrada
            </Button>
            <Button onClick={abrirSaida}>Registrar saída</Button>
          </div>
        }
      />

      {semFontesECategorias ? (
        <Onboarding
          temCategorias={(categorias.data ?? []).length > 0}
          temFontes={(fontes.data ?? []).length > 0}
          temEntradas={(lancamentos.data ?? []).some((l) => l.tipo === 'entrada')}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            {resumo.isLoading && <Skeleton altura="h-24" />}
            {resumo.erro && (
              <BlocoErro mensagem="Não foi possível carregar o resumo." onTentar={resumo.recarregar} />
            )}
            {resumo.data && (
              <div>
                <p className="text-sm text-ink-soft">Disponível para gastar</p>
                <p className="font-money text-[40px] font-semibold text-livre">
                  {formatBRL(resumo.data.saldoLivreCentavos)}
                </p>
                <p className="text-sm text-ink-soft">
                  {formatBRL(resumo.data.saldoRestritoCentavos)} em fontes restritas ·{' '}
                  {formatBRL(resumo.data.saldoTotalCentavos)} no total
                </p>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Fontes</h2>
            {fontes.isLoading && <Skeleton altura="h-32" />}
            {fontes.erro && (
              <BlocoErro mensagem="Não foi possível carregar as fontes." onTentar={fontes.recarregar} />
            )}
            {fontes.data && fontes.data.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {fontesOrdenadas.slice(0, 6).map((fonte) => {
                    const cor = fonte.tipo === 'livre' ? 'var(--color-livre)' : 'var(--color-restrita)'
                    return (
                      <button
                        key={fonte.id}
                        type="button"
                        onClick={() => navigate('/fontes')}
                        className="flex flex-col gap-1 rounded bg-surface p-3 text-left shadow-sm"
                        style={{ borderLeft: `3px solid ${cor}` }}
                      >
                        <span className="text-sm text-ink">{fonte.nome}</span>
                        <span className="font-money text-lg font-semibold text-ink">
                          {formatBRL(fonte.saldoCentavos)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {fontesOrdenadas.length > 6 && (
                  <Link to="/fontes" className="mt-2 inline-block text-sm text-livre">
                    Ver todas
                  </Link>
                )}
              </>
            )}
          </section>

          {cartoes.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-ink-soft">Cartões de crédito</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cartoes.map((cartao) => (
                  <button
                    key={cartao.id}
                    type="button"
                    onClick={() => navigate('/fontes')}
                    className="flex flex-col gap-1 rounded bg-surface p-3 text-left shadow-sm"
                    style={{ borderLeft: '3px solid var(--color-livre)' }}
                  >
                    <span className="text-sm text-ink">{cartao.nome}</span>
                    <BarraCartao
                      usadoCentavos={-cartao.saldoCentavos}
                      limiteCentavos={cartao.limiteCentavos ?? 0}
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Consumo de categorias</h2>
            {categorias.isLoading && <Skeleton altura="h-32" />}
            {categorias.erro && (
              <BlocoErro
                mensagem="Não foi possível carregar as categorias."
                onTentar={categorias.recarregar}
              />
            )}
            {categorias.data && categoriasComLimite.length === 0 && (
              <p className="text-sm text-ink-soft">
                Defina limites nas suas categorias para acompanhar o consumo aqui.{' '}
                <Link to="/categorias" className="text-livre">
                  Ir para Categorias
                </Link>
              </p>
            )}
            {categorias.data && categoriasComLimite.length > 0 && (
              <>
                <div className="flex flex-col gap-4">
                  {categoriasComLimite.slice(0, 5).map((categoria) => (
                    <div key={categoria.id}>
                      <p className="text-sm text-ink">{categoria.nome}</p>
                      <BarraLimite
                        totalGastoCentavos={categoria.totalGastoCentavos}
                        limiteAcumuladoCentavos={categoria.limiteAcumuladoCentavos}
                        gastoMesAtualCentavos={categoria.gastoMesAtualCentavos}
                      />
                    </div>
                  ))}
                </div>
                {categoriasComLimite.length > 5 && (
                  <Link to="/categorias" className="mt-2 inline-block text-sm text-livre">
                    Ver todas
                  </Link>
                )}
              </>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Últimos lançamentos</h2>
            {lancamentos.isLoading && <Skeleton altura="h-48" />}
            {lancamentos.erro && (
              <BlocoErro
                mensagem="Não foi possível carregar os lançamentos."
                onTentar={lancamentos.recarregar}
              />
            )}
            {lancamentos.data && lancamentos.data.length === 0 && (
              <p className="text-sm text-ink-soft">Nenhum lançamento ainda.</p>
            )}
            {lancamentos.data && lancamentos.data.length > 0 && (
              <ul className="flex flex-col">
                {lancamentos.data.map((l) => {
                  const mes = l.item.data.slice(0, 7)
                  const destino = l.tipo === 'entrada' ? '/entradas' : '/saidas'
                  const valor = l.tipo === 'entrada' ? l.item.valorCentavos : l.item.valorTotalCentavos
                  return (
                    <li
                      key={`${l.tipo}-${l.item.id}`}
                      className="flex cursor-pointer items-center gap-3 border-b border-line py-2"
                      onClick={() => navigate(`${destino}?mes=${mes}`)}
                    >
                      <span className="w-20 shrink-0 text-sm text-ink-soft">
                        {formatarData(l.item.data)}
                      </span>
                      <span className="flex-1 truncate text-sm text-ink">{l.item.titulo}</span>
                      <span
                        className={`font-money w-28 shrink-0 text-right text-sm ${
                          l.tipo === 'entrada' ? 'text-livre' : 'text-ink'
                        }`}
                      >
                        {l.tipo === 'entrada' ? '+ ' : '− '}
                        {formatBRL(valor)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <SaidaFormModal
        key={`saida-${aberturaId}`}
        aberto={formSaidaAberto}
        fontes={fontes.data ?? []}
        categorias={categoriasNaoArquivadas}
        saldosCategorias={categoriasNaoArquivadas}
        onFechar={() => setFormSaidaAberto(false)}
        onSalvo={() => {
          setFormSaidaAberto(false)
          recarregarTudo()
        }}
      />

      <EntradaFormModal
        key={`entrada-${aberturaId}`}
        aberto={formEntradaAberto}
        fontes={fontes.data ?? []}
        onFechar={() => setFormEntradaAberto(false)}
        onSalvo={(fonteId) => {
          setFormEntradaAberto(false)
          recarregarTudo()
          const fonte = (fontes.data ?? []).find((f) => f.id === fonteId)
          if (fonte) showToast(`Entrada registrada. ${fonte.nome} agora tem saldo atualizado.`, 'success')
        }}
      />

      {!formSaidaAberto && (
        <button
          type="button"
          aria-label="Registrar saída"
          onClick={abrirSaida}
          className="fixed bottom-20 right-4 z-30 rounded-full bg-livre px-5 py-3 text-sm font-medium text-white shadow-lg md:hidden"
        >
          Registrar saída
        </button>
      )}
    </>
  )
}

function Onboarding({
  temCategorias,
  temFontes,
  temEntradas,
}: {
  temCategorias: boolean
  temFontes: boolean
  temEntradas: boolean
}) {
  const passos = [
    {
      feito: temCategorias,
      disponivel: true,
      titulo: 'Crie suas categorias',
      texto: 'Como você organiza seus gastos.',
      link: '/categorias',
    },
    {
      feito: temFontes,
      disponivel: temCategorias,
      titulo: 'Crie suas fontes',
      texto:
        'De onde o dinheiro sai. Marque como restrita as que só pagam certas coisas, como vale-refeição.',
      link: '/fontes',
    },
    {
      feito: temEntradas,
      disponivel: temFontes,
      titulo: 'Registre sua primeira entrada',
      texto: 'Seu salário, seu VR, qualquer dinheiro que você recebeu.',
      link: '/entradas',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {passos.map((passo, indice) => (
        <div
          key={passo.titulo}
          className={`flex items-start gap-3 rounded border border-line p-4 ${
            passo.disponivel ? '' : 'opacity-50'
          }`}
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              passo.feito ? 'bg-livre text-white' : 'bg-base text-ink-soft'
            }`}
          >
            {passo.feito ? '✓' : indice + 1}
          </span>
          <div className="flex-1">
            <p className="font-medium text-ink">{passo.titulo}</p>
            <p className="text-sm text-ink-soft">{passo.texto}</p>
          </div>
          {passo.disponivel && !passo.feito && (
            <Link to={passo.link} className="text-sm text-livre">
              Ir
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}

export default DashboardPage
