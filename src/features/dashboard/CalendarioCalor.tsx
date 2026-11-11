import { diaDaSemana, intensidadeNormalizada, maiorGastoDiario, type GastoDia } from '../../lib/indicadores'
import { formatarData } from '../../lib/date'
import { formatBRL } from '../../lib/money'
import { DIAS_SEMANA } from './formatos'
import { SemDados } from './Graficos'

/** Calendário de calor: uma coluna por semana (domingo a sábado), cor pela intensidade do gasto do dia. */
function CalendarioCalor({ dias }: { dias: GastoDia[] }) {
  const maior = maiorGastoDiario(dias)
  if (dias.length === 0 || maior === 0) return <SemDados />

  const vazios = diaDaSemana(dias[0].data)
  const celulas: (GastoDia | null)[] = [...Array<null>(vazios).fill(null), ...dias]
  const semanas: (GastoDia | null)[][] = []
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7))

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        <div className="flex flex-col gap-1 pr-1 text-[10px] leading-none text-ink-soft" aria-hidden>
          {DIAS_SEMANA.map((d) => (
            <span key={d} className="flex h-4 items-center">
              {d}
            </span>
          ))}
        </div>
        {semanas.map((semana, i) => (
          <div key={i} className="flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, k) => {
              const dia = semana[k]
              if (!dia) return <span key={k} className="h-4 w-4" />
              const intensidade = intensidadeNormalizada(dia.totalCentavos, maior) ?? 0
              return (
                <span
                  key={k}
                  className="h-4 w-4 rounded-sm bg-base"
                  title={`${formatarData(dia.data)}: ${formatBRL(dia.totalCentavos)}`}
                  style={
                    dia.totalCentavos > 0
                      ? { backgroundColor: 'var(--color-alerta)', opacity: 0.2 + (0.8 * intensidade) / 100 }
                      : undefined
                  }
                />
              )
            })}
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Mais escuro = mais gasto no dia (100% = {formatBRL(maior)}, o maior gasto diário do período). Passe o mouse ou toque no dia
        para ver o valor.
      </p>
    </div>
  )
}

export default CalendarioCalor
