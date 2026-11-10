-- M28 — Vincular Saída a uma Recorrência. Spec: issue #9 (Shadowtampa/lugomFinances).
-- Uma Saída quita no máximo uma competência de uma recorrência (1:1). Recorrência continua
-- sem efeito em saldo; a Saída mantém todas as regras de criar_saida.

begin;

-- ---------- vínculo 1:1, e excluir a Saída volta a competência a pendente ----------

alter table recorrencias_pagamentos
  drop constraint recorrencias_pagamentos_saida_id_fkey,
  add constraint recorrencias_pagamentos_saida_id_fkey
    foreign key (saida_id) references saidas(id) on delete cascade,
  add constraint recorrencias_pagamentos_saida_unica unique (saida_id);

drop index if exists recorrencias_pagamentos_saida_id_idx;

-- ---------- vincular_saida_recorrencia (chamada por criar_saida) ----------

create function vincular_saida_recorrencia(
  p_saida_id uuid,
  p_recorrencia_id uuid,
  p_competencia date,
  p_pago_em date
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_competencia date := date_trunc('month', p_competencia)::date;
  v_pagamento recorrencias_pagamentos;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_competencia is null then
    raise exception 'COMPETENCIA_OBRIGATORIA' using errcode = 'P0001';
  end if;
  if not exists (select 1 from recorrencias where id = p_recorrencia_id and user_id = v_user_id) then
    raise exception 'RECORRENCIA_INVALIDA' using errcode = 'P0001';
  end if;
  if not exists (select 1 from saidas where id = p_saida_id and user_id = v_user_id) then
    raise exception 'SAIDA_INVALIDA' using errcode = 'P0001';
  end if;

  select * into v_pagamento from recorrencias_pagamentos
  where recorrencia_id = p_recorrencia_id and competencia = v_competencia
  for update;

  if found then
    if v_pagamento.saida_id is not null and v_pagamento.saida_id <> p_saida_id then
      raise exception 'RECORRENCIA_JA_VINCULADA' using errcode = 'P0001';
    end if;
    -- Marcação manual (sem lançamento): o vínculo substitui, data passa a ser a da Saída.
    update recorrencias_pagamentos
    set saida_id = p_saida_id, pago_em = p_pago_em
    where id = v_pagamento.id;
  else
    insert into recorrencias_pagamentos (user_id, recorrencia_id, competencia, pago_em, saida_id)
    values (v_user_id, p_recorrencia_id, v_competencia, p_pago_em, p_saida_id);
  end if;
end;
$$;

-- ---------- criar_saida: + p_recorrencia_id, p_competencia ----------

drop function criar_saida(text, bigint, uuid, date, jsonb, boolean);

create function criar_saida(
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb,
  p_eh_pagamento_fatura boolean default false,
  p_recorrencia_id uuid default null,
  p_competencia date default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_saida_id uuid;
  v_soma bigint;
  v_split jsonb;
  v_fonte record;
  v_permitida boolean;
  v_valor_split bigint;
  v_resultado jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not exists (
    select 1 from categorias
    where id = p_categoria_id and user_id = v_user_id
  ) then
    raise exception 'CATEGORIA_INVALIDA' using errcode = 'P0001';
  end if;

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

    v_valor_split := (v_split->>'valor_centavos')::bigint;

    if v_fonte.eh_cartao then
      if (-v_fonte.saldo_centavos + v_valor_split) > v_fonte.limite_centavos then
        raise exception
          'LIMITE_CARTAO_EXCEDIDO: fonte=% limite=% divida=% solicitado=%',
          v_fonte.nome, v_fonte.limite_centavos, -v_fonte.saldo_centavos,
          v_valor_split using errcode = 'P0001';
      end if;
    else
      if v_fonte.saldo_centavos < v_valor_split then
        raise exception
          'SALDO_INSUFICIENTE: fonte=% saldo=% solicitado=%',
          v_fonte.nome, v_fonte.saldo_centavos, v_valor_split
          using errcode = 'P0001';
      end if;
    end if;
  end loop;

  insert into saidas (
    user_id, categoria_id, titulo, valor_total_centavos, data, eh_pagamento_fatura
  ) values (
    v_user_id, p_categoria_id, p_titulo, p_valor_total_centavos, p_data,
    p_eh_pagamento_fatura
  ) returning id into v_saida_id;

  insert into saida_splits (saida_id, fonte_id, valor_centavos)
  select v_saida_id, (s->>'fonte_id')::uuid, (s->>'valor_centavos')::bigint
  from jsonb_array_elements(p_splits) s;

  if p_recorrencia_id is not null then
    if p_eh_pagamento_fatura then
      raise exception 'RECORRENCIA_EM_FATURA' using errcode = 'P0001';
    end if;
    perform vincular_saida_recorrencia(v_saida_id, p_recorrencia_id, p_competencia, p_data);
  end if;

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

-- ---------- atualizar_saida: repassa o vínculo ----------
-- Exclui e recria: o cascade derruba o vínculo antigo e o front reenvia o atual.
-- Editar sem mexer preserva; limpar remove; trocar move.

drop function atualizar_saida(uuid, text, bigint, uuid, date, jsonb);

create function atualizar_saida(
  p_saida_id uuid,
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb,
  p_recorrencia_id uuid default null,
  p_competencia date default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  perform excluir_saida(p_saida_id);
  select criar_saida(
    p_titulo => p_titulo,
    p_valor_total_centavos => p_valor_total_centavos,
    p_categoria_id => p_categoria_id,
    p_data => p_data,
    p_splits => p_splits,
    p_recorrencia_id => p_recorrencia_id,
    p_competencia => p_competencia
  ) into v_resultado;
  return v_resultado;
end;
$$;

-- ---------- v_recorrencias_mes: + saida_titulo, saida_data ----------

create or replace view v_recorrencias_mes as
select
  r.id                as recorrencia_id,
  r.user_id,
  r.titulo,
  r.valor_previsto_centavos,
  r.dia,
  r.categoria_id,
  c.nome              as categoria_nome,
  r.total_parcelas,
  r.ativa,
  g.competencia::date as competencia,
  (
    (extract(year from g.competencia) - extract(year from r.mes_inicio)) * 12
    + (extract(month from g.competencia) - extract(month from r.mes_inicio))
  )::int + 1          as parcela,
  p.id                as pagamento_id,
  p.pago_em,
  p.saida_id,
  s.valor_total_centavos as valor_pago_centavos,
  r.nota,
  coalesce(
    (
      select array_agg(rf.fonte_id order by f.nome)
      from recorrencias_fontes rf
      join fontes f on f.id = rf.fonte_id
      where rf.recorrencia_id = r.id
    ),
    '{}'
  )                   as fontes_previstas,
  s.titulo            as saida_titulo,
  s.data              as saida_data
from recorrencias r
cross join lateral generate_series(
  r.mes_inicio,
  date_trunc('month', current_date) + interval '12 months',
  interval '1 month'
) as g(competencia)
left join categorias c on c.id = r.categoria_id
left join recorrencias_pagamentos p
  on p.recorrencia_id = r.id and p.competencia = g.competencia::date
left join saidas s on s.id = p.saida_id
where (
    r.total_parcelas is null
    or (
      (extract(year from g.competencia) - extract(year from r.mes_inicio)) * 12
      + (extract(month from g.competencia) - extract(month from r.mes_inicio))
    ) + 1 <= r.total_parcelas
  )
  -- desativada: some dos meses sem pagamento; histórico pago continua visível
  and (r.ativa or p.id is not null);

alter view v_recorrencias_mes set (security_invoker = true);

grant execute on function vincular_saida_recorrencia(uuid, uuid, date, date) to authenticated;
grant execute on function criar_saida(text, bigint, uuid, date, jsonb, boolean, uuid, date) to authenticated;
grant execute on function atualizar_saida(uuid, text, bigint, uuid, date, jsonb, uuid, date) to authenticated;

commit;
