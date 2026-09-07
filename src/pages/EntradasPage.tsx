import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import EntradaFormModal from '../features/entradas/EntradaFormModal'
import { useAsync } from '../hooks/useAsync'
import { deslocarMes, formatarData, mesAtual, nomeDoMes } from '../lib/date'
import { mensagemDoErro } from '../lib/erros'
import { formatBRL } from '../lib/money'
import {
  excluirEntrada,
  excluirTemplateRecorrente,
  listarEntradas,
} from '../services/entradas'
import { listarFontes, listarSaldosFontes } from '../services/fontes'
import type { Entrada, Fonte } from '../types/domain'

async function carregarDados(mes: string, fonteId: string) {
  const [entradas, saldos, fontes] = await Promise.all([
    listarEntradas({ mes, fonteId: fonteId || undefined }),
    listarSaldosFontes(),
    listarFontes(),
  ])
  return { entradas, saldos, fontes }
}

function EntradasPage() {
  const [params, setParams] = useSearchParams()
  const { showToast } = useToast()

  const mes = params.get('mes') ?? mesAtual()
  const fonteId = params.get('fonte') ?? ''

  const dados = useAsync(() => carregarDados(mes, fonteId), [mes, fonteId])

  const [formAberto, setFormAberto] = useState(false)
  const [entradaEditando, setEntradaEditando] = useState<Entrada | undefined>()
  const [duplicandoDe, setDuplicandoDe] = useState<Entrada | undefined>()
  const [aberturaId, setAberturaId] = useState(0)
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null)

  const [entradaExcluindo, setEntradaExcluindo] = useState<Entrada | null>(null)
  const [bloqueioExclusao, setBloqueioExclusao] = useState<string | null>(null)
  const [excluirLancados, setExcluirLancados] = useState(false)
  const [saldoProjetado, setSaldoProjetado] = useState<{ nome: string; centavos: number } | null>(
    null,
  )
  const [excluindo, setExcluindo] = useState(false)

  function irParaMes(novoMes: string) {
    const proximo = new URLSearchParams(params)
    proximo.set('mes', novoMes)
    setParams(proximo)
  }

  function mudarFonte(novaFonteId: string) {
    const proximo = new URLSearchParams(params)
    if (novaFonteId) {
      proximo.set('fonte', novaFonteId)
    } else {
      proximo.delete('fonte')
    }
    setParams(proximo)
  }

  const mapaFontes = useMemo(() => {
    const mapa = new Map<string, Fonte>()
    for (const fonte of dados.data?.fontes ?? []) mapa.set(fonte.id, fonte)
    return mapa
  }, [dados.data])

  const totalMes = useMemo(
    () => (dados.data?.entradas ?? []).reduce((soma, e) => soma + e.valorCentavos, 0),
    [dados.data],
  )

  function abrirCriar() {
    if ((dados.data?.fontes.length ?? 0) === 0) return
    setEntradaEditando(undefined)
    setDuplicandoDe(undefined)
    setFormAberto(true)
    setAberturaId((id) => id + 1)
  }

  function abrirEditar(entrada: Entrada) {
    setEntradaEditando(entrada)
    setDuplicandoDe(undefined)
    setFormAberto(true)
    setAberturaId((id) => id + 1)
    setMenuAbertoId(null)
  }

  function abrirDuplicar(entrada: Entrada) {
    setEntradaEditando(undefined)
    setDuplicandoDe(entrada)
    setFormAberto(true)
    setAberturaId((id) => id + 1)
    setMenuAbertoId(null)
  }

  async function iniciarExcluir(entrada: Entrada) {
    setMenuAbertoId(null)
    setBloqueioExclusao(null)
    setExcluirLancados(false)

    try {
      const saldos = await listarSaldosFontes()
      const saldoFonte = saldos.find((s) => s.id === entrada.fonteId)
      if (!saldoFonte) {
        setEntradaExcluindo(entrada)
        return
      }
      const saldoNovo = saldoFonte.saldoCentavos - entrada.valorCentavos
      if (saldoNovo < 0) {
        setBloqueioExclusao(
          `Não é possível excluir. O saldo de ${saldoFonte.nome} ficaria negativo em ${formatBRL(
            Math.abs(saldoNovo),
          )}. Ajuste ou remova saídas antes.`,
        )
      } else {
        setSaldoProjetado({ nome: saldoFonte.nome, centavos: saldoNovo })
      }
      setEntradaExcluindo(entrada)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    }
  }

  async function confirmarExcluir() {
    if (!entradaExcluindo || bloqueioExclusao) return
    setExcluindo(true)
    try {
      const ehTemplate = entradaExcluindo.recorrente && entradaExcluindo.templateId === null
      if (ehTemplate) {
        await excluirTemplateRecorrente(entradaExcluindo.id, excluirLancados)
      } else {
        await excluirEntrada(entradaExcluindo.id)
      }
      showToast('Entrada excluída.', 'success')
      dados.recarregar()
      setEntradaExcluindo(null)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setExcluindo(false)
    }
  }

  async function handleSalvo(fonteIdSalvo: string) {
    dados.recarregar()
    try {
      const saldos = await listarSaldosFontes()
      const saldoFonte = saldos.find((s) => s.id === fonteIdSalvo)
      if (saldoFonte) {
        showToast(`Entrada registrada. ${saldoFonte.nome} agora tem ${formatBRL(saldoFonte.saldoCentavos)}.`, 'success')
      }
    } catch {
      // toast é cosmético — a lista já foi recarregada
    }
  }

  const semFontes = (dados.data?.fontes.length ?? 0) === 0
  const listaVazia = (dados.data?.entradas.length ?? 0) === 0
  const estaNoMesCorrente = mes === mesAtual()
  const semFiltroFonte = fonteId === ''

  return (
    <>
      <PageHeader
        title="Entradas"
        action={<Button onClick={abrirCriar}>Registrar entrada</Button>}
      />

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            className="rounded px-2 py-1 text-ink-soft hover:bg-base"
            onClick={() => irParaMes(deslocarMes(mes, -1))}
          >
            ‹
          </button>
          <span className="min-w-[10rem] text-center text-sm font-medium text-ink">
            {nomeDoMes(mes)}
          </span>
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

        {(dados.data?.fontes.length ?? 0) > 0 && (
          <Select
            label="Filtrar por fonte"
            value={fonteId}
            onChange={(event) => mudarFonte(event.target.value)}
            className="w-48"
          >
            <option value="">Todas as fontes</option>
            {(dados.data?.fontes ?? []).map((fonte) => (
              <option key={fonte.id} value={fonte.id}>
                {fonte.nome}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!dados.isLoading && !listaVazia && (
        <p className="mb-4 text-sm text-ink-soft">
          {formatBRL(totalMes)} entraram em {nomeDoMes(mes)}
        </p>
      )}

      {dados.isLoading && <Spinner />}
      {dados.erro && <p className="text-alerta">{dados.erro.mensagem}</p>}

      {!dados.isLoading && semFontes && (
        <EmptyState
          titulo="Você precisa de uma fonte primeiro"
          texto="Você precisa de uma fonte antes de registrar uma entrada."
          acao={
            <Link to="/fontes">
              <Button>Criar fonte</Button>
            </Link>
          }
        />
      )}

      {!dados.isLoading && !semFontes && listaVazia && estaNoMesCorrente && semFiltroFonte && (
        <EmptyState
          titulo="Nenhuma entrada ainda"
          texto="Toda saída precisa sair de algum lugar. Comece registrando seu salário ou outro dinheiro que você recebeu."
          acao={<Button onClick={abrirCriar}>Registrar entrada</Button>}
        />
      )}

      {!dados.isLoading && !semFontes && listaVazia && !(estaNoMesCorrente && semFiltroFonte) && (
        <EmptyState
          titulo="Nenhuma entrada"
          texto={`Nenhuma entrada em ${nomeDoMes(mes)}.`}
          acao={<Button onClick={abrirCriar}>Registrar entrada</Button>}
        />
      )}

      {!listaVazia && (
        <ul className="flex flex-col">
          {(dados.data?.entradas ?? []).map((entrada) => {
            const fonte = mapaFontes.get(entrada.fonteId)
            return (
              <li
                key={entrada.id}
                className="group relative flex items-center gap-3 border-b border-line py-3 cursor-pointer"
                onClick={() => abrirEditar(entrada)}
              >
                <span className="w-20 shrink-0 text-sm text-ink-soft">
                  {formatarData(entrada.data)}
                </span>
                <span className="ml-2 flex-1 truncate text-sm text-ink">{entrada.titulo}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-sm text-ink-soft">
                  {fonte && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: fonte.cor }}
                      aria-hidden="true"
                    />
                  )}
                  {fonte?.nome ?? '—'}
                </span>
                <span className="font-money w-28 shrink-0 text-right text-sm text-livre">
                  {formatBRL(entrada.valorCentavos)}
                </span>
                {entrada.recorrente && (
                  <span title={`Recorrente, todo dia ${entrada.diaRecorrencia}`}>↻</span>
                )}

                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label="Mais ações"
                    className="rounded px-2 py-1 text-ink-soft opacity-100 hover:bg-base sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation()
                      setMenuAbertoId(menuAbertoId === entrada.id ? null : entrada.id)
                    }}
                  >
                    ⋯
                  </button>
                  {menuAbertoId === entrada.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={(event) => {
                          event.stopPropagation()
                          setMenuAbertoId(null)
                        }}
                      />
                      <div className="absolute right-0 top-full z-20 mt-1 rounded border border-line bg-surface shadow-lg">
                        <button
                          type="button"
                          className="whitespace-nowrap px-4 py-2 text-left text-sm text-ink hover:bg-base"
                          onClick={(event) => {
                            event.stopPropagation()
                            abrirEditar(entrada)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="whitespace-nowrap px-4 py-2 text-left text-sm text-ink hover:bg-base"
                          onClick={(event) => {
                            event.stopPropagation()
                            abrirDuplicar(entrada)
                          }}
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          className="whitespace-nowrap px-4 py-2 text-left text-sm text-alerta hover:bg-base"
                          onClick={(event) => {
                            event.stopPropagation()
                            iniciarExcluir(entrada)
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <EntradaFormModal
        key={aberturaId}
        aberto={formAberto}
        entrada={entradaEditando}
        duplicarDe={duplicandoDe}
        fontes={dados.data?.fontes ?? []}
        onFechar={() => setFormAberto(false)}
        onSalvo={(fonteIdSalvo) => {
          setFormAberto(false)
          handleSalvo(fonteIdSalvo)
        }}
      />

      <Modal
        open={entradaExcluindo !== null}
        onClose={() => setEntradaExcluindo(null)}
        title="Excluir entrada"
      >
        {bloqueioExclusao ? (
          <>
            <p className="mb-4 text-sm text-alerta">{bloqueioExclusao}</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setEntradaExcluindo(null)}>
                Fechar
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink">
              Excluir "{entradaExcluindo?.titulo}"?
              {saldoProjetado && (
                <> O saldo de {saldoProjetado.nome} cai para {formatBRL(saldoProjetado.centavos)}.</>
              )}
            </p>
            {entradaExcluindo?.recorrente && entradaExcluindo.templateId === null && (
              <label className="mb-4 flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={excluirLancados}
                  onChange={(event) => setExcluirLancados(event.target.checked)}
                />
                Excluir também os lançamentos já feitos a partir dele
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEntradaExcluindo(null)}>
                Cancelar
              </Button>
              <Button variant="danger" loading={excluindo} onClick={confirmarExcluir}>
                Excluir
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

export default EntradasPage
