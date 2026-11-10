import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { hojeISO } from '../../lib/date'
import {
  ehPreset,
  periodoAnterior,
  resolverPeriodo,
  type Periodo,
  type PresetPeriodo,
} from '../../lib/indicadores'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Filtro de período do Dashboard analítico, guardado na URL (?periodo=3m ou ?periodo=custom&de=…&ate=…). */
export function usePeriodo(): {
  preset: PresetPeriodo
  periodo: Periodo
  anterior: Periodo
  hoje: string
  definirPreset(preset: PresetPeriodo): void
  definirCustom(de: string, ate: string): void
} {
  const [params, setParams] = useSearchParams()
  const hoje = hojeISO()

  const presetParam = params.get('periodo')
  const preset: PresetPeriodo = ehPreset(presetParam) ? presetParam : 'mes'
  const deParam = params.get('de')
  const ateParam = params.get('ate')
  const customValido = Boolean(deParam && ateParam && ISO.test(deParam) && ISO.test(ateParam))
  const customDe = customValido ? deParam : null
  const customAte = customValido ? ateParam : null

  const periodo = useMemo(
    () => resolverPeriodo(preset, hoje, customDe && customAte ? { de: customDe, ate: customAte } : undefined),
    [preset, hoje, customDe, customAte],
  )
  const anterior = useMemo(() => periodoAnterior(periodo, preset), [periodo, preset])

  const definirPreset = useCallback(
    (novo: PresetPeriodo) => {
      const next = new URLSearchParams(params)
      if (novo === 'mes') next.delete('periodo')
      else next.set('periodo', novo)
      if (novo === 'custom') {
        // Começa pelo período que já estava na tela.
        next.set('de', periodo.de)
        next.set('ate', periodo.ate)
      } else {
        next.delete('de')
        next.delete('ate')
      }
      setParams(next, { replace: true })
    },
    [params, setParams, periodo],
  )

  const definirCustom = useCallback(
    (de: string, ate: string) => {
      if (!ISO.test(de) || !ISO.test(ate)) return
      const next = new URLSearchParams(params)
      next.set('periodo', 'custom')
      next.set('de', de)
      next.set('ate', ate)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  return { preset, periodo, anterior, hoje, definirPreset, definirCustom }
}
