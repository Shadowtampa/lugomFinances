import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import AcoesMenu from '../components/ui/AcoesMenu'
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
import { formatBRL } from '../lib/money'
import {
  filtrarRecorrencias,
  lerFiltroRecorrencia,
  resumoDoMes,
  statusDaRecorrencia,
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
  listarRecorrenciasDoMes,
  marcarComoPaga,
  obterRecorrencia,
} from '../services/recorrencias'
import type { FaturaPendente, Recorrencia, RecorrenciaDoMes, StatusRecorrencia } from '../types/domain'

async function carregarDados(mes: string) {
  const [itens, faturas, categorias, fontesBase, saldosFontes] = await Promise.all([
    listarRecorrenciasDoMes(mes),
    listarFaturasPendentes(),
    listarCategorias(),
    listarFontes({ incluirArquivadas: false }),
    listarSaldosFontes(),
  ])
  const mapaSaldos = new Map(saldosFontes.map((s) => [s.id, s.saldoCentavos]))
  const fontes: FonteComSaldo[] = fontesBase.map((f) => ({
    ...f,
    saldoCentavos: mapaSaldos.get(f.id) ?? 0,
  }))
  return { itens, faturas, categorias: categorias.filter((c) => !c.arquivada), fontes }
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

function RecorrenciasPage() {
  const { showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') ?? mesAtual()
  const dados = useAsync(() => carregarDados(mes), [mes])
  const hoje = hojeISO()

  const [aberturaId, setAberturaId] = useState(0)
  const [formAberto, setFormAberto] = useState<{ recorrencia?: Recorrencia } | null>(null)
  const [pagando, setPagando] = useState<RecorrenciaDoMes | null>(null)
  const [pagoEm, setPagoEm] = useState(hoje)
  const [excluindo, setExcluindo] = useState<RecorrenciaDoMes | null>(null)
  const [fatura, setFatura] = useState<FaturaPendente | null>(null)
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const itens = useMemo(() => dados.data?.itens ?? [], [dados.data])
  const resumo = useMemo(() => resumoDoMes(itens), [itens])
  const filtro = lerFiltroRecorrencia(params.get('status'))
  const visiveis = useMemo(() => filtrarRecorrencias(itens, filtro), [itens, filtro])
  const mapaFontes = useMemo(
    () => new Map((dados.data?.fontes ?? []).map((f) => [f.id, f])),
    [dados.data],
  )
  const fontesPagadoras = (dados.data?.fontes ?? []).filter((f) => !f.ehCartao)
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
      dados.recarregar()
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

  return (
    <>
      <PageHeader
        title="Recorrências"
        action={
          <Button
            onClick={() => {
              setFormAberto({})
              setAberturaId((id) => id + 1)
            }}
          >
            Nova recorrência
          </Button>
        }
      />

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
      {dados.erro && <p className="text-sm text-alerta">Não foi possível carregar as recorrências.</p>}

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

          {itens.length === 0 ? (
            <EmptyState
              titulo="Nenhuma recorrência neste mês"
              texto="Cadastre suas contas fixas (internet, plano de saúde, parcelas) para acompanhar o que já foi pago e o que falta pagar."
            />
          ) : (
            <section>
              <p className="mb-1 text-sm text-ink">
                Pago <span className="font-money font-semibold">{formatBRL(resumo.pagoCentavos)}</span> de{' '}
                <span className="font-money">{formatBRL(resumo.previstoCentavos)}</span>
              </p>
              <p className="mb-4 text-sm text-ink-soft">
                Falta <span className="font-money">{formatBRL(resumo.faltaCentavos)}</span>
              </p>

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

              {visiveis.length === 0 && (
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
                                    'Recorrência desativada.',
                                  ),
                              }
                            : {
                                label: 'Reativar',
                                onClick: () =>
                                  executar(
                                    () => definirRecorrenciaAtiva(item.recorrenciaId, true),
                                    'Recorrência reativada.',
                                  ),
                              },
                          { label: 'Excluir', perigo: true, onClick: () => setExcluindo(item) },
                        ]}
                      />
                    </li>
                  )
                })}
              </ul>
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
          onFechar={() => setFormAberto(null)}
          onSalvo={() => {
            setFormAberto(null)
            showToast('Recorrência salva.', 'success')
            dados.recarregar()
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
          <Input label="Pago em" type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPagando(null)}>
              Cancelar
            </Button>
            <Button type="submit">Confirmar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={excluindo !== null} onClose={() => setExcluindo(null)} title="Excluir recorrência">
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
              executar(() => excluirRecorrencia(item.recorrenciaId), 'Recorrência excluída.')
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
          dados.recarregar()
        }}
      />
    </>
  )
}

export default RecorrenciasPage
