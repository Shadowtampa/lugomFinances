// Só desenho: recebe séries já calculadas por src/lib/indicadores.ts.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBRL } from '../../lib/money'
import { percentual } from '../../lib/indicadores'

import { formatarPercentual, rotuloMes } from './formatos'

function abreviar(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
}

function dinheiroTooltip(valor: unknown): string {
  return formatBRL(Number(valor ?? 0))
}

const EIXO = { fontSize: 12, fill: 'var(--color-ink-soft)' }
const TOOLTIP = { borderRadius: 8, border: '1px solid var(--color-line)', fontSize: 13 }

export function SemDados({ texto = 'Sem lançamentos no período.' }: { texto?: string }) {
  return <p className="py-10 text-center text-sm text-ink-soft">{texto}</p>
}

export type PontoEntradasSaidas = { mes: string; entradas: number; saidas: number }

export function GraficoEntradasSaidas({ dados }: { dados: PontoEntradasSaidas[] }) {
  if (dados.every((d) => d.entradas === 0 && d.saidas === 0)) return <SemDados />
  const serie = dados.map((d) => ({ ...d, rotulo: rotuloMes(d.mes) }))
  return (
    <div className="w-full" role="img" aria-label="Entradas e Saídas por mês">
      <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} />
          <YAxis tick={EIXO} tickLine={false} axisLine={false} tickFormatter={abreviar} width={48} />
          <Tooltip formatter={dinheiroTooltip} contentStyle={TOOLTIP} cursor={{ fill: 'var(--color-base)' }} />
          <Bar dataKey="entradas" name="Entradas" fill="var(--color-livre)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="saidas" name="Saídas" fill="var(--color-alerta)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      </div>
      <Legenda itens={[{ nome: 'Entradas', cor: 'var(--color-livre)' }, { nome: 'Saídas', cor: 'var(--color-alerta)' }]} />
    </div>
  )
}

