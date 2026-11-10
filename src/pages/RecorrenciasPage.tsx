import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import AcoesMenu from '../components/ui/AcoesMenu'
import SeloFonte from '../components/ui/SeloFonte'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import ConfirmarFaturaModal from '../features/recorrencias/ConfirmarFaturaModal'
import IndicadorNota from '../features/notas/IndicadorNota'
import RecorrenciaFormModal from '../features/recorrencias/RecorrenciaFormModal'
import type { FonteComSaldo } from '../features/saidas/elegibilidade'
import { useAsync } from '../hooks/useAsync'
import { deslocarMes, formatarData, hojeISO, mesAtual, nomeDoMes } from '../lib/date'
import { mensagemDoErro } from '../lib/erros'
import { resumoDoTipo, subtituloPlanejamento, tipoPorSlug } from '../lib/planejamento'
import { formatBRL } from '../lib/money'
import {
  lerFiltroRecorrencia,
  statusDaRecorrencia,
  rotuloFontesPrevistas,
  valorEfetivo,
  type FiltroRecorrencia,
} from '../lib/recorrencias'
import { listarCategorias } from '../services/categorias'
import { listarFontes, listarSaldosFontes } from '../services/fontes'
import {
  definirRecorrenciaAtiva,
  desmarcarPagamento,
  excluirRecorrencia,
  listarFaturasPendentes,
  listarPlanejamentoPagina,
  listarResumoPlanejamento,
  listarTiposPlanejamento,
  marcarComoPaga,
  obterRecorrencia,
} from '../services/recorrencias'
import type { FaturaPendente, Recorrencia, RecorrenciaDoMes, StatusRecorrencia } from '../types/domain'

async function carregarDados(mes: string) {
  const [resumoPorTipo, tipos, faturas, categorias, fontesBase, saldosFontes] = await Promise.all([
    listarResumoPlanejamento(mes),
    listarTiposPlanejamento(),
    listarFaturasPendentes(),
    listarCategorias(),
    listarFontes({ incluirArquivadas: true }),
    listarSaldosFontes(),
  ])
  const mapaSaldos = new Map(saldosFontes.map((s) => [s.id, s.saldoCentavos]))
  const fontes: FonteComSaldo[] = fontesBase.map((f) => ({
    ...f,
    saldoCentavos: mapaSaldos.get(f.id) ?? 0,
  }))
  return { resumoPorTipo, tipos, faturas, categorias: categorias.filter((c) => !c.arquivada), fontes }
}

const OPCOES_FILTRO: { valor: FiltroRecorrencia; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'a-pagar', rotulo: 'A pagar' },
  { valor: 'pagas', rotulo: 'Pagas' },
]

const ESTILO_STATUS: Record<StatusRecorrencia, { rotulo: string; classe: string }> = {
  paga: { rotulo: 'Paga', classe: 'bg-livre/10 text-livre' },
  pendente: { rotulo: 'Pendente', classe: 'bg-base text-ink-soft' },
  atrasada: { rotulo: 'Atrasada', classe: 'bg-alerta/10 text-alerta' },
}

function CardResumo({ rotulo, centavos, detalhe }: { rotulo: string; centavos: number; detalhe?: string }) {
  return (
    <div className="min-w-[8.5rem] rounded border border-line bg-surface px-3 py-2">
      <p className="text-xs text-ink-soft">{rotulo}</p>
      <p className="font-money text-lg font-semibold text-ink">{formatBRL(centavos)}</p>
      {detalhe && <p className="font-money text-xs text-ink-soft">{detalhe}</p>}
    </div>
  )
}

