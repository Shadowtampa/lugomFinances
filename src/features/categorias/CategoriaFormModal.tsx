import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import MoneyInput from '../../components/ui/MoneyInput'
import { useToast } from '../../components/ui/Toast'
import { mesAtual, primeiroDiaDoMes } from '../../lib/date'
import type { ApiError } from '../../lib/erros'
import { mensagemDoErro } from '../../lib/erros'
import { atualizarCategoria, criarCategoria } from '../../services/categorias'
import type { Categoria } from '../../types/domain'
import { corAleatoria, CORES_CATEGORIA } from './cores'

interface CategoriaFormModalProps {
  aberto: boolean
  categoria?: Categoria
  onFechar(): void
  onSalvo(): void
}

function CategoriaFormModal({ aberto, categoria, onFechar, onSalvo }: CategoriaFormModalProps) {
  const { showToast } = useToast()
  const [nome, setNome] = useState(categoria?.nome ?? '')
  const [erroNome, setErroNome] = useState<string | null>(null)
  const [definirLimite, setDefinirLimite] = useState(categoria?.limiteMensalCentavos !== undefined && categoria.limiteMensalCentavos !== null)
  const [limiteMensalCentavos, setLimiteMensalCentavos] = useState(categoria?.limiteMensalCentavos ?? 0)
  const [cor, setCor] = useState(categoria?.cor ?? corAleatoria())
  const [vigenciaInicio, setVigenciaInicio] = useState(categoria?.vigenciaInicio.slice(0, 7) ?? mesAtual())
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nomeAparado = nome.trim()

    if (nomeAparado.length < 1 || nomeAparado.length > 40) {
      setErroNome('Nome deve ter entre 1 e 40 caracteres.')
      return
    }

    setErroNome(null)
    setEnviando(true)

    const dados = {
      nome: nomeAparado,
      limiteMensalCentavos: definirLimite ? limiteMensalCentavos : null,
      vigenciaInicio: primeiroDiaDoMes(vigenciaInicio),
      cor,
    }

    try {
      if (categoria) {
        await atualizarCategoria(categoria.id, dados)
        showToast('Categoria atualizada.', 'success')
      } else {
        await criarCategoria(dados)
        showToast('Categoria criada.', 'success')
      }
      onSalvo()
      onFechar()
    } catch (e) {
      const erro = e as ApiError
      if (erro.codigo === 'DUPLICADO') {
        setErroNome('Já existe uma categoria com esse nome.')
      } else {
        showToast(mensagemDoErro(e), 'error')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title={categoria ? 'Editar categoria' : 'Nova categoria'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          error={erroNome ?? undefined}
          maxLength={40}
          required
        />

        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={definirLimite}
              onChange={(event) => setDefinirLimite(event.target.checked)}
            />
            Definir limite mensal
          </label>
          {definirLimite && (
            <MoneyInput
              label="Limite mensal"
              value={limiteMensalCentavos}
              onChange={setLimiteMensalCentavos}
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Cor</span>
          <div className="flex flex-wrap gap-2">
            {CORES_CATEGORIA.map((corOpcao) => (
              <button
                key={corOpcao}
                type="button"
                aria-pressed={cor === corOpcao}
                aria-label={`Cor ${corOpcao}`}
                onClick={() => setCor(corOpcao)}
                className={`h-7 w-7 rounded-full border-2 ${
                  cor === corOpcao ? 'border-ink' : 'border-transparent'
                }`}
                style={{ backgroundColor: corOpcao }}
              />
            ))}
          </div>
        </div>

        {categoria && (
          <p className="text-xs text-ink-soft">
            Alterar o limite recalcula o saldo acumulado desde o início da vigência.
          </p>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-ink-soft">Opções avançadas</summary>
          <div className="mt-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-ink" htmlFor="vigencia-inicio">
              Início da vigência
            </label>
            <input
              id="vigencia-inicio"
              type="month"
              value={vigenciaInicio}
              onChange={(event) => setVigenciaInicio(event.target.value)}
              className="rounded border border-line px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-livre"
            />
            <p className="text-xs text-ink-soft">
              O limite acumula a partir deste mês. Se você define R$ 300 com início em
              julho e estamos em setembro, você tem R$ 900 acumulados.
            </p>
          </div>
        </details>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando} disabled={enviando}>
            Salvar categoria
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CategoriaFormModal
