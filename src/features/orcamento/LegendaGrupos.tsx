import { GRUPOS, LEGENDAS_GRUPO, METAS, ROTULOS_GRUPO } from './adesao'

function LegendaGrupos() {
  return (
    <ul className="mb-4 flex flex-col gap-1 rounded border border-line bg-surface p-3 text-sm text-ink-soft">
      {GRUPOS.map((grupo) => (
        <li key={grupo}>
          <span className="font-money font-medium text-ink">{METAS[grupo]}%</span>{' '}
          <span className="font-medium text-ink">{ROTULOS_GRUPO[grupo]}</span>:{' '}
          {LEGENDAS_GRUPO[grupo]}.
        </li>
      ))}
    </ul>
  )
}

export default LegendaGrupos
