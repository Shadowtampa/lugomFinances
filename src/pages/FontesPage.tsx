import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Money from '../components/ui/Money'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import BarraCartao from '../features/fontes/BarraCartao'
import FonteFormModal from '../features/fontes/FonteFormModal'
import { mensagemDoErro } from '../lib/erros'
import { useAsync } from '../hooks/useAsync'
import { listarCategorias } from '../services/categorias'
import { atualizarFonte, listarFontes, listarSaldosFontes } from '../services/fontes'
import type { Fonte, SaldoFonte } from '../types/domain'

async function carregarDados() {
  const [saldos, fontes, categorias] = await Promise.all([
    listarSaldosFontes(),
    listarFontes({ incluirArquivadas: true }),
    listarCategorias({ incluirArquivadas: true }),
  ])
  return { saldos, fontes, categorias }
}

function nomesCategorias(ids: string[] | undefined, mapaNomes: Map<string, string>): string {
  if (!ids || ids.length === 0) return ''
  const nomes = ids.map((id) => mapaNomes.get(id) ?? '?')
  if (nomes.length <= 3) return nomes.join(', ')
  return `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`
}

function FontesPage() {
  const dados = useAsync(carregarDados, [])
  const { showToast } = useToast()

  const [mostrarArquivadas, setMostrarArquivadas] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [fonteEditando, setFonteEditando] = useState<Fonte | undefined>()
  const [aberturaId, setAberturaId] = useState(0)
  const [fonteArquivando, setFonteArquivando] = useState<SaldoFonte | null>(null)
  const [confirmarSegunda, setConfirmarSegunda] = useState(false)
  const [arquivando, setArquivando] = useState(false)

  const mapaCategoriasPermitidas = useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const fonte of dados.data?.fontes ?? []) {
      if (fonte.categoriasPermitidas) mapa.set(fonte.id, fonte.categoriasPermitidas)
    }
    return mapa
  }, [dados.data])

  const mapaNomesCategorias = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const categoria of dados.data?.categorias ?? []) {
      mapa.set(categoria.id, categoria.nome)
    }
    return mapa
  }, [dados.data])

  const mapaFontesCompletas = useMemo(() => {
    const mapa = new Map<string, Fonte>()
    for (const fonte of dados.data?.fontes ?? []) {
      mapa.set(fonte.id, fonte)
    }
    return mapa
  }, [dados.data])

  const cartoes = useMemo(() => {
    const base = (dados.data?.saldos ?? []).filter((f) => mostrarArquivadas || !f.arquivada)
    return [...base].sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'livre' ? -1 : 1
      return a.nome.localeCompare(b.nome)
    })
  }, [dados.data, mostrarArquivadas])

  function abrirCriar() {
    setFonteEditando(undefined)
    setFormAberto(true)
    setAberturaId((id) => id + 1)
  }

  function abrirEditar(fonteSaldo: SaldoFonte) {
    const fonteCompleta = mapaFontesCompletas.get(fonteSaldo.id)
    setFonteEditando(fonteCompleta)
    setFormAberto(true)
    setAberturaId((id) => id + 1)
  }

  function iniciarArquivar(fonte: SaldoFonte) {
    setFonteArquivando(fonte)
    setConfirmarSegunda(false)
  }

  async function confirmarArquivar() {
    if (!fonteArquivando) return
    if (fonteArquivando.saldoCentavos > 0 && !confirmarSegunda) {
      setConfirmarSegunda(true)
      return
    }
    setArquivando(true)
    try {
      await atualizarFonte(fonteArquivando.id, { arquivada: true })
      showToast('Fonte arquivada.', 'success')
      dados.recarregar()
      setFonteArquivando(null)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setArquivando(false)
    }
  }

  async function reativar(fonte: SaldoFonte) {
    try {
      await atualizarFonte(fonte.id, { arquivada: false })
      showToast('Fonte reativada.', 'success')
      dados.recarregar()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    }
  }

  return (
    <>
      <PageHeader title="Fontes" action={<Button onClick={abrirCriar}>Criar fonte</Button>} />

      {dados.isLoading && <Spinner />}
      {dados.erro && <p className="text-alerta">{dados.erro.mensagem}</p>}

      {!dados.isLoading && (dados.data?.saldos.length ?? 0) === 0 && (
        <EmptyState
          titulo="Nenhuma fonte cadastrada"
          texto="Uma fonte é de onde o dinheiro sai — sua conta corrente, seu vale-refeição, sua carteira."
          acao={<Button onClick={abrirCriar}>Criar fonte</Button>}
        />
      )}

      {(dados.data?.saldos.length ?? 0) > 0 && (
        <>
          <label className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={mostrarArquivadas}
              onChange={(event) => setMostrarArquivadas(event.target.checked)}
            />
            Mostrar arquivadas
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cartoes.map((fonte) => {
              const corFaixa = fonte.tipo === 'livre' ? 'var(--color-livre)' : 'var(--color-restrita)'
              const inconsistente = fonte.saldoCentavos < 0
              const zerado = fonte.saldoCentavos === 0
              const categorias = nomesCategorias(
                mapaCategoriasPermitidas.get(fonte.id),
                mapaNomesCategorias,
              )

              return (
                <div
                  key={fonte.id}
                  className={`flex flex-col gap-2 rounded bg-surface p-4 pl-4 shadow-sm ${
                    fonte.arquivada ? 'opacity-50' : ''
                  }`}
                  style={{ borderLeft: `3px solid ${corFaixa}` }}
                >
                  <p className="font-medium text-ink">{fonte.nome}</p>

                  {fonte.ehCartao ? (
                    <BarraCartao
                      usadoCentavos={-fonte.saldoCentavos}
                      limiteCentavos={fonte.limiteCentavos ?? 0}
                    />
                  ) : inconsistente ? (
                    <div>
                      <span className="font-money text-[28px] font-semibold text-alerta">
                        <Money centavos={fonte.saldoCentavos} />
                      </span>
                      <p className="text-xs text-alerta">inconsistência</p>
                    </div>
                  ) : (
                    <div>
                      <span
                        className={`font-money text-[28px] font-semibold ${
                          zerado ? 'text-ink-soft' : 'text-ink'
                        }`}
                      >
                        <Money centavos={fonte.saldoCentavos} />
                      </span>
                      {zerado && <p className="text-xs text-ink-soft">sem saldo disponível</p>}
                    </div>
                  )}

                  <p className="text-xs text-ink-soft">
                    {fonte.ehCartao
                      ? `cartão de crédito · fatura dia ${fonte.diaFatura}`
                      : fonte.tipo === 'livre'
                        ? 'livre'
                        : `só ${categorias}`}
                  </p>

                  <div className="mt-2 flex gap-2">
                    {fonte.arquivada ? (
                      <Button variant="ghost" onClick={() => reativar(fonte)}>
                        Reativar
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" onClick={() => abrirEditar(fonte)}>
                          Editar
                        </Button>
                        <Button variant="ghost" onClick={() => iniciarArquivar(fonte)}>
                          Arquivar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <FonteFormModal
        key={aberturaId}
        aberto={formAberto}
        fonte={fonteEditando}
        onFechar={() => setFormAberto(false)}
        onSalvo={() => dados.recarregar()}
      />

      <Modal
        open={fonteArquivando !== null}
        onClose={() => setFonteArquivando(null)}
        title="Arquivar fonte"
      >
        <p className="mb-4 text-sm text-ink">
          Arquivar "{fonteArquivando?.nome}"? Ela tem{' '}
          <Money centavos={fonteArquivando?.saldoCentavos ?? 0} /> de saldo e deixará de aparecer
          nos lançamentos.
        </p>
        {confirmarSegunda && (
          <p className="mb-4 text-sm font-medium text-alerta">
            Essa fonte ainda tem saldo. Arquivar vai escondê-lo do resumo geral. Confirma mesmo
            assim?
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setFonteArquivando(null)}>
            Cancelar
          </Button>
          <Button variant="danger" loading={arquivando} onClick={confirmarArquivar}>
            {confirmarSegunda ? 'Arquivar mesmo assim' : 'Arquivar'}
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default FontesPage
