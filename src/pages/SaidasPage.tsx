import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import SaidaFormModal from '../features/saidas/SaidaFormModal'
import type { FonteComSaldo } from '../features/saidas/elegibilidade'
import { useAsync } from '../hooks/useAsync'
import { deslocarMes, formatarData, mesAtual, nomeDoMes } from '../lib/date'
import { mensagemDoErro } from '../lib/erros'
import { formatBRL } from '../lib/money'
import { listarCategorias, listarSaldosCategorias } from '../services/categorias'
import { listarFontes, listarSaldosFontes } from '../services/fontes'
import { excluirSaida, listarSaidas } from '../services/saidas'
import type { Categoria, Saida } from '../types/domain'

async function carregarDados(mes: string, categoriaId: string, fonteId: string) {
  const [saidas, fontes, saldosFontes, categorias, saldosCategorias] = await Promise.all([
    listarSaidas({ mes, categoriaId: categoriaId || undefined, fonteId: fonteId || undefined }),
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

  return { saidas, fontesComSaldo, categorias, saldosCategorias }
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

  const dados = useAsync(() => carregarDados(mes, categoriaId, fonteId), [mes, categoriaId, fonteId])

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
    setParams(proximo)
  }

  function mudarFiltro(chave: 'categoria' | 'fonte', valor: string) {
    const proximo = new URLSearchParams(params)
    if (valor) proximo.set(chave, valor)
    else proximo.delete(chave)
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

  const totalMes = useMemo(
    () => (dados.data?.saidas ?? []).reduce((soma, s) => soma + s.valorTotalCentavos, 0),
    [dados.data],
  )

  const semFontes = fontesNaoArquivadas.length === 0
  const semCategorias = categoriasNaoArquivadas.length === 0
  const listaVazia = (dados.data?.saidas.length ?? 0) === 0
  const estaNoMesCorrente = mes === mesAtual()
  const semFiltros = categoriaId === '' && fonteId === ''

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

      {!dados.isLoading && !listaVazia && (
        <p className="mb-4 text-sm text-ink-soft">
          {formatBRL(totalMes)} saíram em {nomeDoMes(mes)}
        </p>
      )}

      {dados.isLoading && <Spinner />}
      {dados.erro && <p className="text-alerta">{dados.erro.mensagem}</p>}

      {!dados.isLoading && (semFontes || semCategorias) && (
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

      {!dados.isLoading && !semFontes && !semCategorias && listaVazia && estaNoMesCorrente && semFiltros && (
        <EmptyState
          titulo="Nenhuma saída ainda"
          texto="Registre um gasto e escolha de qual fonte ele saiu."
          acao={<Button onClick={abrirCriar}>Registrar saída</Button>}
        />
      )}

      {!dados.isLoading &&
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
        <ul className="flex flex-col">
          {(dados.data?.saidas ?? []).map((saida) => {
            const categoria = mapaCategorias.get(saida.categoriaId)
            const expandido = expandidoId === saida.id
            return (
              <li key={saida.id} className="border-b border-line">
                <div
                  className="group relative flex cursor-pointer items-center gap-3 py-3"
                  onClick={() =>
                    saida.splits.length > 1 && setExpandidoId(expandido ? null : saida.id)
                  }
                >
                  <span className="w-20 shrink-0 text-sm text-ink-soft">
                    {formatarData(saida.data)}
                  </span>
                  <span className="ml-2 flex-1 truncate text-sm text-ink">{saida.titulo}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-ink-soft">
                    {categoria && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: categoria.cor }}
                        aria-hidden="true"
                      />
                    )}
                    {categoria?.nome ?? '—'}
                  </span>
                  <span className="w-40 shrink-0 truncate text-sm text-ink-soft">
                    {fonteLabel(saida, mapaFontes)}
                  </span>
                  <span className="font-money w-28 shrink-0 text-right text-sm text-ink">
                    {formatBRL(saida.valorTotalCentavos)}
                  </span>
                  {saida.recorrente && (
                    <span title={`Recorrente, todo dia ${saida.diaRecorrencia}`}>↻</span>
                  )}

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      aria-label="Mais ações"
                      className="rounded px-2 py-1 text-ink-soft opacity-100 hover:bg-base sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation()
                        setMenuAbertoId(menuAbertoId === saida.id ? null : saida.id)
                      }}
                    >
                      ⋯
                    </button>
                    {menuAbertoId === saida.id && (
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
                              abrirEditar(saida)
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="whitespace-nowrap px-4 py-2 text-left text-sm text-ink hover:bg-base"
                            onClick={(event) => {
                              event.stopPropagation()
                              abrirDuplicar(saida)
                            }}
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            className="whitespace-nowrap px-4 py-2 text-left text-sm text-alerta hover:bg-base"
                            onClick={(event) => {
                              event.stopPropagation()
                              iniciarExcluir(saida)
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {expandido && (
                  <div className="ml-2 flex flex-col gap-1 pb-3 pl-20 text-sm text-ink-soft">
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
