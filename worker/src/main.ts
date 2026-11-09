// Worker da Pluggy: timer de N horas + POST /sync (botão "Sincronizar agora").
import { createServer } from 'node:http'
import pg from 'pg'
import { validarJwt } from './jwt.ts'
import { ClientePluggy } from './pluggy.ts'
import { sincronizar, type ResumoSincronizacao } from './sincronizar.ts'

function env(nome: string): string {
  const v = process.env[nome]
  if (!v) {
    console.error(`[worker] variável ${nome} não definida`)
    process.exit(1)
  }
  return v
}

const db = new pg.Pool({ connectionString: env('DATABASE_URL'), max: 3 })
const pluggy = new ClientePluggy(env('PLUGGY_CLIENT_ID'), env('PLUGGY_CLIENT_SECRET'))
const JWT_SECRET = env('JWT_SECRET')
const INTERVALO_MS = Number(process.env.INTERVALO_HORAS ?? 6) * 3600 * 1000
const PORTA = Number(process.env.PORT ?? 8080)

let emAndamento: Promise<ResumoSincronizacao> | null = null

function rodar(origem: 'timer' | 'manual'): Promise<ResumoSincronizacao> | null {
  if (emAndamento) return null
  const inicio = Date.now()
  emAndamento = sincronizar(db, pluggy, origem)
    .then((r) => {
      console.log(`[sync] ${origem}: sucesso=${r.sucesso} importadas=${r.importadas} ${Date.now() - inicio}ms${r.erro ? ` erro=${r.erro}` : ''}`)
      return r
    })
    .catch((e) => {
      console.error('[sync] falhou', e instanceof Error ? e.message : e)
      return { sucesso: false, importadas: 0, erro: 'ERRO_INTERNO' }
    })
    .finally(() => {
      emAndamento = null
    })
  return emAndamento
}

function responder(res: import('node:http').ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(corpo))
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return responder(res, 200, { ok: true })
  if (req.method === 'POST' && req.url === '/sync') {
    const auth = req.headers.authorization ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!validarJwt(token, JWT_SECRET)) return responder(res, 401, { code: 'NAO_AUTORIZADO' })
    const execucao = rodar('manual')
    if (!execucao) return responder(res, 409, { code: 'SINCRONIZACAO_EM_ANDAMENTO' })
    return responder(res, 200, await execucao)
  }
  responder(res, 404, { code: 'NAO_ENCONTRADO' })
}).listen(PORTA, () => console.log(`[worker] ouvindo na porta ${PORTA}`))

rodar('timer')
setInterval(() => rodar('timer'), INTERVALO_MS)

// k8s manda SIGTERM no rollout; sem handler o node (PID 1) ignora e espera o SIGKILL.
for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, () => {
    console.log(`[worker] ${sinal}, saindo`)
    void db.end().finally(() => process.exit(0))
  })
}
