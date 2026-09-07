import { unwrap } from '../lib/erros'
import { supabase } from '../lib/supabase'
import type { EntradaRow, RecorrenciaPendenteRow, ResultadoCriarSaidaRow } from '../types/api'
import type { Entrada, RecorrenciaPendente, ResultadoCriarSaida, SaidaSplit } from '../types/domain'
import { deEntrada, paraEntrada, paraResultadoCriarSaida } from './mappers'

export async function listarPendentes(): Promise<RecorrenciaPendente[]> {
  const rows = unwrap<RecorrenciaPendenteRow[]>(
    await supabase.from('v_recorrencias_pendentes').select('*'),
  )
  return rows.map((row) => ({
    tipo: row.tipo_lancamento,
    templateId: row.template_id,
    titulo: row.titulo,
    valorSugeridoCentavos: row.valor_sugerido_centavos,
    diaRecorrencia: row.dia_recorrencia,
    fonteId: row.fonte_id,
    categoriaId: row.categoria_id,
  }))
}

export async function confirmarEntradaRecorrente(
  templateId: string,
  valorCentavos: number,
  data: string,
): Promise<Entrada> {
  const template = unwrap<EntradaRow>(
    await supabase.from('entradas').select('*').eq('id', templateId).single(),
  )

  const row = unwrap<EntradaRow>(
    await supabase
      .from('entradas')
      .insert(
        deEntrada({
          fonteId: template.fonte_id,
          titulo: template.titulo,
          valorCentavos,
          data,
          recorrente: false,
          templateId,
        }),
      )
      .select()
      .single(),
  )
  return paraEntrada(row)
}

export async function confirmarSaidaRecorrente(
  templateId: string,
  valorCentavos: number,
  data: string,
  splits: SaidaSplit[],
): Promise<ResultadoCriarSaida> {
  const template = unwrap<{ titulo: string; categoria_id: string }>(
    await supabase.from('saidas').select('titulo,categoria_id').eq('id', templateId).single(),
  )

  const row = unwrap<ResultadoCriarSaidaRow>(
    await supabase.rpc('criar_saida', {
      p_titulo: template.titulo,
      p_valor_total_centavos: valorCentavos,
      p_categoria_id: template.categoria_id,
      p_data: data,
      p_splits: splits.map((split) => ({
        fonte_id: split.fonteId,
        valor_centavos: split.valorCentavos,
      })),
      p_recorrente: false,
      p_dia_recorrencia: null,
      p_template_id: templateId,
    }),
  )
  return paraResultadoCriarSaida(row)
}
