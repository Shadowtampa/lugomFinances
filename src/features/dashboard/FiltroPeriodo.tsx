import { formatarData } from '../../lib/date'
import { PRESETS_PERIODO, ROTULOS_PRESET, type Periodo, type PresetPeriodo } from '../../lib/indicadores'

const CAMPO = 'rounded border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-livre'

interface FiltroPeriodoProps {
  preset: PresetPeriodo
  periodo: Periodo
  anterior: Periodo
  onPreset(preset: PresetPeriodo): void
  onCustom(de: string, ate: string): void
}

function FiltroPeriodo({ preset, periodo, anterior, onPreset, onCustom }: FiltroPeriodoProps) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Período
          <select
            className={CAMPO}
            value={preset}
            onChange={(e) => onPreset(e.target.value as PresetPeriodo)}
          >
            {PRESETS_PERIODO.map((p) => (
              <option key={p} value={p}>
                {ROTULOS_PRESET[p]}
              </option>
            ))}
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              De
              <input
                type="date"
                className={CAMPO}
                value={periodo.de}
                max={periodo.ate}
                onChange={(e) => e.target.value && onCustom(e.target.value, periodo.ate)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Até
              <input
                type="date"
                className={CAMPO}
                value={periodo.ate}
                min={periodo.de}
                onChange={(e) => e.target.value && onCustom(periodo.de, e.target.value)}
              />
            </label>
          </>
        )}
      </div>
      <p className="text-xs text-ink-soft">
        {formatarData(periodo.de)} a {formatarData(periodo.ate)} · comparado com {formatarData(anterior.de)} a{' '}
        {formatarData(anterior.ate)}
      </p>
    </div>
  )
}

export default FiltroPeriodo
