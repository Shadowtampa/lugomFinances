import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import BarraLimite from '../features/categorias/BarraLimite'
import CategoriaFormModal from '../features/categorias/CategoriaFormModal'
import { CORES_CATEGORIA } from '../features/categorias/cores'
import { mesAtual, primeiroDiaDoMes } from '../lib/date'
import { mensagemDoErro } from '../lib/erros'
import { useAsync } from '../hooks/useAsync'
import {
  arquivarCategoria,
  atualizarCategoria,
  criarCategoria,
  listarSaldosCategorias,
  obterCategoria,
} from '../services/categorias'
import type { Categoria, SaldoCategoria } from '../types/domain'

const SUGESTOES = [
  'Alimentação',
  'Supermercado',
  'Transporte',
  'Moradia',
  'Saúde',
  'Lazer',
  'Assinaturas',
  'Outros',
]

function estourou(categoria: SaldoCategoria): boolean {
  return categoria.limiteMensalCentavos !== null && (categoria.saldoDisponivelCentavos ?? 0) < 0
}

function CategoriasPage() {
  const saldos = useAsync(listarSaldosCategorias, [])
  const { showToast } = useToast()

  const [mostrarArquivadas, setMostrarArquivadas] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | undefined>()
  const [aberturaId, setAberturaId] = useState(0)
  const [categoriaArquivando, setCategoriaArquivando] = useState<SaldoCategoria | null>(null)
  const [criandoSugestoes, setCriandoSugestoes] = useState(false)
  const [carregandoEdicao, setCarregandoEdicao] = useState<string | null>(null)

  const linhas = useMemo(() => {
    const base = (saldos.data ?? []).filter((c) => mostrarArquivadas || !c.arquivada)
    return [...base].sort((a, b) => {
      const aEstourou = estourou(a)
      const bEstourou = estourou(b)
      if (aEstourou !== bEstourou) return aEstourou ? -1 : 1
      return a.nome.localeCompare(b.nome)
    })
  }, [saldos.data, mostrarArquivadas])

  function abrirCriar() {
    setCategoriaEditando(undefined)
    setFormAberto(true)
    setAberturaId((id) => id + 1)
  }

  async function abrirEditar(categoria: SaldoCategoria) {
    setCarregandoEdicao(categoria.id)
    try {
      const categoriaCompleta = await obterCategoria(categoria.id)
      setCategoriaEditando(categoriaCompleta)
      setFormAberto(true)
      setAberturaId((id) => id + 1)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setCarregandoEdicao(null)
    }
  }

  async function confirmarArquivar() {
    if (!categoriaArquivando) return
    try {
      await arquivarCategoria(categoriaArquivando.id)
      showToast('Categoria arquivada.', 'success')
      saldos.recarregar()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setCategoriaArquivando(null)
    }
  }

  async function reativar(categoria: SaldoCategoria) {
    try {
      await atualizarCategoria(categoria.id, { arquivada: false })
      showToast('Categoria reativada.', 'success')
      saldos.recarregar()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    }
  }

  async function usarSugestoes() {
    setCriandoSugestoes(true)
    try {
      for (const [indice, nome] of SUGESTOES.entries()) {
        await criarCategoria({
          nome,
          limiteMensalCentavos: null,
          vigenciaInicio: primeiroDiaDoMes(mesAtual()),
          cor: CORES_CATEGORIA[indice % CORES_CATEGORIA.length],
        })
      }
      showToast('Categorias sugeridas criadas.', 'success')
      saldos.recarregar()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setCriandoSugestoes(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Categorias"
        action={<Button onClick={abrirCriar}>Criar categoria</Button>}
      />

      {saldos.isLoading && <Spinner />}
      {saldos.erro && <p className="text-alerta">{saldos.erro.mensagem}</p>}

      {!saldos.isLoading && (saldos.data?.length ?? 0) === 0 && (
        <EmptyState
          titulo="Nenhuma categoria ainda"
          texto="Categorias organizam seus gastos e definem quanto você pretende gastar em cada coisa."
          acao={
            <div className="flex gap-2">
              <Button onClick={abrirCriar}>Criar categoria</Button>
              <Button variant="secondary" loading={criandoSugestoes} onClick={usarSugestoes}>
                Usar sugestões
              </Button>
            </div>
          }
        />
      )}

      {(saldos.data?.length ?? 0) > 0 && (
        <>
          <label className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={mostrarArquivadas}
              onChange={(event) => setMostrarArquivadas(event.target.checked)}
            />
            Mostrar arquivadas
          </label>

          <ul className="flex flex-col">
            {linhas.map((categoria) => (
              <li
                key={categoria.id}
                className={`flex flex-col gap-2 border-b border-line py-3 pl-3 sm:flex-row sm:items-start sm:gap-3 ${
                  categoria.arquivada ? 'opacity-50' : ''
                }`}
                style={{ borderLeft: `3px solid ${categoria.cor}` }}
              >
                <div className="flex-1">
                  <p className="font-medium text-ink">{categoria.nome}</p>
                  <BarraLimite
                    totalGastoCentavos={categoria.totalGastoCentavos}
                    limiteAcumuladoCentavos={categoria.limiteAcumuladoCentavos}
                    gastoMesAtualCentavos={categoria.gastoMesAtualCentavos}
                  />
                </div>

                <div className="flex shrink-0 gap-2">
                  {categoria.arquivada ? (
                    <Button variant="ghost" onClick={() => reativar(categoria)}>
                      Reativar
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        loading={carregandoEdicao === categoria.id}
                        disabled={carregandoEdicao !== null}
                        onClick={() => abrirEditar(categoria)}
                      >
                        Editar
                      </Button>
                      <Button variant="ghost" onClick={() => setCategoriaArquivando(categoria)}>
                        Arquivar
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <CategoriaFormModal
        key={aberturaId}
        aberto={formAberto}
        categoria={categoriaEditando}
        onFechar={() => setFormAberto(false)}
        onSalvo={() => saldos.recarregar()}
      />

      <Modal
        open={categoriaArquivando !== null}
        onClose={() => setCategoriaArquivando(null)}
        title="Arquivar categoria"
      >
        <p className="mb-4 text-sm text-ink">
          Arquivar "{categoriaArquivando?.nome}"? Lançamentos antigos continuam
          apontando para ela, mas ela some do seletor ao cadastrar novas saídas.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCategoriaArquivando(null)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmarArquivar}>
            Arquivar
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default CategoriasPage
