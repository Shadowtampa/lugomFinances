import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import AcoesMenu from '../components/ui/AcoesMenu'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import DuplicateIcon from '../components/ui/icons/DuplicateIcon'
import PencilIcon from '../components/ui/icons/PencilIcon'
import TrashIcon from '../components/ui/icons/TrashIcon'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import EntradaFormModal from '../features/entradas/EntradaFormModal'
import type { FonteComSaldo } from '../features/saidas/elegibilidade'
import { useAsync } from '../hooks/useAsync'
import { deslocarMes, ehFuturo, formatarData, mesAtual, nomeDoMes } from '../lib/date'
import { mensagemDoErro } from '../lib/erros'
import { formatBRL } from '../lib/money'
import {
  contarEntradas,
  excluirEntrada,
  excluirTemplateRecorrente,
  listarEntradas,
  somarEntradasMes,
} from '../services/entradas'
import { listarFontes, listarSaldosFontes } from '../services/fontes'
import type { Entrada } from '../types/domain'

const POR_PAGINA = 10

async function carregarDados(mes: string, fonteId: string, pagina: number) {
  const [entradas, total, totalMes, saldos, fontesBase] = await Promise.all([
    listarEntradas({ mes, fonteId: fonteId || undefined, pagina, porPagina: POR_PAGINA }),
    contarEntradas({ mes, fonteId: fonteId || undefined }),
    somarEntradasMes(mes, fonteId || undefined),
    listarSaldosFontes(),
    listarFontes(),
  ])
  const mapaSaldos = new Map(saldos.map((s) => [s.id, s.saldoCentavos]))
  const fontes: FonteComSaldo[] = fontesBase.map((f) => ({
    ...f,
    saldoCentavos: mapaSaldos.get(f.id) ?? 0,
  }))
  return { entradas, total, totalMes, saldos, fontes }
}

