import { unwrap } from '../lib/erros'
import { supabase } from '../lib/supabase'
import type { AdesaoMetodoRow } from '../types/api'
import type { AdesaoMetodo } from '../types/domain'
import { paraAdesaoMetodo } from './mappers'

// null = nenhuma entrada no mês corrente (a view não devolve linha)
export async function obterAdesaoMetodo(): Promise<AdesaoMetodo | null> {
  const row = unwrap<AdesaoMetodoRow | null>(
    await supabase.from('v_adesao_50_15_35').select('*').maybeSingle(),
  )
  return row ? paraAdesaoMetodo(row) : null
}
