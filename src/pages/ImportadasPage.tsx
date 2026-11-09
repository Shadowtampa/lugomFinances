import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import ApelidoModal, { type AlvoApelido } from '../features/apelidos/ApelidoModal'
import { useAsync } from '../hooks/useAsync'
import { formatarData, haQuantoTempo, nomeDoMes } from '../lib/date'
import { mensagemDoErro, mensagemErroSincronizacao } from '../lib/erros'
import { ordenarParaConfirmacao } from '../lib/integracao'
import { formatBRL } from '../lib/money'
import { listarCategorias } from '../services/categorias'
import { listarFontes } from '../services/fontes'
import {
  confirmarImportada,
  confirmarPagamentoFatura,
  listarParesPagamentoFatura,
  desfazerIgnorarImportada,
  ignorarImportada,
  listarImportadas,
  listarSugestoesRecorrencia,
  obterStatusIntegracao,
  sincronizarAgora,
} from '../services/integracao'
import type { ParPagamentoFatura, TransacaoImportada } from '../types/domain'

async function carregarDados() {
  const [importadas, sugestoes, categorias, fontes, status, paresCandidatos] = await Promise.all([
    listarImportadas(),
    listarSugestoesRecorrencia(),
    listarCategorias(),
    listarFontes({ incluirArquivadas: true }),
    obterStatusIntegracao(),
    listarParesPagamentoFatura(),
  ])
  return { importadas, sugestoes, categorias, fontes, status, pares: escolherPares(paresCandidatos) }
}

/** Cada importada entra em no máximo um par; na dúvida, o de data mais próxima vem primeiro (já ordenado). */
function escolherPares(candidatos: ParPagamentoFatura[]): ParPagamentoFatura[] {
  const usados = new Set<string>()
  const pares: ParPagamentoFatura[] = []
  for (const p of candidatos) {
    if (usados.has(p.bancoId) || usados.has(p.cartaoId)) continue
    usados.add(p.bancoId)
    usados.add(p.cartaoId)
    pares.push(p)
  }
  return pares
}

/** Escolhas do usuário por linha (categoria e recorrência); default = sugestões. */
type Escolha = { categoriaId: string; recorrenciaId: string }

