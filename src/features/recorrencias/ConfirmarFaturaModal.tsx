import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import MoneyInput from '../../components/ui/MoneyInput'
import Select from '../../components/ui/Select'
import { usePainelSaldo } from '../../contexts/PainelSaldoContext'
import { mensagemDoErro } from '../../lib/erros'
import { formatBRL } from '../../lib/money'
import { confirmarFaturaCartao } from '../../services/recorrencias'
import type { RecorrenciaPendente } from '../../types/domain'
import type { FonteComSaldo } from '../saidas/elegibilidade'

interface ConfirmarFaturaModalProps {
  aberto: boolean
  pendencia?: RecorrenciaPendente
  cartao?: FonteComSaldo
  fontesPagadoras: FonteComSaldo[]
  onFechar(): void
  onSalvo(): void
}

function hojeISO(): string {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dia = String(hoje.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function ConfirmarFaturaModal({
  aberto,
  pendencia,
  cartao,
  fontesPagadoras,
  onFechar,
  onSalvo,
}: ConfirmarFaturaModalProps) {
  const { mostrarPainelSaldo } = usePainelSaldo()

  const [fontePagadoraId, setFontePagadoraId] = useState(fontesPagadoras[0]?.id ?? '')
  const [valorCentavos, setValorCentavos] = useState(pendencia?.valorSugeridoCentavos ?? 0)
  const [data, setData] = useState(hojeISO())
  const [erroFonte, setErroFonte] = useState<string | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pendencia || !cartao) return

    if (!fontePagadoraId) {
      setErroFonte('Selecione uma fonte pagadora.')
      return
    }
    setErroFonte(null)
    setErroGeral(null)
    setEnviando(true)

    try {
      const resultado = await confirmarFaturaCartao(cartao.id, fontePagadoraId, valorCentavos, data)
      const cores = new Map(
        [cartao, ...fontesPagadoras].map((f) => [f.id, f.cor] as const),
      )
      mostrarPainelSaldo({
        titulo: `Fatura de ${cartao.nome} paga`,
        fontes: resultado.fontes.map((fonte) => ({
          rotulo: fonte.nome,
          cor: cores.get(fonte.fonteId) ?? '#71717A',
          valorCentavos: fonte.saldoCentavos,
        })),
        categoria: resultado.categoria
          ? {
              rotulo: resultado.categoria.nome,
              cor: '#71717A',
              valorCentavos: resultado.categoria.gastoMesAtualCentavos,
              sufixo: 'gastos neste mês',
            }
          : undefined,
      })
      onSalvo()
      onFechar()
    } catch (e) {
      setErroGeral(mensagemDoErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open={aberto} onClose={onFechar} title="Pagar fatura">
      {pendencia && cartao && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            {cartao.nome}: dívida atual de{' '}
            <span className="font-money">{formatBRL(pendencia.valorSugeridoCentavos)}</span>.
          </p>

          <Select
            label="Pagar com"
            value={fontePagadoraId}
            onChange={(event) => setFontePagadoraId(event.target.value)}
            error={erroFonte ?? undefined}
          >
            <option value="">Selecione</option>
            {fontesPagadoras.map((fonte) => (
              <option key={fonte.id} value={fonte.id}>
                {fonte.nome}
              </option>
            ))}
          </Select>

          <MoneyInput label="Valor" value={valorCentavos} onChange={setValorCentavos} />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-ink" htmlFor="data-fatura">
              Data
            </label>
            <input
              id="data-fatura"
              type="date"
              value={data}
              onChange={(event) => setData(event.target.value)}
              className="rounded border border-line px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-livre"
              required
            />
          </div>

          {erroGeral && <p className="text-sm text-alerta">{erroGeral}</p>}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" loading={enviando} disabled={enviando}>
              Confirmar pagamento
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export default ConfirmarFaturaModal
