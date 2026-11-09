import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/layout/AppShell'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import MoneyInput from '../components/ui/MoneyInput'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useAsync } from '../hooks/useAsync'
import { formatarData, haQuantoTempo, hojeISO } from '../lib/date'
import { mensagemDoErro, mensagemErroSincronizacao } from '../lib/erros'
import { formatBRL } from '../lib/money'
import { listarFontes } from '../services/fontes'
import {
  cadastrarItem,
  listarContasPluggy,
  listarItens,
  obterStatusIntegracao,
  removerItem,
  sincronizarAgora,
  vincularConta,
} from '../services/integracao'
import type { Fonte, PluggyConta, PluggyItem } from '../types/domain'

async function carregarDados() {
  const [itens, contas, fontes, status] = await Promise.all([
    listarItens(),
    listarContasPluggy(),
    listarFontes(),
    obterStatusIntegracao(),
  ])
  return { itens, contas, fontes, status }
}

function badgeStatus(status: string | null): { rotulo: string; classe: string } {
  if (status === 'UPDATED') return { rotulo: 'Atualizado', classe: 'bg-livre/10 text-livre' }
  if (status === 'UPDATING') return { rotulo: 'Atualizando', classe: 'bg-base text-ink-soft' }
  if (status === 'LOGIN_ERROR' || status === 'WAITING_USER_INPUT')
    return { rotulo: 'Reconectar no Meu Pluggy', classe: 'bg-alerta/10 text-alerta' }
  if (status === 'OUTDATED') return { rotulo: 'Erro na Pluggy', classe: 'bg-alerta/10 text-alerta' }
  return { rotulo: 'Aguardando sincronização', classe: 'bg-base text-ink-soft' }
}

