create or replace function excluir_saida(p_saida_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  delete from saidas
  where id = p_saida_id and user_id = v_user_id;

  if not found then
    raise exception 'SAIDA_INVALIDA' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function atualizar_saida(
  p_saida_id uuid,
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb,
  p_recorrente boolean default false,
  p_dia_recorrencia smallint default null,
  p_template_id uuid default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_resultado jsonb;
begin
  perform excluir_saida(p_saida_id);

  select criar_saida(
    p_titulo,
    p_valor_total_centavos,
    p_categoria_id,
    p_data,
    p_splits,
    p_recorrente,
    p_dia_recorrencia,
    p_template_id
  ) into v_resultado;

  return v_resultado;
end;
$$;
