import { useEffect, useRef, useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import MoneyInput from '../../components/ui/MoneyInput'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { usePainelSaldo } from '../../contexts/PainelSaldoContext'
import { mesAtual, resolverDiaRecorrencia } from '../../lib/date'
import { formatBRL } from '../../lib/money'
import { mensagemDoErro } from '../../lib/erros'
import { atualizarEntrada, criarEntrada } from '../../services/entradas'
import { listarSaldosFontes } from '../../services/fontes'
import { confirmarEntradaRecorrente } from '../../services/recorrencias'
import type { Entrada, RecorrenciaPendente } from '../../types/domain'
import type { FonteComSaldo } from '../saidas/elegibilidade'

interface EntradaFormModalProps {
  aberto: boolean
  entrada?: Entrada
  duplicarDe?: Entrada
  confirmarPendencia?: RecorrenciaPendente
  fontes: FonteComSaldo[]
  onFechar(): void
  onSalvo(fonteId: string): void
}

function hojeISO(): string {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dia = String(hoje.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function diaDe(dataISO: string): number {
  return Number(dataISO.split('-')[2])
}

function previewFonte(fonte: FonteComSaldo | undefined, valorCentavos: number) {
  if (!fonte || valorCentavos <= 0) return null
  const depois = fonte.saldoCentavos + valorCentavos
  return `${fonte.nome}: ${formatBRL(fonte.saldoCentavos)} → ${formatBRL(depois)}`
}

function EntradaFormModal({
  aberto,
  entrada,
  duplicarDe,
  confirmarPendencia,
  fontes,
  onFechar,
  onSalvo,
}: EntradaFormModalProps) {
  const { showToast } = useToast()
  const { mostrarPainelSaldo } = usePainelSaldo()
  const tituloRef = useRef<HTMLInputElement>(null)

  const origem = entrada ?? duplicarDe

  const [titulo, setTitulo] = useState(confirmarPendencia?.titulo ?? origem?.titulo ?? '')
  const [erroTitulo, setErroTitulo] = useState<string | null>(null)
  const [valorCentavos, setValorCentavos] = useState(
    confirmarPendencia?.valorSugeridoCentavos ?? origem?.valorCentavos ?? 0,
  )
  const [erroValor, setErroValor] = useState<string | null>(null)
  const [fonteId, setFonteId] = useState(
    confirmarPendencia?.fonteId ?? origem?.fonteId ?? fontes[0]?.id ?? '',
  )
  const [erroFonte, setErroFonte] = useState<string | null>(null)
  const [data, setData] = useState(
    confirmarPendencia
      ? resolverDiaRecorrencia(mesAtual(), confirmarPendencia.diaRecorrencia ?? 1)
      : (origem?.data ?? hojeISO()),
  )
  const [erroData, setErroData] = useState<string | null>(null)
  const [recorrente, setRecorrente] = useState(origem?.recorrente ?? false)
  const [diaRecorrencia, setDiaRecorrencia] = useState(
    origem?.diaRecorrencia ?? diaDe(origem?.data ?? hojeISO()),
  )
  const [erroDia, setErroDia] = useState<string | null>(null)
  const [totalParcelas, setTotalParcelas] = useState<number | ''>(origem?.totalParcelas ?? '')
  const [erroParcelas, setErroParcelas] = useState<string | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    tituloRef.current?.focus()
  }, [])

  const ehTemplate = entrada?.recorrente === true && entrada.templateId === null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErroGeral(null)

    const tituloAparado = titulo.trim()
    let temErro = false

    if (tituloAparado.length < 1 || tituloAparado.length > 60) {
      setErroTitulo('Título deve ter entre 1 e 60 caracteres.')
      temErro = true
    } else {
      setErroTitulo(null)
    }

    if (valorCentavos <= 0) {
      setErroValor('Valor deve ser maior que zero.')
      temErro = true
    } else {
      setErroValor(null)
    }

    if (!fonteId) {
      setErroFonte('Selecione uma fonte.')
      temErro = true
    } else {
      setErroFonte(null)
    }

    if (!data) {
      setErroData('Selecione uma data.')
      temErro = true
    } else {
      setErroData(null)
    }

    if (recorrente && (diaRecorrencia < 1 || diaRecorrencia > 31)) {
      setErroDia('Dia deve estar entre 1 e 31.')
      temErro = true
    } else {
      setErroDia(null)
    }

    if (recorrente && totalParcelas !== '' && (!Number.isInteger(totalParcelas) || totalParcelas < 1)) {
      setErroParcelas('Número de parcelas deve ser um inteiro maior que zero.')
      temErro = true
    } else {
      setErroParcelas(null)
    }

    if (temErro) return

    setEnviando(true)

    async function mostrarPainelFonte(fonteIdSalvo: string) {
      try {
        const saldos = await listarSaldosFontes()
        const saldoFonte = saldos.find((s) => s.id === fonteIdSalvo)
        if (!saldoFonte) return
        mostrarPainelSaldo({
          titulo: 'Entrada registrada',
          fontes: [{ rotulo: saldoFonte.nome, cor: saldoFonte.cor, valorCentavos: saldoFonte.saldoCentavos }],
        })
      } catch {
        // painel é cosmético — a lista já foi recarregada
      }
    }

    try {
      if (confirmarPendencia) {
        const entradaCriada = await confirmarEntradaRecorrente(confirmarPendencia, valorCentavos, data)
        await mostrarPainelFonte(entradaCriada.fonteId)
        onSalvo(entradaCriada.fonteId)
        onFechar()
        return
      }

      if (entrada && valorCentavos !== entrada.valorCentavos) {
        const saldos = await listarSaldosFontes()
        const saldoFonteAntiga = saldos.find((s) => s.id === entrada.fonteId)
        if (saldoFonteAntiga) {
          const saldoNovo = saldoFonteAntiga.saldoCentavos - entrada.valorCentavos + valorCentavos
          if (fonteId === entrada.fonteId && saldoNovo < 0) {
            setErroGeral(
              `Não é possível reduzir para ${formatBRL(valorCentavos)}. Isso deixaria ${
                saldoFonteAntiga.nome
              } com saldo negativo de ${formatBRL(Math.abs(saldoNovo))}. Remova ou ajuste saídas antes.`,
            )
            setEnviando(false)
            return
          }
          if (fonteId !== entrada.fonteId) {
            const saldoAposRemocao = saldoFonteAntiga.saldoCentavos - entrada.valorCentavos
            if (saldoAposRemocao < 0) {
              setErroGeral(
                `Não é possível mover esta entrada. Isso deixaria ${saldoFonteAntiga.nome} com saldo negativo de ${formatBRL(
                  Math.abs(saldoAposRemocao),
                )}. Remova ou ajuste saídas antes.`,
              )
              setEnviando(false)
              return
            }
          }
        }
      }

      const dados = {
        titulo: tituloAparado,
        valorCentavos,
        fonteId,
        data,
        recorrente,
        diaRecorrencia: recorrente ? diaRecorrencia : null,
        totalParcelas: recorrente && totalParcelas !== '' ? totalParcelas : null,
      }

      if (entrada) {
        await atualizarEntrada(entrada.id, dados)
      } else {
        await criarEntrada({
          ...dados,
          recorrenciaAtiva: recorrente,
          templateId: null,
          ehPagamentoFatura: false,
        })
      }
      await mostrarPainelFonte(fonteId)
      onSalvo(fonteId)
      onFechar()
    } catch (e) {
      showToast(mensagemDoErro(e), 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title={confirmarPendencia ? 'Lançar pendência' : entrada ? 'Editar entrada' : 'Nova entrada'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          ref={tituloRef}
          label="Título"
          value={titulo}
          onChange={(event) => setTitulo(event.target.value)}
          error={erroTitulo ?? undefined}
          maxLength={60}
          required
        />

        <MoneyInput
          label="Valor"
          value={valorCentavos}
          onChange={setValorCentavos}
          error={erroValor ?? undefined}
        />

        <div className="flex flex-col gap-1">
          <Select
            label="Fonte"
            value={fonteId}
            onChange={(event) => setFonteId(event.target.value)}
            error={erroFonte ?? undefined}
          >
            {fontes.map((fonte) => (
              <option key={fonte.id} value={fonte.id}>
                {fonte.nome}
              </option>
            ))}
          </Select>
          {(() => {
            const preview = previewFonte(
              fontes.find((f) => f.id === fonteId),
              valorCentavos,
            )
            return preview && <span className="text-xs text-ink-soft">{preview}</span>
          })()}
        </div>

        <Input
          label="Data"
          type="date"
          value={data}
          onChange={(event) => setData(event.target.value)}
          error={erroData ?? undefined}
          required
        />

        {!confirmarPendencia && (
          <>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={recorrente}
                onChange={(event) => setRecorrente(event.target.checked)}
              />
              Recorrente
            </label>

            {recorrente && (
              <div className="animate-expandir flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink" htmlFor="dia-recorrencia">
                    Dia da recorrência
                  </label>
                  <input
                    id="dia-recorrencia"
                    type="number"
                    min={1}
                    max={31}
                    value={diaRecorrencia}
                    onChange={(event) => setDiaRecorrencia(Number(event.target.value))}
                    className={`rounded border px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-livre ${
                      erroDia ? 'border-alerta' : 'border-line'
                    }`}
                  />
                  {erroDia && <span className="text-xs text-alerta">{erroDia}</span>}
                  {!erroDia && diaRecorrencia > 28 && (
                    <span className="text-xs text-ink-soft">
                      Em meses mais curtos, será sugerido o último dia do mês.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-ink" htmlFor="total-parcelas">
                    Repetir por quantas vezes
                  </label>
                  <input
                    id="total-parcelas"
                    type="number"
                    min={1}
                    value={totalParcelas}
                    onChange={(event) =>
                      setTotalParcelas(event.target.value === '' ? '' : Number(event.target.value))
                    }
                    className={`rounded border px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-livre ${
                      erroParcelas ? 'border-alerta' : 'border-line'
                    }`}
                  />
                  {erroParcelas && <span className="text-xs text-alerta">{erroParcelas}</span>}
                  {!erroParcelas && (
                    <span className="text-xs text-ink-soft">
                      Deixe em branco para repetir indefinidamente. Ex.: uma compra parcelada em 4x
                      → 4.
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {ehTemplate && (
          <p className="text-xs text-ink-soft">
            As alterações valem para os próximos lançamentos. Lançamentos já feitos não mudam.
          </p>
        )}

        {erroGeral && <p className="text-sm text-alerta">{erroGeral}</p>}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando} disabled={enviando}>
            Salvar entrada
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default EntradaFormModal
