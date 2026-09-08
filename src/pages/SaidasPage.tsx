import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import AcoesMenu from '../components/ui/AcoesMenu'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import SaidaFormModal from '../features/saidas/SaidaFormModal'
import type { FonteComSaldo } from '../features/saidas/elegibilidade'
import { useAsync } from '../hooks/useAsync'
import { deslocarMes, ehFuturo, formatarData, mesAtual, nomeDoMes } from '../lib/date'
import { mensagemDoErro } from '../lib/erros'
import { formatBRL } from '../lib/money'
import { listarCategorias, listarSaldosCategorias } from '../services/categorias'
import { listarFontes, listarSaldosFontes } from '../services/fontes'
import { contarSaidas, excluirSaida, listarSaidas, somarSaidasMes } from '../services/saidas'
import type { Categoria, Saida } from '../types/domain'

const POR_PAGINA = 10

async function carregarDados(mes: string, categoriaId: string, fonteId: string, pagina: number) {
  const filtro = { categoriaId: categoriaId || undefined, fonteId: fonteId || undefined }
  const [saidas, total, totalMes, fontes, saldosFontes, categorias, saldosCategorias] =
    await Promise.all([
      listarSaidas({ mes, ...filtro, pagina, porPagina: POR_PAGINA }),
      contarSaidas({ mes, ...filtro }),
      somarSaidasMes(mes, filtro),
      listarFontes({ incluirArquivadas: true }),
      listarSaldosFontes(),
      listarCategorias({ incluirArquivadas: true }),
      listarSaldosCategorias(),
    ])

  const mapaSaldos = new Map(saldosFontes.map((s) => [s.id, s.saldoCentavos]))
  const fontesComSaldo: FonteComSaldo[] = fontes.map((f) => ({
    ...f,
    saldoCentavos: mapaSaldos.get(f.id) ?? 0,
  }))

  return { saidas, total, totalMes, fontesComSaldo, categorias, saldosCategorias }
}

function fonteLabel(saida: Saida, mapaFontes: Map<string, FonteComSaldo>): string {
  if (saida.splits.length === 1) return mapaFontes.get(saida.splits[0].fonteId)?.nome ?? '—'
  if (saida.splits.length === 2) {
    const [a, b] = saida.splits
    return `${mapaFontes.get(a.fonteId)?.nome ?? '—'} + ${mapaFontes.get(b.fonteId)?.nome ?? '—'}`
  }
  return `${saida.splits.length} fontes`
}

function mensagemExclusao(saida: Saida, mapaFontes: Map<string, FonteComSaldo>): string {
  const partes = saida.splits.map(
    (split) => `${formatBRL(split.valorCentavos)} para ${mapaFontes.get(split.fonteId)?.nome ?? '—'}`,
  )
  const junto =
    partes.length <= 1
      ? partes.join('')
      : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
  return `Excluir "${saida.titulo}"? ${junto} voltam.`
}

