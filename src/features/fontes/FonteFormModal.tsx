import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import MoneyInput from '../../components/ui/MoneyInput'
import Spinner from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { useAsync } from '../../hooks/useAsync'
import type { ApiError } from '../../lib/erros'
import { mensagemDoErro } from '../../lib/erros'
import { corAleatoria, CORES_CATEGORIA } from '../categorias/cores'
import { listarCategorias } from '../../services/categorias'
import { atualizarFonte, criarFonte } from '../../services/fontes'
import type { Fonte, FonteTipo } from '../../types/domain'
import CategoriaMultiSelect from './CategoriaMultiSelect'

interface FonteFormModalProps {
  aberto: boolean
  fonte?: Fonte
  onFechar(): void
  onSalvo(): void
}

function FonteFormModal({ aberto, fonte, onFechar, onSalvo }: FonteFormModalProps) {
  const { showToast } = useToast()
  const categorias = useAsync(listarCategorias, [])

  const [nome, setNome] = useState(fonte?.nome ?? '')
  const [erroNome, setErroNome] = useState<string | null>(null)
  const [tipo, setTipo] = useState<FonteTipo>(fonte?.tipo ?? 'livre')
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<string[]>(
    fonte?.categoriasPermitidas ?? [],
  )
  const [erroCategorias, setErroCategorias] = useState<string | null>(null)
  const [cor, setCor] = useState(fonte?.cor ?? corAleatoria())
  const [ehCartao, setEhCartao] = useState(fonte?.ehCartao ?? false)
  const [limiteCentavos, setLimiteCentavos] = useState(fonte?.limiteCentavos ?? 0)
  const [diaFatura, setDiaFatura] = useState(fonte?.diaFatura ?? 1)
  const [erroLimite, setErroLimite] = useState<string | null>(null)
  const [erroDiaFatura, setErroDiaFatura] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const tipoOriginal = fonte?.tipo
  const mudandoParaLivre = tipoOriginal === 'restrita' && tipo === 'livre'

  function handleMudarTipo(novoTipo: FonteTipo) {
    setTipo(novoTipo)
    setErroCategorias(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nomeAparado = nome.trim()

    let temErro = false
    if (nomeAparado.length < 1 || nomeAparado.length > 40) {
      setErroNome('Nome deve ter entre 1 e 40 caracteres.')
      temErro = true
    } else {
      setErroNome(null)
    }

    if (tipo === 'restrita' && categoriasPermitidas.length === 0) {
      setErroCategorias('Selecione pelo menos uma categoria.')
      temErro = true
    } else {
      setErroCategorias(null)
    }

    if (ehCartao && limiteCentavos <= 0) {
      setErroLimite('Limite deve ser maior que zero.')
      temErro = true
    } else {
      setErroLimite(null)
    }

    if (ehCartao && (diaFatura < 1 || diaFatura > 31)) {
      setErroDiaFatura('Dia deve estar entre 1 e 31.')
      temErro = true
    } else {
      setErroDiaFatura(null)
    }

    if (temErro) return

    setEnviando(true)

    const dados = {
      nome: nomeAparado,
      tipo,
      cor,
      ehCartao,
      limiteCentavos: ehCartao ? limiteCentavos : null,
      diaFatura: ehCartao ? diaFatura : null,
    }
    const categoriasParaEnviar = tipo === 'restrita' ? categoriasPermitidas : []

    try {
      if (fonte) {
        await atualizarFonte(fonte.id, dados, categoriasParaEnviar)
        showToast('Fonte atualizada.', 'success')
      } else {
        await criarFonte(dados, categoriasParaEnviar)
        showToast('Fonte criada.', 'success')
      }
      onSalvo()
      onFechar()
    } catch (e) {
      const erro = e as ApiError
      if (erro.codigo === 'DUPLICADO') {
        setErroNome('Já existe uma fonte com esse nome.')
      } else {
        showToast(mensagemDoErro(e), 'error')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open={aberto} onClose={onFechar} title={fonte ? 'Editar fonte' : 'Nova fonte'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          error={erroNome ?? undefined}
          maxLength={40}
          required
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">Tipo</span>
          <label className="flex items-start gap-2 rounded border border-line p-2 text-sm text-ink">
            <input
              type="radio"
              name="tipo"
              checked={tipo === 'livre'}
              onChange={() => handleMudarTipo('livre')}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Livre</span> — pode pagar qualquer categoria de gasto.
            </span>
          </label>
          <label className="flex items-start gap-2 rounded border border-line p-2 text-sm text-ink">
            <input
              type="radio"
              name="tipo"
              checked={tipo === 'restrita'}
              onChange={() => handleMudarTipo('restrita')}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Restrita</span> — só pode pagar as categorias que você
              escolher. Use para vale-refeição, vale-alimentação e afins.
            </span>
          </label>
        </div>

        {tipo === 'restrita' && (
          <div className="animate-expandir">
            {categorias.isLoading && <Spinner />}
            {categorias.data && (
              <CategoriaMultiSelect
                categorias={categorias.data}
                selecionadas={categoriasPermitidas}
                onChange={setCategoriasPermitidas}
                error={erroCategorias ?? undefined}
              />
            )}
          </div>
        )}

        {mudandoParaLivre && (
          <p className="text-xs text-alerta">As restrições de categoria serão removidas.</p>
        )}

        {fonte?.tipo === 'restrita' && tipo === 'restrita' && (
          <p className="text-xs text-ink-soft">Lançamentos já registrados não são alterados.</p>
        )}

        <label className="flex items-start gap-2 rounded border border-line p-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={ehCartao}
            onChange={(event) => setEhCartao(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">É um cartão de crédito</span> — sem saldo próprio, tem
            limite e um dia de fatura.
          </span>
        </label>

        {ehCartao && (
          <div className="animate-expandir flex flex-col gap-4">
            <MoneyInput
              label="Limite"
              value={limiteCentavos}
              onChange={setLimiteCentavos}
              error={erroLimite ?? undefined}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink" htmlFor="dia-fatura">
                Dia da fatura
              </label>
              <input
                id="dia-fatura"
                type="number"
                min={1}
                max={31}
                value={diaFatura}
                onChange={(event) => setDiaFatura(Number(event.target.value))}
                className={`rounded border px-3 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-livre ${
                  erroDiaFatura ? 'border-alerta' : 'border-line'
                }`}
              />
              {erroDiaFatura && <span className="text-xs text-alerta">{erroDiaFatura}</span>}
            </div>
          </div>
        )}

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

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando} disabled={enviando}>
            Salvar fonte
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default FonteFormModal
