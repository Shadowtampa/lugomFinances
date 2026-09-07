import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
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

    if (temErro) return

    setEnviando(true)

    const dados = { nome: nomeAparado, tipo, cor }
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

        <div className="mt-2 flex justify-end gap-2">
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
