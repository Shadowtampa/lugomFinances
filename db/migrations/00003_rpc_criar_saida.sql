create or replace function criar_saida(
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb,               -- [{"fonte_id":"...","valor_centavos":1000}, ...]
  p_recorrente boolean default false,
  p_dia_recorrencia smallint default null,
  p_template_id uuid default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_saida_id uuid;
  v_soma bigint;
  v_split jsonb;
  v_fonte record;
  v_saldo bigint;
  v_permitida boolean;
  v_resultado jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- valida categoria pertence ao usuário
  if not exists (
    select 1 from categorias
    where id = p_categoria_id and user_id = v_user_id
  ) then
    raise exception 'CATEGORIA_INVALIDA' using errcode = 'P0001';
  end if;

  -- RN-01: soma dos splits = total
  select coalesce(sum((s->>'valor_centavos')::bigint), 0)
    into v_soma
  from jsonb_array_elements(p_splits) s;

  if v_soma <> p_valor_total_centavos then
    raise exception 'SPLIT_SOMA_DIVERGENTE: esperado %, recebido %',
      p_valor_total_centavos, v_soma using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_splits) = 0 then
    raise exception 'SPLIT_VAZIO' using errcode = 'P0001';
  end if;

  -- valida cada split ANTES de inserir qualquer coisa
  for v_split in select * from jsonb_array_elements(p_splits) loop
    select f.*, v.saldo_centavos into v_fonte
    from fontes f
    join v_saldo_fontes v on v.fonte_id = f.id
    where f.id = (v_split->>'fonte_id')::uuid
      and f.user_id = v_user_id;

    if not found then
      raise exception 'FONTE_INVALIDA: %', v_split->>'fonte_id'
        using errcode = 'P0001';
    end if;

    -- RN-03: fonte restrita só aceita categorias permitidas
    if v_fonte.tipo = 'restrita' then
      select exists (
        select 1 from fonte_categorias
        where fonte_id = v_fonte.id and categoria_id = p_categoria_id
      ) into v_permitida;

      if not v_permitida then
        raise exception
          'CATEGORIA_NAO_PERMITIDA_NA_FONTE: fonte=% categoria=%',
          v_fonte.nome, p_categoria_id using errcode = 'P0001';
      end if;
    end if;

    -- RN-02: não deixa saldo negativo
    if v_fonte.saldo_centavos < (v_split->>'valor_centavos')::bigint then
      raise exception
        'SALDO_INSUFICIENTE: fonte=% saldo=% solicitado=%',
        v_fonte.nome, v_fonte.saldo_centavos,
        (v_split->>'valor_centavos')::bigint using errcode = 'P0001';
    end if;
  end loop;

  -- grava
  insert into saidas (
    user_id, categoria_id, titulo, valor_total_centavos, data,
    recorrente, dia_recorrencia, template_id
  ) values (
    v_user_id, p_categoria_id, p_titulo, p_valor_total_centavos, p_data,
    p_recorrente, p_dia_recorrencia, p_template_id
  ) returning id into v_saida_id;

  insert into saida_splits (saida_id, fonte_id, valor_centavos)
  select v_saida_id, (s->>'fonte_id')::uuid, (s->>'valor_centavos')::bigint
  from jsonb_array_elements(p_splits) s;

  -- RN-07: devolve saldos pós-lançamento
  select jsonb_build_object(
    'saida_id', v_saida_id,
    'fontes', (
      select jsonb_agg(jsonb_build_object(
        'fonte_id', v.fonte_id,
        'nome', v.nome,
        'tipo', v.tipo,
        'saldo_centavos', v.saldo_centavos
      ))
      from v_saldo_fontes v
      where v.fonte_id in (
        select (s->>'fonte_id')::uuid from jsonb_array_elements(p_splits) s
      )
    ),
    'categoria', (
      select jsonb_build_object(
        'categoria_id', c.categoria_id,
        'nome', c.nome,
        'limite_mensal_centavos', c.limite_mensal_centavos,
        'saldo_disponivel_centavos', c.saldo_disponivel_centavos,
        'gasto_mes_atual_centavos', c.gasto_mes_atual_centavos
      )
      from v_saldo_categorias c
      where c.categoria_id = p_categoria_id
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;
