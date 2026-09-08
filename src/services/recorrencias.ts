import { unwrap } from '../lib/erros'
import { supabase } from '../lib/supabase'
import type {
  EntradaRow,
  RecorrenciaPendenteRow,
  RecorrenciaTemplateRow,
  ResultadoCriarSaidaRow,
} from '../types/api'
import type {
  Entrada,
  RecorrenciaPendente,
  RecorrenciaTemplate,
  ResultadoCriarSaida,
  SaidaSplit,
} from '../types/domain'
import { atualizarEntrada } from './entradas'
import { deEntrada, paraEntrada, paraRecorrenciaPendente, paraRecorrenciaTemplate, paraResultadoCriarSaida } from './mappers'
import { definirRecorrenciaAtivaSaida } from './saidas'

export async function listarPendentes(): Promise<RecorrenciaPendente[]> {
  const rows = unwrap<RecorrenciaPendenteRow[]>(
    await supabase.from('v_recorrencias_pendentes').select('*'),
  )
  return rows.map(paraRecorrenciaPendente)
}

export async function listarTemplates(): Promise<RecorrenciaTemplate[]> {
  const rows = unwrap<RecorrenciaTemplateRow[]>(
    await supabase.from('v_recorrencias_templates').select('*'),
  )
  return rows.map(paraRecorrenciaTemplate)
}

function esgotouParcelas(pendencia: RecorrenciaPendente): boolean {
  return pendencia.totalParcelas !== null && pendencia.parcelasLancadas + 1 >= pendencia.totalParcelas
}

export async function confirmarEntradaRecorrente(
  pendencia: RecorrenciaPendente,
  valorCentavos: number,
  data: string,
): Promise<Entrada> {
  const template = unwrap<EntradaRow>(
    await supabase.from('entradas').select('*').eq('id', pendencia.templateId).single(),
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
          templateId: pendencia.templateId,
        }),
      )
      .select()
      .single(),
  )

  if (esgotouParcelas(pendencia)) {
    await atualizarEntrada(pendencia.templateId, { recorrenciaAtiva: false })
  }

  return paraEntrada(row)
}

export async function confirmarSaidaRecorrente(
  pendencia: RecorrenciaPendente,
  valorCentavos: number,
  data: string,
  splits: SaidaSplit[],
): Promise<ResultadoCriarSaida> {
  const template = unwrap<{ titulo: string; categoria_id: string }>(
    await supabase.from('saidas').select('titulo,categoria_id').eq('id', pendencia.templateId).single(),
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
      p_template_id: pendencia.templateId,
      p_total_parcelas: null,
    }),
  )

  if (esgotouParcelas(pendencia)) {
    await definirRecorrenciaAtivaSaida(pendencia.templateId, false)
  }

  return paraResultadoCriarSaida(row)
}

export async function ignorarPendencia(
  templateId: string,
  tipo: 'entrada' | 'saida',
  competencia: string,
): Promise<void> {
  unwrap(
    await supabase
      .from('recorrencias_ignoradas')
      .insert({ template_id: templateId, tipo_lancamento: tipo, competencia }),
  )
}

export async function desfazerIgnorar(
  templateId: string,
  tipo: 'entrada' | 'saida',
  competencia: string,
): Promise<void> {
  unwrap(
    await supabase
      .from('recorrencias_ignoradas')
      .delete()
      .eq('template_id', templateId)
      .eq('tipo_lancamento', tipo)
      .eq('competencia', competencia),
  )
}
