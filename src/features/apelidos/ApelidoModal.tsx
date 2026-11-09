import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { mensagemDoErro } from '../../lib/erros'
import { definirApelido, removerApelido } from '../../services/apelidos'

export type AlvoApelido = {
  chave: string
  apelidoAtual: string | null
  /** Descrição original da Pluggy, para o usuário reconhecer o estabelecimento. */
  descricao?: string | null
}

/** Cria, troca ou remove o apelido de um estabelecimento (M22). */
function ApelidoModal({
  alvo,
  onFechar,
  onSalvo,
}: {
  alvo: AlvoApelido
  onFechar(): void
  onSalvo(mensagem: string): void
}) {
  const [apelido, setApelido] = useState(alvo.apelidoAtual ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setErro(null)
    setEnviando(true)
    try {
      await acao()
      onSalvo(mensagem)
    } catch (e) {
      setErro(mensagemDoErro(e))
    } finally {
      setEnviando(false)
    }
  }

  function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const limpo = apelido.trim()
    if (!limpo) return setErro('Informe o apelido.')
    void executar(() => definirApelido(alvo.chave, limpo), 'Apelido salvo.')
  }

  return (
    <Modal open onClose={onFechar} title={alvo.apelidoAtual ? 'Editar apelido' : 'Dar apelido'}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        {alvo.descricao && <p className="break-words text-sm text-ink-soft">{alvo.descricao}</p>}
        <Input
          label="Apelido do estabelecimento"
          value={apelido}
          maxLength={60}
          autoFocus
          onChange={(e) => setApelido(e.target.value)}
          hint={`Vale para todo lançamento da Pluggy com a chave "${alvo.chave}". Não muda categoria nem fonte.`}
        />
        {erro && <p className="text-sm text-alerta">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {alvo.apelidoAtual && (
            <Button
              type="button"
              variant="danger"
              disabled={enviando}
              onClick={() => void executar(() => removerApelido(alvo.chave), 'Apelido removido.')}
            >
              Remover
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando} disabled={enviando}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ApelidoModal
