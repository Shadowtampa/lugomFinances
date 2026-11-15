import { formatBRL } from '../../lib/money'
import { type AvaliacaoGrupo, LEGENDAS_GRUPO, ROTULOS_GRUPO } from './adesao'

// Régua em % da renda do mês: vai até 100%, ou até o percentual se gastou mais que
// a renda — assim o marcador da meta fica sempre visível na mesma escala.
function BarraMeta({ avaliacao }: { avaliacao: AvaliacaoGrupo }) {
  const { grupo, percentual, meta, alerta, texto, gastoCentavos } = avaliacao
  const escala = Math.max(100, percentual)

  return (
    <div className="border-b border-line py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{ROTULOS_GRUPO[grupo]}</p>
          <p className="text-xs text-ink-soft">{LEGENDAS_GRUPO[grupo]}</p>
        </div>
        <p className="shrink-0 text-sm text-ink-soft">
          <span className={`font-money font-medium ${alerta ? 'text-alerta' : 'text-ink'}`}>
            {percentual}%
          </span>{' '}
          de meta {meta}%
        </p>
      </div>

      <div
        className="relative mt-2 h-2 w-full rounded-full bg-line"
        role="meter"
        aria-label={`${ROTULOS_GRUPO[grupo]}: ${percentual}% da renda, meta ${meta}%`}
        aria-valuenow={percentual}
        aria-valuemin={0}
        aria-valuemax={escala}
      >
        <div
          className={`h-full rounded-full ${alerta ? 'bg-alerta' : 'bg-livre'}`}
          style={{ width: `${(percentual / escala) * 100}%` }}
        />
        <div
          className="absolute -top-1 h-4 w-0.5 bg-ink"
          style={{ left: `${(meta / escala) * 100}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-1 flex justify-between gap-3 text-xs">
        <span className={alerta ? 'text-alerta' : 'text-ink-soft'}>{texto}</span>
        <span className="font-money text-ink-soft">{formatBRL(gastoCentavos)}</span>
      </div>
    </div>
  )
}

export default BarraMeta
