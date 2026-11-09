import type { Fonte } from '../../types/domain'

/**
 * Meio de pagamento previsto (M27): uma ou mais Fontes, só autocontrole.
 * Mostra as Fontes ativas e as arquivadas que já estavam selecionadas.
 */
function FontesPrevistasSelect({
  fontes,
  selecionadas,
  onChange,
  avisos,
}: {
  fontes: Fonte[]
  selecionadas: string[]
  onChange(ids: string[]): void
  avisos: string[]
}) {
  const visiveis = fontes.filter((f) => !f.arquivada || selecionadas.includes(f.id))

  function alternar(id: string) {
    onChange(selecionadas.includes(id) ? selecionadas.filter((s) => s !== id) : [...selecionadas, id])
  }

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium text-ink">
        Meio de pagamento previsto <span className="font-normal text-ink-soft">(opcional)</span>
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1 rounded border border-line p-2">
        {visiveis.length === 0 && <p className="text-sm text-ink-soft">Nenhuma fonte cadastrada.</p>}
        {visiveis.map((fonte) => (
          <label key={fonte.id} className="flex items-center gap-2 py-1 text-sm text-ink">
            <input
              type="checkbox"
              checked={selecionadas.includes(fonte.id)}
              onChange={() => alternar(fonte.id)}
              className="accent-livre"
            />
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: fonte.cor }} aria-hidden="true" />
            {fonte.nome}
            {fonte.arquivada && <span className="text-xs text-ink-soft">(arquivada)</span>}
          </label>
        ))}
      </div>
      <span className="text-xs text-ink-soft">Só para controle: não lança nada nem reserva saldo.</span>
      {avisos.map((aviso) => (
        <span key={aviso} className="text-xs text-aviso">
          {aviso}
        </span>
      ))}
    </fieldset>
  )
}

export default FontesPrevistasSelect
