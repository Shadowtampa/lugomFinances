const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function mesAtual(): string {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}`
}

export function primeiroDiaDoMes(ym: string): string {
  return `${ym}-01`
}

export function ultimoDiaDoMes(ym: string): string {
  const [ano, mes] = ym.split('-').map(Number)
  const ultimoDia = new Date(ano, mes, 0).getDate()
  return `${ym}-${String(ultimoDia).padStart(2, '0')}`
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function nomeDoMes(ym: string): string {
  const [ano, mes] = ym.split('-').map(Number)
  return `${NOMES_MESES[mes - 1]} de ${ano}`
}

export function resolverDiaRecorrencia(ym: string, dia: number): string {
  const ultimoDia = Number(ultimoDiaDoMes(ym).split('-')[2])
  const diaEfetivo = Math.min(dia, ultimoDia)
  return `${ym}-${String(diaEfetivo).padStart(2, '0')}`
}

export function deslocarMes(ym: string, delta: number): string {
  const [ano, mes] = ym.split('-').map(Number)
  const data = new Date(ano, mes - 1 + delta, 1)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

export function hojeISO(): string {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
}

export function ehFuturo(data: string): boolean {
  return data > hojeISO()
}

/** Dias de calendário (fuso local) entre o timestamp e agora: mesmo dia = 0, ontem = 1. (M18/M20) */
export function diasDesde(isoTimestamp: string, agora: Date = new Date()): number {
  const d = new Date(isoTimestamp)
  const inicio = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const fim = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())
  return Math.round((fim - inicio) / 86_400_000)
}

/** "hoje", "ontem", "há N dias" */
export function haQuantoTempo(isoTimestamp: string, agora: Date = new Date()): string {
  const dias = diasDesde(isoTimestamp, agora)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}

/** YYYY-MM-DD do timestamp no fuso local (para exibir datas de timestamptz). */
export function dataLocalISO(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
