// Um ciclo de sincronização: Pluggy -> pluggy_itens / pluggy_contas / transacoes_importadas.
import type pg from 'pg'
import { ClientePluggy, ErroPluggy } from './pluggy.ts'
import { dataLocal, decidirSumidas, normalizarTransacao, paraCentavos, type ImportadaExistente } from './normalizar.ts'

export interface ResumoSincronizacao {
  sucesso: boolean
  importadas: number
  erro: string | null
}

function somarDia(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function mensagemErro(e: unknown): string {
  if (e instanceof ErroPluggy) return e.message
  return 'ERRO_INTERNO'
}

export async function sincronizar(
  db: pg.Pool,
  pluggy: ClientePluggy,
  origem: 'timer' | 'manual',
): Promise<ResumoSincronizacao> {
  const { rows: itens } = await db.query<{ item_id: string; user_id: string }>(
    'select item_id, user_id from pluggy_itens order by created_at',
  )
  if (itens.length === 0) return { sucesso: true, importadas: 0, erro: null }

  // App de usuário único: a sincronização fica registrada no dono dos itens.
  const userId = itens[0].user_id
  const { rows: [sinc] } = await db.query<{ id: string }>(
    'insert into sincronizacoes (user_id, origem) values ($1, $2) returning id',
    [userId, origem],
  )

  let importadas = 0
  const erros: string[] = []
  const hoje = dataLocal(new Date())

  for (const item of itens) {
    try {
      const info = await pluggy.obterItem(item.item_id)
      await db.query(
        `update pluggy_itens
           set nome = coalesce($2, nome), status = $3, execution_status = $4, atualizado_na_pluggy_em = $5
         where item_id = $1`,
        [item.item_id, info.connector?.name ?? null, info.status, info.executionStatus ?? null, info.updatedAt ?? null],
      )

      for (const conta of await pluggy.listarContas(item.item_id)) {
        const diaFatura = conta.creditData?.balanceDueDate
          ? Number(dataLocal(conta.creditData.balanceDueDate).slice(8, 10))
          : null
        const { rows: [linha] } = await db.query<{ data_corte: string | null; vinculada: boolean }>(
          `insert into pluggy_contas
             (pluggy_account_id, user_id, item_id, nome, tipo, numero, saldo_centavos, limite_centavos, dia_fatura)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (pluggy_account_id) do update set
             nome = excluded.nome, numero = excluded.numero, saldo_centavos = excluded.saldo_centavos,
             limite_centavos = excluded.limite_centavos, dia_fatura = excluded.dia_fatura, updated_at = now()
           returning to_char(data_corte, 'YYYY-MM-DD') as data_corte,
             exists (select 1 from fontes f where f.pluggy_account_id = $1) as vinculada`,
          [
            conta.id, item.user_id, item.item_id, conta.name, conta.type, conta.number ?? null,
            // Saldo como a Pluggy informa: conta pode ser negativa; cartão = dívida (>= 0).
            conta.type === 'CREDIT' ? paraCentavos(conta.balance) : Math.round(conta.balance * 100),
            conta.creditData?.creditLimit != null ? paraCentavos(conta.creditData.creditLimit) : null,
            diaFatura,
          ],
        )
        if (!linha.vinculada || !linha.data_corte) continue

        const transacoes = await pluggy.listarTransacoes(conta.id, somarDia(linha.data_corte, 1))
        const recebidos = new Set<string>()
        for (const t of transacoes) {
          const n = normalizarTransacao(t, conta.type, linha.data_corte, hoje)
          if (!n) continue
          recebidos.add(n.pluggyTransactionId)
          const r = await db.query(
            `insert into transacoes_importadas
               (user_id, pluggy_transaction_id, pluggy_account_id, data, descricao, valor_centavos,
                direcao, status_pluggy, categoria_pluggy, parcela, total_parcelas, data_compra)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             on conflict (pluggy_transaction_id) do update set
               data = excluded.data, descricao = excluded.descricao, valor_centavos = excluded.valor_centavos,
               direcao = excluded.direcao, status_pluggy = excluded.status_pluggy,
               categoria_pluggy = excluded.categoria_pluggy, data_compra = excluded.data_compra,
               updated_at = now()
             where transacoes_importadas.estado = 'pendente'
             returning (xmax = 0) as nova`,
            [
              item.user_id, n.pluggyTransactionId, conta.id, n.data, n.descricao, n.valorCentavos,
              n.direcao, n.statusPluggy, n.categoriaPluggy, n.parcela, n.totalParcelas, n.dataCompra,
            ],
          )
          if (r.rows[0]?.nova) importadas++
          // Confirmada que passou de PENDING para POSTED: só atualiza o status, sem mexer no resto.
          if (r.rowCount === 0) {
            await db.query(
              `update transacoes_importadas set status_pluggy = $2, updated_at = now()
               where pluggy_transaction_id = $1 and status_pluggy <> $2`,
              [n.pluggyTransactionId, n.statusPluggy],
            )
          }
        }

        const { rows: existentes } = await db.query<ImportadaExistente>(
          `select id, pluggy_transaction_id as "pluggyTransactionId", estado, status_pluggy as "statusPluggy"
           from transacoes_importadas where pluggy_account_id = $1 and status_pluggy = 'PENDING'`,
          [conta.id],
        )
        const { apagar, divergentes } = decidirSumidas(existentes, recebidos)
        if (apagar.length) await db.query('delete from transacoes_importadas where id = any($1)', [apagar])
        if (divergentes.length)
          await db.query(
            `update transacoes_importadas set estado = 'divergente', updated_at = now() where id = any($1)`,
            [divergentes],
          )
      }
    } catch (e) {
      erros.push(e instanceof ErroPluggy && (e.codigo === 'PLUGGY_NAO_ENCONTRADO' || e.codigo === 'PLUGGY_REQUISICAO_INVALIDA')
        ? `ITEM_NAO_ENCONTRADO: ${item.item_id}`
        : mensagemErro(e))
      if (!(e instanceof ErroPluggy)) console.error('[sync] erro interno', e)
    }
  }

  const resumo: ResumoSincronizacao = {
    sucesso: erros.length === 0,
    importadas,
    erro: erros.length ? erros.join('; ').slice(0, 500) : null,
  }
  await db.query(
    'update sincronizacoes set finalizada_em = now(), sucesso = $2, importadas = $3, erro = $4 where id = $1',
    [sinc.id, resumo.sucesso, resumo.importadas, resumo.erro],
  )
  return resumo
}
