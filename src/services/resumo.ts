import { unwrap } from '../lib/erros'
import { supabase } from '../lib/supabase'
import type { ResumoGeralRow } from '../types/api'
import type { ResumoGeral } from '../types/domain'
import { paraResumoGeral } from './mappers'

const RESUMO_VAZIO: ResumoGeral = {
  saldoTotalCentavos: 0,
  saldoLivreCentavos: 0,
  saldoRestritoCentavos: 0,
}

export async function obterResumoGeral(): Promise<ResumoGeral> {
  const row = unwrap<ResumoGeralRow | null>(
    await supabase.from('v_resumo_geral').select('*').maybeSingle(),
  )
  return row ? paraResumoGeral(row) : RESUMO_VAZIO
}