function RecorrenciasPage() {
  const { showToast } = useToast()
  const { tipo: slugTipo } = useParams()
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') ?? mesAtual()
  const dados = useAsync(() => carregarDados(mes), [mes])
  const hoje = hojeISO()
  const tipos = dados.data?.tipos
  const tipoAtual = tipos ? tipoPorSlug(tipos, slugTipo) : undefined
  const slugInvalido = Boolean(slugTipo && tipos && !tipoAtual)
  const aguardandoTipo = Boolean(slugTipo && !tipos)
  const tipoId = tipoAtual?.id

  const [aberturaId, setAberturaId] = useState(0)
  const [formAberto, setFormAberto] = useState<{ recorrencia?: Recorrencia } | null>(null)
  const [pagando, setPagando] = useState<RecorrenciaDoMes | null>(null)
  const [pagoEm, setPagoEm] = useState(hoje)
  const [excluindo, setExcluindo] = useState<RecorrenciaDoMes | null>(null)
  const [fatura, setFatura] = useState<FaturaPendente | null>(null)
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const filtro = lerFiltroRecorrencia(params.get('status'))

  // Lista paginada pela API (10 por vez). `versaoLista` força recarga após uma ação.
  const [itens, setItens] = useState<RecorrenciaDoMes[]>([])
  const [totalFiltrado, setTotalFiltrado] = useState(0)
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erroLista, setErroLista] = useState(false)
  const [versaoLista, setVersaoLista] = useState(0)
  // Quantos itens refazer na próxima busca (recarga após ação); consumido e zerado pelo effect.
  const tamanhoRecarga = useRef(0)
  const contextoLista = `${mes}|${tipoId ?? ''}|${filtro}`
  const contextoRef = useRef(contextoLista)
  contextoRef.current = contextoLista

  useEffect(() => {
    if (aguardandoTipo || slugInvalido) return
    let cancelado = false
    const tamanho = tamanhoRecarga.current
    tamanhoRecarga.current = 0
    setCarregandoLista(true)
    setErroLista(false)
    listarPlanejamentoPagina({ competencia: mes, tipoId, filtro, offset: 0, tamanho: tamanho || undefined })
      .then((pagina) => {
        if (cancelado) return
        setItens(pagina.itens)
        setTotalFiltrado(pagina.total)
      })
      .catch(() => {
        if (!cancelado) setErroLista(true)
      })
      .finally(() => {
        if (!cancelado) setCarregandoLista(false)
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, tipoId, filtro, versaoLista, aguardandoTipo, slugInvalido])

  const recarregarTudo = useCallback(() => {
    tamanhoRecarga.current = Math.max(itens.length, 1)
    setVersaoLista((v) => v + 1)
    dados.recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.length, dados.recarregar])

  async function carregarMais() {
    setCarregandoMais(true)
    const contexto = contextoLista
    try {
      const pagina = await listarPlanejamentoPagina({ competencia: mes, tipoId, filtro, offset: itens.length })
      if (contexto !== contextoRef.current) return // trocou mês/Tipo/filtro no meio
      setItens((atuais) => [...atuais, ...pagina.itens])
      setTotalFiltrado(pagina.total)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setCarregandoMais(false)
    }
  }

  const resumo = useMemo(
    () => resumoDoTipo(dados.data?.resumoPorTipo ?? [], tipoId),
    [dados.data, tipoId],
  )
  const visiveis = itens
  const mapaFontes = useMemo(
    () => new Map((dados.data?.fontes ?? []).map((f) => [f.id, f])),
    [dados.data],
  )
  const fontesPagadoras = (dados.data?.fontes ?? []).filter((f) => !f.ehCartao && !f.arquivada)
  const estaNoMesCorrente = mes === mesAtual()

  function mudarFiltro(novo: FiltroRecorrencia) {
    setParams((p) => {
      p.set('status', novo)
      return p
    })
  }

  function irParaMes(novo: string) {
    setParams((p) => {
      p.set('mes', novo)
      return p
    })
  }

  async function executar(acao: () => Promise<void>, sucesso: string) {
    setOcupado(true)
    try {
      await acao()
      showToast(sucesso, 'success')
      recarregarTudo()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setOcupado(false)
    }
  }

  function abrirPagar(item: RecorrenciaDoMes) {
    // Default: hoje se for o mês corrente; senão, o dia da recorrência na competência.
    setPagoEm(item.competencia === mesAtual() ? hoje : `${item.competencia}-${String(Math.min(item.dia, 28)).padStart(2, '0')}`)
    setPagando(item)
  }

  async function abrirEditar(item: RecorrenciaDoMes) {
    try {
      const recorrencia = await obterRecorrencia(item.recorrenciaId)
      setFormAberto({ recorrencia })
      setAberturaId((id) => id + 1)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    }
  }

  if (slugInvalido) return <Navigate to="/recorrencias" replace />

  return (
    <>
      <PageHeader
        title="Planejamento Financeiro"
        subtitle={subtituloPlanejamento(tipoAtual)}
        cards={
          dados.data && (
            <div className="flex gap-3">
              <CardResumo rotulo="Pago" centavos={resumo.pagoCentavos} detalhe={`de ${formatBRL(resumo.previstoCentavos)}`} />
              <CardResumo rotulo="Falta" centavos={resumo.faltaCentavos} />
            </div>
          )
        }
        action={
          <Button
            onClick={() => {
              setFormAberto({})
              setAberturaId((id) => id + 1)
            }}
          >
            Novo planejamento
          </Button>
        }
      />

      {/* Mobile: as subseções viram chips no topo; no desktop ficam na sidebar. */}
      {tipos && (
        <nav aria-label="Subseções do planejamento" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:hidden">
          {[{ to: '/recorrencias', label: 'Geral' }, ...tipos.map((t) => ({ to: `/recorrencias/${t.slug}`, label: t.nome }))].map(
            (chip) => (
              <NavLink
                key={chip.to}
                to={chip.to}
                end
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-3 py-1 text-sm ${isActive ? 'bg-ink text-surface' : 'bg-base text-ink-soft'}`
                }
              >
                {chip.label}
              </NavLink>
            ),
          )}
        </nav>
      )}

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          aria-label="Mês anterior"
          className="rounded px-2 py-1 text-ink-soft hover:bg-base"
          onClick={() => irParaMes(deslocarMes(mes, -1))}
        >
          ‹
        </button>
        <span className="min-w-[10rem] text-center text-sm font-medium text-ink">{nomeDoMes(mes)}</span>
        <button
          type="button"
          aria-label="Próximo mês"
          className="rounded px-2 py-1 text-ink-soft hover:bg-base"
          onClick={() => irParaMes(deslocarMes(mes, 1))}
        >
          ›
        </button>
        {!estaNoMesCorrente && (
          <Button variant="ghost" onClick={() => irParaMes(mesAtual())}>
            Hoje
          </Button>
        )}
      </div>

      {dados.isLoading && !dados.data && <Spinner />}
      {(dados.erro || erroLista) && <p className="text-sm text-alerta">Não foi possível carregar o planejamento.</p>}

      {dados.data && (
        <div className="flex flex-col gap-8">
          {estaNoMesCorrente && dados.data.faturas.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-ink-soft">Faturas de cartão</h2>
              <ul className="flex flex-col">
                {dados.data.faturas.map((f) => (
                  <li key={f.fonteId} className="flex items-center gap-3 border-b border-line py-2">
                    <span className="w-16 shrink-0 text-sm text-ink-soft">dia {f.diaFatura}</span>
                    <span className="flex-1 truncate text-sm text-ink">Fatura {f.nome}</span>
                    <span className="font-money text-sm text-ink">{formatBRL(f.valorSugeridoCentavos)}</span>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFatura(f)
                        setAberturaId((id) => id + 1)
                      }}
                    >
                      Pagar
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!tipoAtual && tipos && resumo.quantidade > 0 && (
            <section aria-label="Quantitativos por tipo">
              <h2 className="mb-3 text-sm font-medium text-ink-soft">Por tipo</h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...tipos.map((t) => ({ chave: t.id, nome: t.nome, ...resumoDoTipo(dados.data!.resumoPorTipo, t.id) })),
                  { chave: 'total', nome: 'Total geral', ...resumo }].map((linha) => (
                  <li key={linha.chave} className="rounded border border-line bg-surface px-3 py-2">
                    <p className="flex items-baseline justify-between text-sm text-ink">
                      <span className={linha.chave === 'total' ? 'font-semibold' : ''}>{linha.nome}</span>
                      <span className="text-xs text-ink-soft">{linha.quantidade}</span>
                    </p>
                    <p className="font-money text-xs text-ink-soft">
                      Pago {formatBRL(linha.pagoCentavos)} · Falta {formatBRL(linha.faltaCentavos)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resumo.quantidade === 0 && !carregandoLista ? (
            <EmptyState
              titulo="Nenhum planejamento neste mês"
              texto="Cadastre seus planejamentos (assinaturas, contas, parcelas, dívidas) para acompanhar o que já foi pago e o que falta pagar."
            />
          ) : (
            <section>

              <div role="group" aria-label="Filtrar por status" className="mb-3 flex gap-1">
                {OPCOES_FILTRO.map((opcao) => (
                  <button
                    key={opcao.valor}
                    type="button"
                    aria-pressed={filtro === opcao.valor}
                    onClick={() => mudarFiltro(opcao.valor)}
                    className={`rounded-full px-3 py-1 text-sm ${
                      filtro === opcao.valor ? 'bg-ink text-surface' : 'text-ink-soft hover:bg-base'
                    }`}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
              </div>

              {visiveis.length === 0 && !carregandoLista && (
                <p className="py-4 text-sm text-ink-soft">
                  {filtro === 'pagas' ? `Nada pago em ${nomeDoMes(mes)} ainda.` : `Tudo pago em ${nomeDoMes(mes)}.`}
                </p>
              )}

              <ul className="flex flex-col">
                {visiveis.map((item) => {
                  const status = statusDaRecorrencia(item, hoje)
                  const estilo = ESTILO_STATUS[status]
                  const valorReal = item.valorPagoCentavos
                  return (
                    <li
                      key={item.recorrenciaId}
                      className="group flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2"
                    >
                      <span className="w-14 shrink-0 text-sm text-ink-soft">dia {item.dia}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {item.titulo}
                        {item.totalParcelas !== null && (
                          <span className="ml-1 text-xs text-ink-soft">
                            {item.parcela}/{item.totalParcelas}
                          </span>
                        )}
                        {item.categoriaNome && (
                          <span className="ml-2 hidden text-xs text-ink-soft sm:inline">{item.categoriaNome}</span>
                        )}
                      </span>
                      <IndicadorNota nota={item.nota} />
                      {item.saidaId && (
                        <Link
                          to={`/saidas?mes=${(item.saidaData ?? item.pagoEm ?? '').slice(0, 7)}&editar=${item.saidaId}`}
                          className="max-w-[14rem] shrink-0 truncate text-xs text-ink-soft underline-offset-2 hover:underline"
                          title="Abrir a saída que pagou este planejamento"
                        >
                          ↻ {item.saidaTitulo ?? 'Saída'}
                          {item.saidaData && ` · ${formatarData(item.saidaData)}`}
                        </Link>
                      )}
                      {item.fontesPrevistas.length > 0 && (
                        <span
                          className="flex max-w-[12rem] shrink-0 items-center gap-1 text-xs text-ink-soft"
                          title={`Previsto: ${item.fontesPrevistas.map((id) => mapaFontes.get(id)?.nome ?? '—').join(' + ')}`}
                        >
                          {item.fontesPrevistas.slice(0, 3).map((id) => (
                            <SeloFonte key={id} fonteId={id} cor={mapaFontes.get(id)?.cor} pequeno />
                          ))}
                          <span className="hidden truncate sm:inline">
                            {rotuloFontesPrevistas(item.fontesPrevistas, mapaFontes)}
                          </span>
                        </span>
                      )}
                      <span className="font-money w-24 shrink-0 text-right text-sm text-ink">
                        {formatBRL(item.pagamentoId ? valorEfetivo(item) : item.valorPrevistoCentavos)}
                        {valorReal !== null && valorReal !== item.valorPrevistoCentavos && (
                          <span className="block text-xs text-ink-soft line-through">
                            {formatBRL(item.valorPrevistoCentavos)}
                          </span>
                        )}
                      </span>
                      <span
                        className={`w-20 shrink-0 rounded px-2 py-0.5 text-center text-xs font-medium ${estilo.classe}`}
                        title={item.pagoEm ? `Paga em ${formatarData(item.pagoEm)}` : undefined}
                      >
                        {estilo.rotulo}
                      </span>
                      {item.pagamentoId ? (
                        <Button
                          variant="ghost"
                          disabled={ocupado}
                          onClick={() =>
                            executar(() => desmarcarPagamento(item.pagamentoId!), 'Pagamento desmarcado.')
                          }
                        >
                          Desmarcar
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled={ocupado} onClick={() => abrirPagar(item)}>
                          Marcar como paga
                        </Button>
                      )}
                      <AcoesMenu
                        aberto={menuAbertoId === item.recorrenciaId}
                        onToggle={() =>
                          setMenuAbertoId(menuAbertoId === item.recorrenciaId ? null : item.recorrenciaId)
                        }
                        onFechar={() => setMenuAbertoId(null)}
                        itens={[
                          { label: 'Editar', onClick: () => abrirEditar(item) },
                          item.ativa
                            ? {
                                label: 'Desativar',
                                onClick: () =>
                                  executar(
                                    () => definirRecorrenciaAtiva(item.recorrenciaId, false),
                                    'Planejamento desativado.',
                                  ),
                              }
                            : {
                                label: 'Reativar',
                                onClick: () =>
                                  executar(
                                    () => definirRecorrenciaAtiva(item.recorrenciaId, true),
                                    'Planejamento reativado.',
                                  ),
                              },
                          { label: 'Excluir', perigo: true, onClick: () => setExcluindo(item) },
                        ]}
                      />
                    </li>
                  )
                })}
              </ul>

              {itens.length < totalFiltrado && (
                <div className="mt-4 flex justify-center">
                  <Button variant="secondary" loading={carregandoMais} onClick={carregarMais}>
                    Carregar mais ({totalFiltrado - itens.length})
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {formAberto && (
        <RecorrenciaFormModal
          key={`form-${aberturaId}`}
          aberto
          recorrencia={formAberto.recorrencia}
          categorias={dados.data?.categorias ?? []}
          tipos={dados.data?.tipos ?? []}
          fontes={dados.data?.fontes ?? []}
          onFechar={() => setFormAberto(null)}
          onSalvo={() => {
            setFormAberto(null)
            showToast('Planejamento salvo.', 'success')
            recarregarTudo()
          }}
        />
      )}

      <Modal open={pagando !== null} onClose={() => setPagando(null)} title="Marcar como paga">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const item = pagando
            if (!item || !pagoEm) return
            setPagando(null)
            executar(() => marcarComoPaga(item.recorrenciaId, item.competencia, pagoEm), `${item.titulo} marcada como paga.`)
          }}
        >
          <p className="text-sm text-ink">
            {pagando?.titulo} — {nomeDoMes(pagando?.competencia ?? mes)}
          </p>
          {pagando && pagando.fontesPrevistas.length > 0 && (
            <p className="text-sm text-ink-soft">
              Previsto:{' '}
              {pagando.fontesPrevistas.map((id, i) => (
                <span key={id} className="inline-flex items-center gap-1">
                  {i > 0 && ' + '}
                  <SeloFonte fonteId={id} cor={mapaFontes.get(id)?.cor} pequeno />
                  {mapaFontes.get(id)?.nome ?? '—'}
                </span>
              ))}
            </p>
          )}
          <Input label="Pago em" type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPagando(null)}>
              Cancelar
            </Button>
            <Button type="submit">Confirmar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={excluindo !== null} onClose={() => setExcluindo(null)} title="Excluir planejamento">
        <p className="mb-4 text-sm text-ink">
          Excluir "{excluindo?.titulo}"? O histórico de pagamentos dela também é apagado. Lançamentos de
          Saída não são afetados. Para só parar de acompanhar, use Desativar.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setExcluindo(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={ocupado}
            onClick={() => {
              const item = excluindo
              if (!item) return
              setExcluindo(null)
              executar(() => excluirRecorrencia(item.recorrenciaId), 'Planejamento excluído.')
            }}
          >
            Excluir
          </Button>
        </div>
      </Modal>

      <ConfirmarFaturaModal
        key={`fatura-${aberturaId}`}
        aberto={fatura !== null}
        pendencia={fatura ?? undefined}
        cartao={mapaFontes.get(fatura?.fonteId ?? '')}
        fontesPagadoras={fontesPagadoras}
        onFechar={() => setFatura(null)}
        onSalvo={() => {
          setFatura(null)
          recarregarTudo()
        }}
      />
    </>
  )
}

export default RecorrenciasPage