function EntradasPage() {
  const [params, setParams] = useSearchParams()
  const { showToast } = useToast()

  const mes = params.get('mes') ?? mesAtual()
  const fonteId = params.get('fonte') ?? ''
  const pagina = Number(params.get('pagina') ?? '1')

  const dados = useAsync(() => carregarDados(mes, fonteId, pagina), [mes, fonteId, pagina])

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
    proximo.delete('pagina')
    setParams(proximo)
  }

  function mudarFonte(novaFonteId: string) {
    const proximo = new URLSearchParams(params)
    if (novaFonteId) {
      proximo.set('fonte', novaFonteId)
    } else {
      proximo.delete('fonte')
    }
    proximo.delete('pagina')
    setParams(proximo)
  }

  function irParaPagina(novaPagina: number) {
    const proximo = new URLSearchParams(params)
    proximo.set('pagina', String(novaPagina))
    setParams(proximo)
  }

  const mapaFontes = useMemo(() => {
    const mapa = new Map<string, FonteComSaldo>()
    for (const fonte of dados.data?.fontes ?? []) mapa.set(fonte.id, fonte)
    return mapa
  }, [dados.data])

  const totalMes = dados.data?.totalMes ?? 0
  const totalPaginas = Math.max(1, Math.ceil((dados.data?.total ?? 0) / POR_PAGINA))

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

  function handleSalvo() {
    dados.recarregar()
  }

  const semFontes = (dados.data?.fontes.length ?? 0) === 0
  const listaVazia = (dados.data?.entradas.length ?? 0) === 0
  const estaNoMesCorrente = mes === mesAtual()
  const semFiltroFonte = fonteId === ''
  const carregandoInicial = dados.isLoading && !dados.data
  const atualizando = dados.isLoading && !!dados.data

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

      {!carregandoInicial && !listaVazia && (
        <p className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
          {formatBRL(totalMes)} entraram em {nomeDoMes(mes)}
          {atualizando && <Spinner size={14} />}
        </p>
      )}

      {carregandoInicial && <Spinner />}
      {dados.erro && <p className="text-alerta">{dados.erro.mensagem}</p>}

      {!carregandoInicial && semFontes && (
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

      {!carregandoInicial && !semFontes && listaVazia && estaNoMesCorrente && semFiltroFonte && (
        <EmptyState
          titulo="Nenhuma entrada ainda"
          texto="Toda saída precisa sair de algum lugar. Comece registrando seu salário ou outro dinheiro que você recebeu."
          acao={<Button onClick={abrirCriar}>Registrar entrada</Button>}
        />
      )}

      {!carregandoInicial && !semFontes && listaVazia && !(estaNoMesCorrente && semFiltroFonte) && (
        <EmptyState
          titulo="Nenhuma entrada"
          texto={`Nenhuma entrada em ${nomeDoMes(mes)}.`}
          acao={<Button onClick={abrirCriar}>Registrar entrada</Button>}
        />
      )}

      {!listaVazia && (
        <ul
          className={`flex flex-col transition-opacity ${atualizando ? 'pointer-events-none opacity-50' : ''}`}
        >
          {(dados.data?.entradas ?? []).map((entrada) => {
            const fonte = mapaFontes.get(entrada.fonteId)
            return (
              <li
                key={entrada.id}
                className="group relative flex flex-col items-start gap-1 border-b border-line py-3 cursor-pointer sm:flex-row sm:items-center sm:gap-3"
                onClick={() => abrirEditar(entrada)}
              >
                <div className="flex w-full items-center gap-3 pr-12 sm:contents sm:pr-0">
                  <span className="w-20 shrink-0 text-sm text-ink-soft">
                    {formatarData(entrada.data)}
                  </span>
                  <span className="ml-2 min-w-0 flex-1 truncate text-sm text-ink sm:ml-2">
                    {entrada.titulo}
                  </span>
                  <span className="sm:hidden">
                    {entrada.recorrente && (
                      <span title={`Recorrente, todo dia ${entrada.diaRecorrencia}`}>↻</span>
                    )}
                  </span>
                  {ehFuturo(entrada.data) && (
                    <span
                      className="shrink-0 text-xs text-ink-soft"
                      title={`Só conta no saldo a partir de ${formatarData(entrada.data)}.`}
                    >
                      agendado
                    </span>
                  )}
                </div>

                <div className="flex w-full items-center gap-3 pl-0 sm:contents sm:pl-0">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-ink-soft sm:w-40 sm:flex-none">
                    {fonte && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: fonte.cor }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">{fonte?.nome ?? '—'}</span>
                  </span>
                  <span className="font-money w-28 shrink-0 text-right text-sm text-livre">
                    {formatBRL(entrada.valorCentavos)}
                  </span>
                  {entrada.recorrente && (
                    <span
                      className="hidden sm:inline"
                      title={`Recorrente, todo dia ${entrada.diaRecorrencia}`}
                    >
                      ↻
                    </span>
                  )}
                </div>

                <div className="absolute right-0 top-1.5 sm:static sm:top-auto">
                  <AcoesMenu
                    aberto={menuAbertoId === entrada.id}
                    onToggle={() => setMenuAbertoId(menuAbertoId === entrada.id ? null : entrada.id)}
                    onFechar={() => setMenuAbertoId(null)}
                    itens={[
                      {
                        label: 'Editar',
                        icon: <PencilIcon className="h-4 w-4" />,
                        onClick: () => abrirEditar(entrada),
                      },
                      {
                        label: 'Duplicar',
                        icon: <DuplicateIcon className="h-4 w-4" />,
                        onClick: () => abrirDuplicar(entrada),
                      },
                      {
                        label: 'Excluir',
                        icon: <TrashIcon className="h-4 w-4" />,
                        onClick: () => iniciarExcluir(entrada),
                        perigo: true,
                      },
                    ]}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination pagina={pagina} totalPaginas={totalPaginas} onMudarPagina={irParaPagina} />

      <EntradaFormModal
        key={aberturaId}
        aberto={formAberto}
        entrada={entradaEditando}
        duplicarDe={duplicandoDe}
        fontes={dados.data?.fontes ?? []}
        onFechar={() => setFormAberto(false)}
        onSalvo={() => {
          setFormAberto(false)
          handleSalvo()
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