function ConexoesPage() {
  const { showToast } = useToast()
  const dados = useAsync(carregarDados, [])
  const [itemId, setItemId] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [removendo, setRemovendo] = useState<PluggyItem | null>(null)
  const [vinculando, setVinculando] = useState<PluggyConta | null>(null)

  async function adicionar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!itemId.trim()) return
    setAdicionando(true)
    try {
      await cadastrarItem(itemId)
      setItemId('')
      showToast('Conexão adicionada. Sincronizando…', 'success')
      await sincronizar()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setAdicionando(false)
    }
  }

  async function sincronizar() {
    setSincronizando(true)
    try {
      const r = await sincronizarAgora()
      if (r.sucesso) showToast(`Sincronizado. ${r.importadas} transações novas.`, 'success')
      else showToast(`Sincronização com erro: ${mensagemErroSincronizacao(r.erro)}.`, 'error')
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setSincronizando(false)
      dados.recarregar()
    }
  }

  const status = dados.data?.status

  return (
    <>
      <PageHeader
        title="Conexões"
        action={
          <Button onClick={sincronizar} loading={sincronizando} disabled={sincronizando}>
            Sincronizar agora
          </Button>
        }
      />

      {status?.ultimaSincronizacaoEm && (
        <p className="mb-4 text-sm text-ink-soft">
          Última sincronização: {haQuantoTempo(status.ultimaSincronizacaoEm)}
          {status.ultimaSincronizacaoSucesso
            ? ` (${status.ultimaSincronizacaoImportadas ?? 0} importadas)`
            : ` — falhou: ${mensagemErroSincronizacao(status.ultimaSincronizacaoErro)}`}
        </p>
      )}

      {dados.isLoading && !dados.data && <Spinner />}
      {dados.erro && <p className="text-sm text-alerta">Não foi possível carregar as conexões.</p>}

      {dados.data && (
        <div className="flex flex-col gap-8">
          {dados.data.itens.map((item) => {
            const badge = badgeStatus(item.status)
            const contas = dados.data!.contas.filter((c) => c.itemId === item.itemId)
            return (
              <section key={item.id} className="rounded border border-line bg-surface p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="flex-1 font-medium text-ink">{item.nome ?? item.itemId}</h2>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge.classe}`}>{badge.rotulo}</span>
                  <Button variant="ghost" onClick={() => setRemovendo(item)}>
                    Remover
                  </Button>
                </div>
                {item.atualizadoNaPluggyEm && (
                  <p className="mb-3 text-xs text-ink-soft">
                    Dados do banco na Pluggy atualizados {haQuantoTempo(item.atualizadoNaPluggyEm)}.
                  </p>
                )}
                {contas.length === 0 ? (
                  <p className="text-sm text-ink-soft">Nenhuma conta ainda — sincronize para buscar.</p>
                ) : (
                  <ul className="flex flex-col">
                    {contas.map((conta) => {
                      const fonte = dados.data!.fontes.find((f) => f.pluggyAccountId === conta.pluggyAccountId)
                      return (
                        <li
                          key={conta.pluggyAccountId}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2 last:border-b-0"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">
                            {conta.nome}
                            <span className="ml-2 text-xs text-ink-soft">
                              {conta.tipo === 'CREDIT' ? 'cartão' : 'conta'}
                            </span>
                          </span>
                          <span className="font-money text-sm text-ink">
                            {conta.tipo === 'CREDIT' ? `fatura ${formatBRL(conta.saldoCentavos)}` : formatBRL(conta.saldoCentavos)}
                          </span>
                          {fonte ? (
                            <span className="w-full text-xs text-ink-soft sm:w-auto">
                              → {fonte.nome}
                              {conta.dataCorte && ` · desde ${formatarData(conta.dataCorte)}`}
                            </span>
                          ) : (
                            <Button variant="secondary" onClick={() => setVinculando(conta)}>
                              Vincular
                            </Button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}

          <section>
            <h2 className="mb-2 text-sm font-medium text-ink-soft">Adicionar conexão</h2>
            <form onSubmit={adicionar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Item ID da Pluggy"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  hint='Não é o link do meu.pluggy.ai. No Dashboard da Pluggy: "Iniciar Demo" → conectar usando o conector "MeuPluggy" → menu ⋮ → "Copiar Item ID".'
                />
              </div>
              <Button type="submit" loading={adicionando} disabled={adicionando || !itemId.trim()}>
                Adicionar
              </Button>
            </form>
          </section>
        </div>
      )}

      <Modal open={removendo !== null} onClose={() => setRemovendo(null)} title="Remover conexão">
        <p className="mb-4 text-sm text-ink">
          Remover "{removendo?.nome ?? removendo?.itemId}"? As transações ainda não revisadas dela somem de
          Importadas. Lançamentos já confirmados e Fontes continuam.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemovendo(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              const item = removendo
              setRemovendo(null)
              if (!item) return
              try {
                await removerItem(item.id)
                showToast('Conexão removida.', 'success')
                dados.recarregar()
              } catch (e) {
                showToast(mensagemDoErro(e), 'error')
              }
            }}
          >
            Remover
          </Button>
        </div>
      </Modal>

      {vinculando && (
        <VincularModal
          conta={vinculando}
          fontes={dados.data?.fontes ?? []}
          onFechar={() => setVinculando(null)}
          onSalvo={() => {
            setVinculando(null)
            showToast('Conta vinculada. Saldo inicial lançado.', 'success')
            dados.recarregar()
          }}
        />
      )}
    </>
  )
}

function VincularModal({
  conta,
  fontes,
  onFechar,
  onSalvo,
}: {
  conta: PluggyConta
  fontes: Fonte[]
  onFechar(): void
  onSalvo(): void
}) {
  const ehCartao = conta.tipo === 'CREDIT'
  // Fonte existente: mesmo tipo (cartão ↔ cartão), não arquivada, sem vínculo.
  const candidatas = fontes.filter((f) => !f.pluggyAccountId && f.ehCartao === ehCartao && !f.arquivada)
  const [modo, setModo] = useState<'nova' | 'existente'>('nova')
  const [fonteId, setFonteId] = useState(candidatas[0]?.id ?? '')
  const [nome, setNome] = useState(conta.nome)
  const [limite, setLimite] = useState(conta.limiteCentavos ?? 0)
  const [diaFatura, setDiaFatura] = useState<number | ''>(conta.diaFatura ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const textoSaldo = ehCartao
    ? conta.saldoCentavos > 0
      ? `Será lançada a fatura em aberto de ${formatBRL(conta.saldoCentavos)} como saldo inicial.`
      : 'Sem fatura em aberto: nenhum saldo inicial será lançado.'
    : conta.saldoCentavos > 0
      ? `Será lançado um saldo inicial de ${formatBRL(conta.saldoCentavos)}.`
      : 'Saldo zero ou negativo: nenhum saldo inicial será lançado.'

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro(null)
    if (modo === 'existente' && !fonteId) return setErro('Escolha uma fonte.')
    if (modo === 'nova') {
      if (!nome.trim()) return setErro('Informe o nome da fonte.')
      if (ehCartao && (limite <= 0 || diaFatura === '' || diaFatura < 1 || diaFatura > 31))
        return setErro('Cartão precisa de limite e dia da fatura (1 a 31).')
    }
    setEnviando(true)
    try {
      await vincularConta(
        conta.pluggyAccountId,
        modo === 'existente'
          ? { fonteId }
          : {
              novaFonte: {
                nome: nome.trim(),
                ...(ehCartao ? { limiteCentavos: limite, diaFatura: diaFatura as number } : {}),
              },
            },
      )
      onSalvo()
    } catch (e) {
      setErro(mensagemDoErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open onClose={onFechar} title={`Vincular ${conta.nome}`}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        {candidatas.length > 0 && (
          <Select label="Fonte" value={modo} onChange={(e) => setModo(e.target.value as 'nova' | 'existente')}>
            <option value="nova">Criar fonte nova</option>
            <option value="existente">Usar fonte existente</option>
          </Select>
        )}
        {modo === 'existente' ? (
          <Select label="Fonte existente" value={fonteId} onChange={(e) => setFonteId(e.target.value)}>
            {candidatas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        ) : (
          <>
            <Input label="Nome da fonte" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} />
            {ehCartao && (
              <>
                <MoneyInput label="Limite do cartão" value={limite} onChange={setLimite} />
                <Input
                  label="Dia da fatura"
                  type="number"
                  min={1}
                  max={31}
                  value={diaFatura}
                  onChange={(e) => setDiaFatura(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </>
            )}
          </>
        )}
        <p className="rounded bg-base p-3 text-xs text-ink-soft">
          {textoSaldo} Só transações depois de hoje ({formatarData(hojeISO())}) serão importadas.
        </p>
        {erro && <p className="text-sm text-alerta">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando} disabled={enviando}>
            Vincular
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ConexoesPage