export function GraficoSaldo({ dados }: { dados: { mes: string; saldo: number }[] }) {
  if (dados.every((d) => d.saldo === 0)) return <SemDados />
  const serie = dados.map((d) => ({ ...d, rotulo: rotuloMes(d.mes) }))
  return (
    <div className="h-56 w-full" role="img" aria-label="Saldo operacional por mês">
      <ResponsiveContainer>
        <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} />
          <YAxis tick={EIXO} tickLine={false} axisLine={false} tickFormatter={abreviar} width={48} />
          <Tooltip formatter={dinheiroTooltip} contentStyle={TOOLTIP} />
          <Line dataKey="saldo" name="Saldo operacional" stroke="var(--color-restrita)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export type SerieLinha = { id: string; nome: string; cor: string; valores: number[] }

export function GraficoLinhas({ meses, series }: { meses: string[]; series: SerieLinha[] }) {
  if (series.length === 0 || series.every((s) => s.valores.every((v) => v === 0))) return <SemDados />
  const dados = meses.map((mes, i) => {
    const ponto: Record<string, string | number> = { rotulo: rotuloMes(mes) }
    for (const s of series) ponto[s.id] = s.valores[i] ?? 0
    return ponto
  })
  return (
    <div className="w-full" role="img" aria-label="Evolução mensal por Categoria">
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} />
            <YAxis tick={EIXO} tickLine={false} axisLine={false} tickFormatter={abreviar} width={48} />
            <Tooltip formatter={dinheiroTooltip} contentStyle={TOOLTIP} />
            {series.map((s) => (
              <Line key={s.id} dataKey={s.id} name={s.nome} stroke={s.cor} strokeWidth={2} dot={{ r: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legenda itens={series.map((s) => ({ nome: s.nome, cor: s.cor }))} />
    </div>
  )
}

export type Fatia = { id: string; nome: string; valor: number; cor: string }

/** Rosca + lista com valor e participação (a participação vem de indicadores.percentual). */
export function GraficoRosca({ fatias, rotulo }: { fatias: Fatia[]; rotulo: string }) {
  const total = fatias.reduce((acc, f) => acc + f.valor, 0)
  if (total <= 0) return <SemDados />
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0" role="img" aria-label={rotulo}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius="60%" outerRadius="100%" paddingAngle={1} stroke="none">
              {fatias.map((f) => (
                <Cell key={f.id} fill={f.cor} />
              ))}
            </Pie>
            <Tooltip formatter={dinheiroTooltip} contentStyle={TOOLTIP} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-full flex-col gap-1.5 text-sm">
        {fatias.map((f) => (
          <li key={f.id} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.cor }} />
            <span className="min-w-0 flex-1 truncate text-ink">{f.nome}</span>
            <span className="font-money text-ink-soft">{formatBRL(f.valor)}</span>
            <span className="w-12 text-right font-money text-ink-soft">{formatarPercentual(percentual(f.valor, total))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-soft">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.cor }} />
          {i.nome}
        </li>
      ))}
    </ul>
  )
}


export function GraficoBarrasSimples({
  dados,
  nome,
  cor,
}: {
  dados: { mes: string; valor: number }[]
  nome: string
  cor: string
}) {
  if (dados.every((d) => d.valor === 0)) return <SemDados texto="Sem dados no período." />
  const serie = dados.map((d) => ({ ...d, rotulo: rotuloMes(d.mes) }))
  return (
    <div className="h-56 w-full" role="img" aria-label={nome}>
      <ResponsiveContainer>
        <BarChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} />
          <YAxis tick={EIXO} tickLine={false} axisLine={false} tickFormatter={abreviar} width={48} />
          <Tooltip formatter={dinheiroTooltip} contentStyle={TOOLTIP} cursor={{ fill: 'var(--color-base)' }} />
          <Bar dataKey="valor" name={nome} fill={cor} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficoCompromissos({
  dados,
}: {
  dados: { mes: string; cartaoCentavos: number; planejamentoCentavos: number }[]
}) {
  if (dados.every((d) => d.cartaoCentavos === 0 && d.planejamentoCentavos === 0)) {
    return <SemDados texto="Nenhum compromisso futuro cadastrado." />
  }
  const serie = dados.map((d) => ({ ...d, rotulo: rotuloMes(d.mes) }))
  return (
    <div className="w-full" role="img" aria-label="Compromissos futuros por mês de vencimento">
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} />
            <YAxis tick={EIXO} tickLine={false} axisLine={false} tickFormatter={abreviar} width={48} />
            <Tooltip formatter={dinheiroTooltip} contentStyle={TOOLTIP} cursor={{ fill: 'var(--color-base)' }} />
            <Bar dataKey="cartaoCentavos" name="Parcelas no cartão" stackId="c" fill="var(--color-restrita)" />
            <Bar dataKey="planejamentoCentavos" name="Planejamentos parcelados" stackId="c" fill="var(--color-aviso)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legenda
        itens={[
          { nome: 'Parcelas no cartão', cor: 'var(--color-restrita)' },
          { nome: 'Planejamentos parcelados', cor: 'var(--color-aviso)' },
        ]}
      />
    </div>
  )
}

/** Linha simples; `valor` nulo deixa um buraco na linha (mês sem dado). */
export function GraficoLinhaSimples({
  dados,
  nome,
  cor,
}: {
  dados: { rotulo: string; valor: number | null }[]
  nome: string
  cor: string
}) {
  if (dados.every((d) => d.valor === null || d.valor === 0)) return <SemDados />
  return (
    <div className="h-56 w-full" role="img" aria-label={nome}>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={EIXO} tickLine={false} axisLine={false} tickFormatter={abreviar} width={48} />
          <Tooltip formatter={dinheiroTooltip} contentStyle={TOOLTIP} />
          <Line dataKey="valor" name={nome} stroke={cor} strokeWidth={2} dot={dados.length <= 31 ? { r: 2 } : false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barras com rótulo livre no eixo (dia da semana, mês...). */
export function GraficoBarrasRotulos({
  dados,
  nome,
  cor,
}: {
  dados: { rotulo: string; valor: number }[]
  nome: string
  cor: string
}) {
  if (dados.every((d) => d.valor === 0)) return <SemDados />
  return (
    <div className="h-56 w-full" role="img" aria-label={nome}>
      <ResponsiveContainer>
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} />
          <YAxis tick={EIXO} tickLine={false} axisLine={false} tickFormatter={abreviar} width={48} />
          <Tooltip formatter={dinheiroTooltip} contentStyle={TOOLTIP} cursor={{ fill: 'var(--color-base)' }} />
          <Bar dataKey="valor" name={nome} fill={cor} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
