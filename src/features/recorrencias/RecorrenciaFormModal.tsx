import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import MoneyInput from '../../components/ui/MoneyInput'
import Select from '../../components/ui/Select'
import { mesAtual } from '../../lib/date'
import { mensagemDoErro } from '../../lib/erros'
import { atualizarRecorrencia, criarRecorrencia } from '../../services/recorrencias'
import type { Categoria, Recorrencia } from '../../types/domain'

interface RecorrenciaFormModalProps {
  aberto: boolean
  recorrencia?: Recorrencia
  categorias: Pick<Categoria, 'id' | 'nome'>[]
  onFechar(): void
  onSalvo(): void
}

function RecorrenciaFormModal({
  aberto,
  recorrencia,
  categorias,
  onFechar,
  onSalvo,
}: RecorrenciaFormModalProps) {
  const [titulo, setTitulo] = useState(recorrencia?.titulo ?? '')
  const [valorCentavos, setValorCentavos] = useState(recorrencia?.valorPrevistoCentavos ?? 0)
  const [dia, setDia] = useState<number | ''>(recorrencia?.dia ?? '')
  const [categoriaId, setCategoriaId] = useState(recorrencia?.categoriaId ?? '')
  const [totalParcelas, setTotalParcelas] = useState<number | ''>(recorrencia?.totalParcelas ?? '')
  const [mesInicio, setMesInicio] = useState(recorrencia?.mesInicio ?? mesAtual())
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const novosErros: Record<string, string> = {}
    const tituloAparado = titulo.trim()
    if (tituloAparado.length < 1 || tituloAparado.length > 60)
      novosErros.titulo = 'Título deve ter entre 1 e 60 caracteres.'
    if (valorCentavos <= 0) novosErros.valor = 'Valor deve ser maior que zero.'
    if (dia === '' || !Number.isInteger(dia) || dia < 1 || dia > 31)
      novosErros.dia = 'Dia deve estar entre 1 e 31.'
    if (totalParcelas !== '' && (!Number.isInteger(totalParcelas) || totalParcelas < 1))
      novosErros.parcelas = 'Parcelas deve ser um inteiro maior que zero.'
    if (!/^\d{4}-\d{2}$/.test(mesInicio)) novosErros.mesInicio = 'Selecione o mês de início.'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    const dados = {
      titulo: tituloAparado,
      valorPrevistoCentavos: valorCentavos,
      dia: dia as number,
      categoriaId: categoriaId || null,
      totalParcelas: totalParcelas === '' ? null : totalParcelas,
      mesInicio,
    }

    setEnviando(true)
    setErroGeral(null)
    try {
      if (recorrencia) {
        await atualizarRecorrencia(recorrencia.id, dados)
      } else {
        await criarRecorrencia({ ...dados, ativa: true })
      }
      onSalvo()
    } catch (e) {
      setErroGeral(mensagemDoErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open={aberto} onClose={onFechar} title={recorrencia ? 'Editar recorrência' : 'Nova recorrência'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Título"
          value={titulo}
          onChange={(event) => setTitulo(event.target.value)}
          error={erros.titulo}
          maxLength={60}
          required
        />
        <MoneyInput
          label="Valor previsto"
          value={valorCentavos}
          onChange={setValorCentavos}
          error={erros.valor}
        />
        <Input
          label="Dia do vencimento"
          type="number"
          min={1}
          max={31}
          value={dia}
          onChange={(event) => setDia(event.target.value === '' ? '' : Number(event.target.value))}
          error={erros.dia}
          hint={typeof dia === 'number' && dia > 28 ? 'Em meses mais curtos, vale o último dia do mês.' : undefined}
          required
        />
        <Select
          label="Categoria (opcional)"
          value={categoriaId}
          onChange={(event) => setCategoriaId(event.target.value)}
        >
          <option value="">Sem categoria</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </Select>
        <Input
          label="Número de parcelas (opcional)"
          type="number"
          min={1}
          value={totalParcelas}
          onChange={(event) =>
            setTotalParcelas(event.target.value === '' ? '' : Number(event.target.value))
          }
          error={erros.parcelas}
          hint="Deixe em branco para uma conta sem fim (ex.: internet)."
        />
        <Input
          label="Mês de início"
          type="month"
          value={mesInicio}
          onChange={(event) => setMesInicio(event.target.value)}
          error={erros.mesInicio}
          hint={totalParcelas !== '' ? 'Mês da 1ª parcela.' : undefined}
          required
        />

        {erroGeral && <p className="text-sm text-alerta">{erroGeral}</p>}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando} disabled={enviando}>
            Salvar recorrência
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default RecorrenciaFormModal
