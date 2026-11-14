import { Link } from 'react-router'
import type { AdesaoMetodo } from '../../types/domain'
import { ROTULOS_GRUPO, avaliarAdesao } from './adesao'

function CardAdesao({ adesao }: { adesao: AdesaoMetodo }) {
  const avaliacoes = avaliarAdesao(adesao)

  return (
    <Link
      to="/orcamento"
      className="flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-surface p-3 text-sm"
    >
      <span className="text-ink">Método 50-15-35</span>
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {avaliacoes.map((a) => (
          <span key={a.grupo} className="text-ink-soft">
            {ROTULOS_GRUPO[a.grupo]}{' '}
            <span className={`font-money font-medium ${a.alerta ? 'text-alerta' : 'text-ink'}`}>
              {a.percentual}%
            </span>
            <span className="text-xs">/{a.meta}%</span>
          </span>
        ))}
      </span>
    </Link>
  )
}

export default CardAdesao
