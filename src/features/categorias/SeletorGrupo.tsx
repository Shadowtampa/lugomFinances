import { useId } from 'react'
import type { GrupoOrcamentario } from '../../types/domain'
import { GRUPOS, ROTULOS_GRUPO } from '../orcamento/adesao'

interface SeletorGrupoProps {
  categoriaNome: string
  grupo: GrupoOrcamentario | null
  disabled?: boolean
  onChange(grupo: GrupoOrcamentario | null): void
}

function SeletorGrupo({ categoriaNome, grupo, disabled, onChange }: SeletorGrupoProps) {
  const id = useId()

  return (
    <>
      <label htmlFor={id} className="sr-only">
        Grupo 50-15-35 de {categoriaNome}
      </label>
      <select
        id={id}
        value={grupo ?? ''}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : (event.target.value as GrupoOrcamentario))
        }
        className={`rounded border border-line bg-surface px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-livre disabled:opacity-50 ${
          grupo ? 'text-ink' : 'text-ink-soft'
        }`}
      >
        <option value="">Não classificada</option>
        {GRUPOS.map((g) => (
          <option key={g} value={g}>
            {ROTULOS_GRUPO[g]}
          </option>
        ))}
      </select>
    </>
  )
}

export default SeletorGrupo
