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
