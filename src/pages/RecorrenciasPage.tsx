import { useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import EntradaFormModal from '../features/entradas/EntradaFormModal'
import type { FonteComSaldo } from '../features/saidas/elegibilidade'
import SaidaFormModal from '../features/saidas/SaidaFormModal'
import { useAsync } from '../hooks/useAsync'
import { mesAtual, nomeDoMes, resolverDiaRecorrencia } from '../lib/date'
import { mensagemDoErro } from '../lib/erros'
import { formatBRL } from '../lib/money'
import { atualizarEntrada, obterEntrada } from '../services/entradas'
import { listarFontes, listarSaldosFontes } from '../services/fontes'
import { listarSaldosCategorias } from '../services/categorias'
import {
  confirmarEntradaRecorrente,
  confirmarSaidaRecorrente,
  desfazerIgnorar,
  ignorarPendencia,
  listarPendentes,
  listarTemplates,
} from '../services/recorrencias'
import { definirRecorrenciaAtivaSaida, obterSaida } from '../services/saidas'
import type {
  Entrada,
  RecorrenciaPendente,
  RecorrenciaTemplate,
  Saida,
  SaldoCategoria,
} from '../types/domain'

async function carregarDados() {
  const [pendentes, templates, fontesBase, saldosFontes, saldosCategorias] = await Promise.all([
    listarPendentes(),
    listarTemplates(),
    listarFontes({ incluirArquivadas: false }),
    listarSaldosFontes(),
    listarSaldosCategorias(),
  ])

  const mapaSaldos = new Map(saldosFontes.map((s) => [s.id, s.saldoCentavos]))
  const fontesComSaldo: FonteComSaldo[] = fontesBase.map((f) => ({
    ...f,
    saldoCentavos: mapaSaldos.get(f.id) ?? 0,
  }))
  const categoriasNaoArquivadas = saldosCategorias.filter((c) => !c.arquivada)

  return { pendentes, templates, fontesComSaldo, categoriasNaoArquivadas }
}

function progressoLabel(totalParcelas: number | null, parcelasLancadas: number): string {
  return totalParcelas === null ? 'sem limite' : `${parcelasLancadas}/${totalParcelas}`
}

interface EntradaModalContexto {
  entrada?: Entrada
  confirmarPendencia?: RecorrenciaPendente
}

interface SaidaModalContexto {
  saida?: Saida
  confirmarPendencia?: RecorrenciaPendente
  templatePendencia?: Saida
}

function RecorrenciasPage() {
  const dados = useAsync(carregarDados, [])
  const { showToast } = useToast()

  const [aberturaId, setAberturaId] = useState(0)
  const [entradaModal, setEntradaModal] = useState<EntradaModalContexto | null>(null)
  const [saidaModal, setSaidaModal] = useState<SaidaModalContexto | null>(null)
  const [carregandoAcao, setCarregandoAcao] = useState<string | null>(null)

  const [ignorado, setIgnorado] = useState<{
    pendencia: RecorrenciaPendente
    competencia: string
  } | null>(null)
  const ignoradoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [resumoLancarTodas, setResumoLancarTodas] = useState<RecorrenciaPendente[] | null>(null)
  const [processandoTodas, setProcessandoTodas] = useState(false)
  const [resultadoLancarTodas, setResultadoLancarTodas] = useState<string | null>(null)

  const [templateEncerrando, setTemplateEncerrando] = useState<RecorrenciaTemplate | null>(null)
  const [alterandoStatus, setAlterandoStatus] = useState(false)

  const mapaFontes = useMemo(() => {
    const mapa = new Map<string, FonteComSaldo>()
    for (const fonte of dados.data?.fontesComSaldo ?? []) mapa.set(fonte.id, fonte)
    return mapa
  }, [dados.data])

  const mapaCategorias = useMemo(() => {
    const mapa = new Map<string, SaldoCategoria>()
    for (const categoria of dados.data?.categoriasNaoArquivadas ?? []) mapa.set(categoria.id, categoria)
    return mapa
  }, [dados.data])

  const pendentesOrdenadas = useMemo(() => {
    const base = dados.data?.pendentes ?? []
    return [...base].sort((a, b) => (a.diaRecorrencia ?? 0) - (b.diaRecorrencia ?? 0))
  }, [dados.data])

  const diaAtual = new Date().getDate()

  const templatesAtivos = (dados.data?.templates ?? []).filter((t) => t.recorrenciaAtiva)
  const templatesInativos = (dados.data?.templates ?? []).filter((t) => !t.recorrenciaAtiva)

  function fecharModais() {
    setEntradaModal(null)
    setSaidaModal(null)
  }

  async function abrirLancar(pendencia: RecorrenciaPendente) {
    if (pendencia.tipo === 'entrada') {
      setEntradaModal({ confirmarPendencia: pendencia })
      setAberturaId((id) => id + 1)
      return
    }
    setCarregandoAcao(pendencia.templateId)
    try {
      const template = await obterSaida(pendencia.templateId)
      setSaidaModal({ confirmarPendencia: pendencia, templatePendencia: template })
      setAberturaId((id) => id + 1)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setCarregandoAcao(null)
    }
  }

  async function abrirEditarTemplate(template: RecorrenciaTemplate) {
    setCarregandoAcao(template.templateId)
    try {
      if (template.tipo === 'entrada') {
        const entrada = await obterEntrada(template.templateId)
        setEntradaModal({ entrada })
      } else {
        const saida = await obterSaida(template.templateId)
        setSaidaModal({ saida })
      }
      setAberturaId((id) => id + 1)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setCarregandoAcao(null)
    }
  }

  async function handleIgnorar(pendencia: RecorrenciaPendente) {
    const competencia = `${mesAtual()}-01`
    try {
      await ignorarPendencia(pendencia.templateId, pendencia.tipo, competencia)
      dados.recarregar()
      if (ignoradoTimer.current) clearTimeout(ignoradoTimer.current)
      setIgnorado({ pendencia, competencia })
      ignoradoTimer.current = setTimeout(() => setIgnorado(null), 8000)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    }
  }

  async function handleDesfazerIgnorar() {
    if (!ignorado) return
    if (ignoradoTimer.current) clearTimeout(ignoradoTimer.current)
    try {
      await desfazerIgnorar(ignorado.pendencia.templateId, ignorado.pendencia.tipo, ignorado.competencia)
      setIgnorado(null)
      dados.recarregar()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    }
  }

  async function confirmarLancarTodas() {
    if (!resumoLancarTodas) return
    setProcessandoTodas(true)
    let sucesso = 0
    let bloqueio: { titulo: string; motivo: string } | null = null

    for (const pendencia of resumoLancarTodas) {
      const data = resolverDiaRecorrencia(mesAtual(), pendencia.diaRecorrencia ?? 1)
      try {
        if (pendencia.tipo === 'entrada') {
          await confirmarEntradaRecorrente(pendencia, pendencia.valorSugeridoCentavos, data)
        } else {
          const template = await obterSaida(pendencia.templateId)
          await confirmarSaidaRecorrente(pendencia, pendencia.valorSugeridoCentavos, data, template.splits)
        }
        sucesso += 1
      } catch (e) {
        bloqueio = { titulo: pendencia.titulo, motivo: mensagemDoErro(e) }
        break
      }
    }

    setProcessandoTodas(false)
    setResumoLancarTodas(null)
    dados.recarregar()

    const partes = [`${sucesso} lançamento${sucesso === 1 ? '' : 's'} feito${sucesso === 1 ? '' : 's'}.`]
    if (bloqueio) partes.push(`1 bloqueado: ${bloqueio.titulo} (${bloqueio.motivo})`)
    setResultadoLancarTodas(partes.join(' '))
  }

  async function confirmarAlterarStatus() {
    if (!templateEncerrando) return
    setAlterandoStatus(true)
    const novoValor = !templateEncerrando.recorrenciaAtiva
    try {
      if (templateEncerrando.tipo === 'entrada') {
        await atualizarEntrada(templateEncerrando.templateId, { recorrenciaAtiva: novoValor })
      } else {
        await definirRecorrenciaAtivaSaida(templateEncerrando.templateId, novoValor)
      }
      showToast(novoValor ? 'Recorrência reativada.' : 'Recorrência encerrada.', 'success')
      dados.recarregar()
      setTemplateEncerrando(null)
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setAlterandoStatus(false)
    }
  }

  function rotuloFonteOuCategoria(item: { tipo: 'entrada' | 'saida'; fonteId: string | null; categoriaId: string | null }) {
    if (item.tipo === 'entrada') return mapaFontes.get(item.fonteId ?? '')?.nome ?? '—'
    return mapaCategorias.get(item.categoriaId ?? '')?.nome ?? '—'
  }

  const semFontes = (dados.data?.fontesComSaldo.length ?? 0) === 0

  return (
    <>
      <PageHeader title="Recorrências" />

      {dados.isLoading && <Spinner />}
      {dados.erro && <p className="text-alerta">{dados.erro.mensagem}</p>}

      {dados.data && (
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="mb-3 text-sm font-medium text-ink-soft">
              Pendentes em {nomeDoMes(mesAtual())}
            </h2>

            {ignorado && (
              <div className="mb-3 flex items-center justify-between rounded border border-line bg-base p-3 text-sm">
                <span>"{ignorado.pendencia.titulo}" foi ignorado.</span>
                <Button variant="ghost" onClick={handleDesfazerIgnorar}>
                  Desfazer
                </Button>
              </div>
            )}

            {pendentesOrdenadas.length === 0 && (
              <p className="text-sm text-ink-soft">Tudo lançado em {nomeDoMes(mesAtual())}.</p>
            )}

            {pendentesOrdenadas.length > 0 && (
              <>
                <ul className="flex flex-col gap-3">
                  {pendentesOrdenadas.map((pendencia) => {
                    const atrasado = (pendencia.diaRecorrencia ?? 0) < diaAtual
                    return (
                      <li
                        key={`${pendencia.tipo}-${pendencia.templateId}`}
                        className="rounded border border-line p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-ink">
                              <span className="text-ink-soft">dia {pendencia.diaRecorrencia}</span>{' '}
                              {pendencia.titulo}{' '}
                              <span className="text-xs text-ink-soft">
                                {pendencia.tipo === 'entrada' ? 'entrada' : 'saída'}
                              </span>
                              {atrasado && <span className="ml-2 text-xs text-alerta">atrasado</span>}
                            </p>
                            <p className="text-xs text-ink-soft">
                              {rotuloFonteOuCategoria(pendencia)} ·{' '}
                              {progressoLabel(pendencia.totalParcelas, pendencia.parcelasLancadas + 1)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-money text-sm text-ink">
                              {formatBRL(pendencia.valorSugeridoCentavos)}
                            </span>
                            <Button variant="ghost" onClick={() => handleIgnorar(pendencia)}>
                              Ignorar
                            </Button>
                            <Button
                              variant="secondary"
                              loading={carregandoAcao === pendencia.templateId}
                              onClick={() => abrirLancar(pendencia)}
                            >
                              Lançar
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-4 flex justify-center">
                  <Button onClick={() => setResumoLancarTodas(pendentesOrdenadas)}>Lançar todas</Button>
                </div>
              </>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Todas as recorrências</h2>

            {(dados.data.templates.length ?? 0) === 0 && (
              <p className="text-sm text-ink-soft">Nenhuma recorrência cadastrada ainda.</p>
            )}

            {templatesAtivos.length > 0 && (
              <ul className="flex flex-col">
                {templatesAtivos.map((template) => (
                  <li
                    key={`${template.tipo}-${template.templateId}`}
                    className="flex items-center justify-between gap-2 border-b border-line py-2"
                  >
                    <div>
                      <p className="text-sm text-ink">{template.titulo}</p>
                      <p className="text-xs text-ink-soft">
                        {template.tipo === 'entrada' ? 'entrada' : 'saída'} · dia{' '}
                        {template.diaRecorrencia} ·{' '}
                        {progressoLabel(template.totalParcelas, template.parcelasLancadas)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-money text-sm text-ink-soft">
                        {formatBRL(template.valorCentavos)}
                      </span>
                      <Button
                        variant="ghost"
                        loading={carregandoAcao === template.templateId}
                        onClick={() => abrirEditarTemplate(template)}
                      >
                        Editar
                      </Button>
                      <Button variant="ghost" onClick={() => setTemplateEncerrando(template)}>
                        Encerrar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {templatesInativos.length > 0 && (
              <ul className="mt-4 flex flex-col opacity-60">
                {templatesInativos.map((template) => {
                  const concluida =
                    template.totalParcelas !== null &&
                    template.parcelasLancadas >= template.totalParcelas
                  return (
                    <li
                      key={`${template.tipo}-${template.templateId}`}
                      className="flex items-center justify-between gap-2 border-b border-line py-2"
                    >
                      <div>
                        <p className="text-sm text-ink">{template.titulo}</p>
                        <p className="text-xs text-ink-soft">
                          {template.tipo === 'entrada' ? 'entrada' : 'saída'} ·{' '}
                          {concluida
                            ? `${progressoLabel(template.totalParcelas, template.parcelasLancadas)} · Concluída`
                            : 'Encerrada'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-money text-sm text-ink-soft">
                          {formatBRL(template.valorCentavos)}
                        </span>
                        {!concluida && (
                          <Button variant="ghost" onClick={() => setTemplateEncerrando(template)}>
                            Reativar
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {semFontes && !dados.isLoading && (
        <EmptyState
          titulo="Nenhuma fonte cadastrada"
          texto="Cadastre uma fonte antes de lançar uma recorrência."
          acao={null}
        />
      )}

      <EntradaFormModal
        key={`entrada-${aberturaId}`}
        aberto={entradaModal !== null}
        entrada={entradaModal?.entrada}
        confirmarPendencia={entradaModal?.confirmarPendencia}
        fontes={dados.data?.fontesComSaldo ?? []}
        onFechar={fecharModais}
        onSalvo={() => {
          fecharModais()
          dados.recarregar()
        }}
      />

      <SaidaFormModal
        key={`saida-${aberturaId}`}
        aberto={saidaModal !== null}
        saida={saidaModal?.saida}
        confirmarPendencia={saidaModal?.confirmarPendencia}
        templatePendencia={saidaModal?.templatePendencia}
        fontes={dados.data?.fontesComSaldo ?? []}
        categorias={dados.data?.categoriasNaoArquivadas ?? []}
        saldosCategorias={dados.data?.categoriasNaoArquivadas ?? []}
        onFechar={fecharModais}
        onSalvo={() => {
          fecharModais()
          dados.recarregar()
        }}
      />

      <Modal
        open={resumoLancarTodas !== null}
        onClose={() => setResumoLancarTodas(null)}
        title="Lançar todas as pendências"
      >
        <p className="mb-4 text-sm text-ink">
          {resumoLancarTodas?.length} lançamento{resumoLancarTodas?.length === 1 ? '' : 's'} será
          {resumoLancarTodas?.length === 1 ? '' : 'ão'} feito
          {resumoLancarTodas?.length === 1 ? '' : 's'} na ordem do dia de recorrência. Se algum for
          bloqueado (sem saldo), o processo para e o que já foi lançado permanece.
        </p>
        <ul className="mb-4 flex flex-col gap-1 text-sm text-ink-soft">
          {resumoLancarTodas?.map((p) => (
            <li key={`${p.tipo}-${p.templateId}`}>
              {p.titulo} — {formatBRL(p.valorSugeridoCentavos)}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResumoLancarTodas(null)}>
            Cancelar
          </Button>
          <Button loading={processandoTodas} onClick={confirmarLancarTodas}>
            Confirmar
          </Button>
        </div>
      </Modal>

      <Modal
        open={resultadoLancarTodas !== null}
        onClose={() => setResultadoLancarTodas(null)}
        title="Resultado"
      >
        <p className="mb-4 text-sm text-ink">{resultadoLancarTodas}</p>
        <div className="flex justify-end">
          <Button onClick={() => setResultadoLancarTodas(null)}>Fechar</Button>
        </div>
      </Modal>

      <Modal
        open={templateEncerrando !== null}
        onClose={() => setTemplateEncerrando(null)}
        title={templateEncerrando?.recorrenciaAtiva ? 'Encerrar recorrência' : 'Reativar recorrência'}
      >
        <p className="mb-4 text-sm text-ink">
          {templateEncerrando?.recorrenciaAtiva
            ? `Encerrar a recorrência de "${templateEncerrando?.titulo}"? Ela não aparecerá mais nas pendências mensais. Os lançamentos já feitos permanecem.`
            : `Reativar a recorrência de "${templateEncerrando?.titulo}"?`}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setTemplateEncerrando(null)}>
            Cancelar
          </Button>
          <Button loading={alterandoStatus} onClick={confirmarAlterarStatus}>
            Confirmar
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default RecorrenciasPage