function ImportadasPage() {
  const { showToast } = useToast()
  const dados = useAsync(carregarDados, [])
  const [escolhas, setEscolhas] = useState<Record<string, Partial<Escolha>>>({})
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [emLote, setEmLote] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [mostrarDivergentes, setMostrarDivergentes] = useState(false)
  const [apelidoAlvo, setApelidoAlvo] = useState<AlvoApelido | null>(null)

  const pares = useMemo(() => dados.data?.pares ?? [], [dados.data])
  const pendentes = useMemo(() => {
    const emPar = new Set(pares.flatMap((p) => [p.bancoId, p.cartaoId]))
    return ordenarParaConfirmacao(
      (dados.data?.importadas ?? []).filter((t) => t.estado === 'pendente' && !emPar.has(t.id)),
    )
  }, [dados.data, pares])
  const divergentes = (dados.data?.importadas ?? []).filter((t) => t.estado === 'divergente')
  const nomeFonte = useMemo(
    () => new Map((dados.data?.fontes ?? []).map((f) => [f.id, f.nome])),
    [dados.data],
  )

  function sugestoesDe(t: TransacaoImportada) {
    return (dados.data?.sugestoes ?? []).filter((s) => s.transacaoId === t.id)
  }

  function escolhaDe(t: TransacaoImportada): Escolha {
    const e = escolhas[t.id] ?? {}
    return {
      categoriaId: e.categoriaId ?? t.categoriaSugeridaId ?? '',
      recorrenciaId: e.recorrenciaId ?? sugestoesDe(t)[0]?.recorrenciaId ?? '',
    }
  }

  function escolher(id: string, parcial: Partial<Escolha>) {
    setEscolhas((atual) => ({ ...atual, [id]: { ...atual[id], ...parcial } }))
  }

  async function confirmar(t: TransacaoImportada) {
    const e = escolhaDe(t)
    await confirmarImportada(t.id, t.direcao === 'saida' ? e.categoriaId || null : null, e.recorrenciaId || null)
  }

  async function confirmarUma(t: TransacaoImportada) {
    setOcupadoId(t.id)
    try {
      await confirmar(t)
      showToast(`${t.descricao} confirmada.`, 'success')
      dados.recarregar()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setOcupadoId(null)
    }
  }

  async function ignorar(t: TransacaoImportada) {
    setOcupadoId(t.id)
    try {
      await ignorarImportada(t.id)
      dados.recarregar()
      showToast(`${t.descricao} ignorada.`, 'success', {
        acao: {
          rotulo: 'Desfazer',
          onClick: async () => {
            await desfazerIgnorarImportada(t.id)
            dados.recarregar()
          },
        },
      })
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setOcupadoId(null)
    }
  }

  async function confirmarPar(par: ParPagamentoFatura) {
    setOcupadoId(par.bancoId)
    try {
      await confirmarPagamentoFatura(par)
      showToast(`Pagamento de fatura de ${formatBRL(par.valorCentavos)} conciliado.`, 'success')
      dados.recarregar()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setOcupadoId(null)
    }
  }

  const prontas = pendentes.filter(
    (t) => !t.sugerirIgnorarParcela && (t.direcao === 'entrada' || escolhaDe(t).categoriaId),
  )

  async function confirmarTodas() {
    setEmLote(true)
    let feitas = 0
    try {
      for (const t of prontas) {
        await confirmar(t)
        feitas++
      }
      showToast(`${feitas} transações confirmadas.`, 'success')
    } catch (e) {
      const t = prontas[feitas]
      showToast(`${feitas} confirmadas. Parou em "${t?.descricao}": ${mensagemDoErro(e)}`, 'error')
    } finally {
      setEmLote(false)
      dados.recarregar()
    }
  }

  async function sincronizar() {
    setSincronizando(true)
    try {
      const r = await sincronizarAgora()
      if (r.sucesso) showToast(`${r.importadas} transações novas.`, 'success')
      else showToast(`Sincronização com erro: ${mensagemErroSincronizacao(r.erro)}.`, 'error')
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setSincronizando(false)
      dados.recarregar()
    }
  }

  const status = dados.data?.status
  const ultima = status?.ultimaSincronizacaoEm ? haQuantoTempo(status.ultimaSincronizacaoEm) : null

  return (
    <>
      <PageHeader
        title="Importadas"
        action={
          <Button variant="secondary" onClick={sincronizar} loading={sincronizando} disabled={sincronizando}>
            Sincronizar agora
          </Button>
        }
      />

      {dados.isLoading && !dados.data && <Spinner />}
      {dados.erro && <p className="text-sm text-alerta">Não foi possível carregar as transações importadas.</p>}

      {dados.data && status === null && (
        <EmptyState
          titulo="Nenhuma conexão"
          texto="Cadastre suas contas da Pluggy para as transações chegarem aqui."
          acao={
            <Link to="/conexoes" className="text-sm text-livre">
              Ir para Conexões
            </Link>
          }
        />
      )}

      {pares.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-ink-soft">Pagamentos de fatura</h2>
          <ul className="flex flex-col">
            {pares.map((par) => (
              <li key={par.bancoId} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3">
                <span className="w-20 shrink-0 text-sm text-ink-soft">{formatarData(par.data)}</span>
                <span className="min-w-0 flex-1 text-sm text-ink">
                  {nomeFonte.get(par.fontePagadoraId) ?? '—'} → fatura {nomeFonte.get(par.cartaoFonteId) ?? '—'}
                  <span className="block text-xs text-ink-soft">
                    Débito na conta + crédito no cartão. Não conta como gasto.
                  </span>
                </span>
                <span className="font-money w-28 shrink-0 text-right text-sm text-ink">{formatBRL(par.valorCentavos)}</span>
                <Button
                  disabled={ocupadoId !== null || emLote}
                  loading={ocupadoId === par.bancoId}
                  onClick={() => confirmarPar(par)}
                >
                  Conciliar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dados.data && status !== null && pendentes.length === 0 && pares.length === 0 && (
        <EmptyState
          titulo="Nada para revisar"
          texto={ultima ? `Última sincronização: ${ultima}.` : 'Nenhuma sincronização ainda.'}
        />
      )}

      {pendentes.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-ink-soft">
              {pendentes.length} para revisar{ultima && ` · última sincronização ${ultima}`}
            </p>
            <Button onClick={confirmarTodas} loading={emLote} disabled={emLote || prontas.length === 0}>
              Confirmar todas com categoria ({prontas.length})
            </Button>
          </div>

          <ul className="flex flex-col">
            {pendentes.map((t) => {
              const escolha = escolhaDe(t)
              const sugestoes = sugestoesDe(t)
              const ocupado = ocupadoId === t.id || emLote
              return (
                <li key={t.id} className="flex flex-col gap-2 border-b border-line py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="w-20 shrink-0 text-sm text-ink-soft">{formatarData(t.data)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {t.apelido ?? t.descricao}
                      {t.totalParcelas && (
                        <span className="ml-1 text-xs text-ink-soft">
                          {t.parcela}/{t.totalParcelas}
                        </span>
                      )}
                      {t.sugerirIgnorarParcela && (
                        <span className="ml-2 rounded bg-aviso/10 px-1.5 py-0.5 text-xs text-aviso">
                          compra anterior ao corte: já contada no saldo inicial
                        </span>
                      )}
                      {t.statusPluggy === 'PENDING' && (
                        <span className="ml-2 rounded bg-base px-1.5 py-0.5 text-xs text-ink-soft">pendente no cartão</span>
                      )}
                      {t.apelido && (
                        <span className="block truncate text-xs text-ink-soft" title={t.descricao}>
                          {t.descricao}
                        </span>
                      )}
                    </span>
                    <span className="hidden text-xs text-ink-soft sm:inline">{nomeFonte.get(t.fonteId ?? '') ?? '—'}</span>
                    <span className={`font-money w-28 shrink-0 text-right text-sm ${t.direcao === 'entrada' ? 'text-livre' : 'text-ink'}`}>
                      {t.direcao === 'entrada' ? '+ ' : '− '}
                      {formatBRL(t.valorCentavos)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    {t.direcao === 'saida' && (
                      <div className="w-full sm:w-56">
                        <Select
                          label="Categoria"
                          value={escolha.categoriaId}
                          onChange={(e) => escolher(t.id, { categoriaId: e.target.value })}
                        >
                          <option value="">Escolha…</option>
                          {(dados.data?.categorias ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                    {sugestoes.length > 0 && (
                      <div className="w-full sm:w-64">
                        <Select
                          label="É uma recorrência?"
                          value={escolha.recorrenciaId}
                          onChange={(e) => escolher(t.id, { recorrenciaId: e.target.value })}
                        >
                          <option value="">Não</option>
                          {sugestoes.map((s) => (
                            <option key={s.recorrenciaId} value={s.recorrenciaId}>
                              {s.titulo} de {nomeDoMes(s.competencia).split(' ')[0]}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="ghost"
                        disabled={ocupado}
                        onClick={() =>
                          setApelidoAlvo({
                            chave: t.chaveEstabelecimento,
                            apelidoAtual: t.apelido,
                            descricao: t.descricao,
                          })
                        }
                      >
                        {t.apelido ? 'Editar apelido' : 'Dar apelido'}
                      </Button>
                      <Button
                        variant={t.sugerirIgnorarParcela ? 'primary' : 'ghost'}
                        disabled={ocupado}
                        onClick={() => ignorar(t)}
                      >
                        Ignorar
                      </Button>
                      <Button
                        variant={t.sugerirIgnorarParcela ? 'ghost' : 'primary'}
                        disabled={ocupado || (t.direcao === 'saida' && !escolha.categoriaId)}
                        loading={ocupadoId === t.id}
                        onClick={() => confirmarUma(t)}
                      >
                        Confirmar
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {divergentes.length > 0 && (
        <section className="mt-8">
          <button
            type="button"
            className="mb-2 text-sm font-medium text-aviso"
            onClick={() => setMostrarDivergentes((v) => !v)}
          >
            {mostrarDivergentes ? '▾' : '▸'} {divergentes.length} divergente{divergentes.length === 1 ? '' : 's'} (sumiram da Pluggy depois de confirmadas)
          </button>
          {mostrarDivergentes && (
            <ul className="flex flex-col">
              {divergentes.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2">
                  <span className="w-20 shrink-0 text-sm text-ink-soft">{formatarData(t.data)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.apelido ?? t.descricao}</span>
                  <span className="font-money text-sm text-ink">{formatBRL(t.valorCentavos)}</span>
                  <Link
                    to={`${t.direcao === 'entrada' ? '/entradas' : '/saidas'}?mes=${t.data.slice(0, 7)}`}
                    className="text-sm text-livre"
                  >
                    Ver lançamento
                  </Link>
                  <Button variant="ghost" disabled={ocupadoId === t.id} onClick={() => ignorar(t)}>
                    Ok
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {apelidoAlvo && (
        <ApelidoModal
          alvo={apelidoAlvo}
          onFechar={() => setApelidoAlvo(null)}
          onSalvo={(mensagem) => {
            setApelidoAlvo(null)
            showToast(mensagem, 'success')
            dados.recarregar()
          }}
        />
      )}
    </>
  )
}

export default ImportadasPage
