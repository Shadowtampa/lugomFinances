import { useState } from 'react'
import type { Categoria } from '../../types/domain'

interface CategoriaMultiSelectProps {
  categorias: Categoria[]
  selecionadas: string[]
  onChange(ids: string[]): void
  error?: string
}

function CategoriaMultiSelect({
  categorias,
  selecionadas,
  onChange,
  error,
}: CategoriaMultiSelectProps) {
  const [busca, setBusca] = useState('')

  const visiveis = busca.trim()
    ? categorias.filter((c) => c.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : categorias

  function alternar(id: string) {
    if (selecionadas.includes(id)) {
      onChange(selecionadas.filter((s) => s !== id))
    } else {
      onChange([...selecionadas, id])
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">Categorias permitidas</span>

      {categorias.length > 10 && (
        <input
          type="text"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar categoria..."
          className="rounded border border-line px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-livre"
        />
      )}

      <div
        className={`flex max-h-48 flex-col gap-1 overflow-y-auto rounded border p-2 ${
          error ? 'border-alerta' : 'border-line'
        }`}
      >
        {visiveis.length === 0 && (
          <p className="py-2 text-center text-sm text-ink-soft">Nenhuma categoria encontrada.</p>
        )}
        {visiveis.map((categoria) => (
          <label
            key={categoria.id}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-ink hover:bg-base"
          >
            <input
              type="checkbox"
              checked={selecionadas.includes(categoria.id)}
              onChange={() => alternar(categoria.id)}
            />
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: categoria.cor }}
            />
            {categoria.nome}
          </label>
        ))}
      </div>

      {error && <span className="text-xs text-alerta">{error}</span>}
    </div>
  )
}

export default CategoriaMultiSelect