function SaidasPage() {
  const [params, setParams] = useSearchParams()
  const { showToast } = useToast()

  const mes = params.get('mes') ?? mesAtual()
  const categoriaId = params.get('categoria') ?? ''
  const fonteId = params.get('fonte') ?? ''
  const pagina = Number(params.get('pagina') ?? '1')

  const dados = useAsync(
    () => carregarDados(mes, categoriaId, fonteId, pagina),
    [mes, categoriaId, fonteId, pagina],
  )

  const [formAberto, setFormAberto] = useState(false)
  const [saidaEditando, setSaidaEditando] = useState<Saida | undefined>()
  const [duplicandoDe, setDuplicandoDe] = useState<Saida | undefined>()
  const [aberturaId, setAberturaId] = useState(0)
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [saidaExcluindo, setSaidaExcluindo] = useState<Saida | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  function irParaMes(novoMes: string) {
    const proximo = new URLSearchParams(params)
    proximo.set('mes', novoMes)
    proximo.delete('pagina')
    setParams(proximo)
  }

  function mudarFiltro(chave: 'categoria' | 'fonte', valor: string) {
    const proximo = new URLSearchParams(params)
    if (valor) proximo.set(chave, valor)
    else proximo.delete(chave)
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
    for (const fonte of dados.data?.fontesComSaldo ?? []) mapa.set(fonte.id, fonte)
    return mapa
  }, [dados.data])

  const mapaCategorias = useMemo(() => {
    const mapa = new Map<string, Categoria>()
    for (const categoria of dados.data?.categorias ?? []) mapa.set(categoria.id, categoria)
    return mapa
  }, [dados.data])

  const fontesNaoArquivadas = useMemo(
    () => (dados.data?.fontesComSaldo ?? []).filter((f) => !f.arquivada),
    [dados.data],
  )
  const categoriasNaoArquivadas = useMemo(
    () => (dados.data?.categorias ?? []).filter((c) => !c.arquivada),
    [dados.data],
  )

  const totalMes = dados.data?.totalMes ?? 0
  const totalPaginas = Math.max(1, Math.ceil((dados.data?.total ?? 0) / POR_PAGINA))

  const semFontes = fontesNaoArquivadas.length === 0
  const semCategorias = categoriasNaoArquivadas.length === 0
  const listaVazia = (dados.data?.saidas.length ?? 0) === 0
  const estaNoMesCorrente = mes === mesAtual()
  const semFiltros = categoriaId === '' && fonteId === ''
  const carregandoInicial = dados.isLoading && !dados.data
  const atualizando = dados.isLoading && !!dados.data

  function abrirCriar() {
    if (semFontes || semCategorias) return
    setSaidaEditando(undefined)
    setDuplicandoDe(undefined)
    setFormAberto(true)
    setAberturaId((id) => id + 1)
  }

  function abrirEditar(saida: Saida) {
    setSaidaEditando(saida)
    setDuplicandoDe(undefined)
    setFormAberto(true)
    setAberturaId((id) => id + 1)
    setMenuAbertoId(null)
  }

  function abrirDuplicar(saida: Saida) {
    setSaidaEditando(undefined)
    setDuplicandoDe(saida)
    setFormAberto(true)
    setAberturaId((id) => id + 1)
    setMenuAbertoId(null)
  }

  function iniciarExcluir(saida: Saida) {
    setMenuAbertoId(null)
    setSaidaExcluindo(saida)
  }

  async function confirmarExcluir() {
    if (!saidaExcluindo) return
    setExcluindo(true)
    try {
      await excluirSaida(saidaExcluindo.id)
      showToast('Saída excluída.', 'success')
      dados.recarregar()
      setSaidaExcluindo(null)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <>
      <PageHeader title="Saídas" action={<Button onClick={abrirCriar}>Registrar saída</Button>} />

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

        {categoriasNaoArquivadas.length > 0 && (
          <Select
            label="Filtrar por categoria"
            value={categoriaId}
            onChange={(event) => mudarFiltro('categoria', event.target.value)}
            className="w-48"
          >
            <option value="">Todas as categorias</option>
            {categoriasNaoArquivadas.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </Select>
        )}

        {fontesNaoArquivadas.length > 0 && (
          <Select
            label="Filtrar por fonte"
            value={fonteId}
            onChange={(event) => mudarFiltro('fonte', event.target.value)}
            className="w-48"
          >
            <option value="">Todas as fontes</option>
            {fontesNaoArquivadas.map((fonte) => (
              <option key={fonte.id} value={fonte.id}>
                {fonte.nome}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!carregandoInicial && !listaVazia && (
        <p className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
          {formatBRL(totalMes)} saíram em {nomeDoMes(mes)}
          {atualizando && <Spinner size={14} />}
        </p>
      )}

      {carregandoInicial && <Spinner />}
      {dados.erro && <p className="text-alerta">{dados.erro.mensagem}</p>}

      {!carregandoInicial && (semFontes || semCategorias) && (
        <EmptyState
          titulo="Faltam alguns cadastros"
          texto={
            semFontes && semCategorias
              ? 'Você precisa de uma fonte e uma categoria antes de registrar uma saída.'
              : semFontes
                ? 'Você precisa de uma fonte antes de registrar uma saída.'
                : 'Você precisa de uma categoria antes de registrar uma saída.'
          }
          acao={
            <Link to={semFontes ? '/fontes' : '/categorias'}>
              <Button>{semFontes ? 'Criar fonte' : 'Criar categoria'}</Button>
            </Link>
          }
        />
      )}

      {!carregandoInicial && !semFontes && !semCategorias && listaVazia && estaNoMesCorrente && semFiltros && (
        <EmptyState
          titulo="Nenhuma saída ainda"
          texto="Registre um gasto e escolha de qual fonte ele saiu."
          acao={<Button onClick={abrirCriar}>Registrar saída</Button>}
        />
      )}

      {!carregandoInicial &&
        !semFontes &&
        !semCategorias &&
        listaVazia &&
        !(estaNoMesCorrente && semFiltros) && (
          <EmptyState
            titulo="Nenhuma saída"
            texto={`Nenhuma saída em ${nomeDoMes(mes)}.`}
            acao={<Button onClick={abrirCriar}>Registrar saída</Button>}
          />
        )}

      {!listaVazia && (
        <ul
          className={`flex flex-col transition-opacity ${atualizando ? 'pointer-events-none opacity-50' : ''}`}
        >
          {(dados.data?.saidas ?? []).map((saida) => {
            const categoria = mapaCategorias.get(saida.categoriaId)
            const expandido = expandidoId === saida.id
            return (
              <li key={saida.id} className="border-b border-line">
                <div
                  className="group relative flex cursor-pointer flex-col items-start gap-1 py-3 sm:flex-row sm:items-center sm:gap-3"
                  onClick={() =>
                    saida.splits.length > 1 && setExpandidoId(expandido ? null : saida.id)
                  }
                >
                  <div className="flex w-full items-center gap-3 pr-12 sm:contents sm:pr-0">
                    <span className="w-20 shrink-0 text-sm text-ink-soft">
                      {formatarData(saida.data)}
                    </span>
                    <span className="ml-2 min-w-0 flex-1 truncate text-sm text-ink sm:ml-2">
                      {saida.titulo}
                    </span>
                    <span className="sm:hidden">
                      {saida.recorrente && (
                        <span title={`Recorrente, todo dia ${saida.diaRecorrencia}`}>↻</span>
                      )}
                    </span>
                    {ehFuturo(saida.data) && (
                      <span
                        className="shrink-0 text-xs text-ink-soft"
                        title={`Só conta no saldo a partir de ${formatarData(saida.data)}.`}
                      >
                        agendado
                      </span>
                    )}
                  </div>

                  <div className="flex w-full items-center gap-3 pl-20 sm:contents sm:pl-0">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-ink-soft sm:flex-none">
                      {categoria && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: categoria.cor }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">
                        {categoria?.nome ?? '—'}
                        <span className="sm:hidden"> · {fonteLabel(saida, mapaFontes)}</span>
                      </span>
                    </span>
                    <span className="hidden shrink-0 truncate text-sm text-ink-soft sm:block sm:w-40">
                      {fonteLabel(saida, mapaFontes)}
                    </span>
                    <span className="font-money shrink-0 text-right text-sm text-ink sm:w-28">
                      {formatBRL(saida.valorTotalCentavos)}
                    </span>
                    {saida.recorrente && (
                      <span
                        className="hidden sm:inline"
                        title={`Recorrente, todo dia ${saida.diaRecorrencia}`}
                      >
                        ↻
                      </span>
                    )}
                  </div>

                  <div className="absolute right-0 top-1.5 sm:static sm:top-auto">
                    <AcoesMenu
                      aberto={menuAbertoId === saida.id}
                      onToggle={() => setMenuAbertoId(menuAbertoId === saida.id ? null : saida.id)}
                      onFechar={() => setMenuAbertoId(null)}
                      itens={[
                        { label: 'Editar', onClick: () => abrirEditar(saida) },
                        { label: 'Duplicar', onClick: () => abrirDuplicar(saida) },
                        { label: 'Excluir', onClick: () => iniciarExcluir(saida), perigo: true },
                      ]}
                    />
                  </div>
                </div>

                {expandido && (
                  <div className="ml-2 flex flex-col gap-1 break-words pb-3 pl-20 text-sm text-ink-soft">
                    {saida.splits.map((split) => (
                      <span key={split.fonteId}>
                        {mapaFontes.get(split.fonteId)?.nome ?? '—'}: {formatBRL(split.valorCentavos)}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Pagination pagina={pagina} totalPaginas={totalPaginas} onMudarPagina={irParaPagina} />

      <SaidaFormModal
        key={aberturaId}
        aberto={formAberto}
        saida={saidaEditando}
        duplicarDe={duplicandoDe}
        fontes={fontesNaoArquivadas}
        categorias={categoriasNaoArquivadas}
        saldosCategorias={dados.data?.saldosCategorias ?? []}
        onFechar={() => setFormAberto(false)}
        onSalvo={() => {
          setFormAberto(false)
          dados.recarregar()
        }}
      />

      <Modal
        open={saidaExcluindo !== null}
        onClose={() => setSaidaExcluindo(null)}
        title="Excluir saída"
      >
        <p className="mb-4 text-sm text-ink">
          {saidaExcluindo && mensagemExclusao(saidaExcluindo, mapaFontes)}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSaidaExcluindo(null)}>
            Cancelar
          </Button>
          <Button variant="danger" loading={excluindo} onClick={confirmarExcluir}>
            Excluir
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default SaidasPage
