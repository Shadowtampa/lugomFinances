import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../components/ui/Button'
import { dataLocalISO, formatarData } from '../../lib/date'
import { mensagemDoErro } from '../../lib/erros'
import { avisosIntegracao } from '../../lib/integracao'
import type { StatusIntegracao } from '../../types/domain'

interface Props {
  status: StatusIntegracao | null | undefined
  onSincronizar(): Promise<void>
  agora?: Date
}

/** M20 — substitui o aviso de "dados desatualizados" do M18. */
function AvisoIntegracao({ status, onSincronizar, agora }: Props) {
  const [sincronizando, setSincronizando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const avisos = avisosIntegracao(status ?? null, agora)
  if (avisos.length === 0) return null

  async function tentar() {
    setSincronizando(true)
    setErro(null)
    try {
      await onSincronizar()
    } catch (e) {
      setErro(mensagemDoErro(e))
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div
      role="alert"
      className="mb-6 flex flex-col gap-2 rounded border border-aviso/40 bg-aviso/10 p-3 text-sm text-aviso"
    >
      {avisos.map((aviso) => (
        <p key={aviso.tipo} className="flex items-start gap-2">
          <span aria-hidden="true">⚠</span>
          <span>
            {aviso.tipo === 'reconectar' && (
              <>
                Reconecte {aviso.nomes.join(' e ')} no Meu Pluggy.{' '}
                <Link to="/conexoes" className="underline">
                  Ver conexões
                </Link>
              </>
            )}
            {aviso.tipo === 'falhou' && (
              <>
                A última sincronização falhou em {formatarData(dataLocalISO(aviso.em))} ({aviso.motivo}).
              </>
            )}
            {aviso.tipo === 'parado' &&
              (aviso.dias === null ? (
                <>Nenhuma sincronização com a Pluggy concluiu ainda.</>
              ) : (
                <>
                  Faz <strong>{aviso.dias}</strong> dias que a sincronização não roda. Tá tudo certo aí
                  com as tuas finanças?
                </>
              ))}
          </span>
        </p>
      ))}
      {avisos.some((a) => a.tipo !== 'reconectar') && (
        <div className="flex items-center gap-3">
          <Button variant="secondary" loading={sincronizando} disabled={sincronizando} onClick={tentar}>
            Tentar de novo
          </Button>
          {erro && <span className="text-alerta">{erro}</span>}
        </div>
      )}
    </div>
  )
}

export default AvisoIntegracao
