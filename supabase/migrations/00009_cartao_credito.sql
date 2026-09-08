-- ============ M13: cartão de crédito ============

alter table fontes
  add column eh_cartao boolean not null default false,
  add column limite_centavos bigint,
  add column dia_fatura smallint;

alter table fontes add constraint fontes_cartao_tem_limite_e_dia check (
  not eh_cartao or (
    limite_centavos is not null and limite_centavos > 0
    and dia_fatura between 1 and 31
  )
);

alter table fontes add constraint fontes_nao_cartao_sem_limite check (
  eh_cartao or (limite_centavos is null and dia_fatura is null)
);

alter table entradas add column eh_pagamento_fatura boolean not null default false;
alter table saidas add column eh_pagamento_fatura boolean not null default false;

-- ============ v_saldo_fontes: +colunas de cartão ============

create or replace view v_saldo_fontes as
select
  f.id                as fonte_id,
  f.user_id,
  f.nome,
  f.tipo,
  f.cor,
  f.arquivada,
  coalesce(e.total, 0)  as total_entradas_centavos,
  coalesce(s.total, 0)  as total_saidas_centavos,
  coalesce(e.total, 0) - coalesce(s.total, 0) as saldo_centavos,
  f.eh_cartao,
  f.limite_centavos,
  f.dia_fatura
from fontes f
left join (
  select fonte_id, sum(valor_centavos) as total
  from entradas group by fonte_id
) e on e.fonte_id = f.id
left join (
  select fonte_id, sum(valor_centavos) as total
  from saida_splits group by fonte_id
) s on s.fonte_id = f.id;

alter view v_saldo_fontes set (security_invoker = true);

-- ============ v_resumo_geral: dívida de cartão não é "disponível" ============

create or replace view v_resumo_geral as
select
  user_id,
  sum(saldo_centavos)                                          as saldo_total_centavos,
  sum(saldo_centavos) filter (where tipo = 'livre')             as saldo_livre_centavos,
  sum(saldo_centavos) filter (where tipo = 'restrita')          as saldo_restrito_centavos
from v_saldo_fontes
where arquivada = false and eh_cartao = false
group by user_id;

alter view v_resumo_geral set (security_invoker = true);

-- ============ v_recorrencias_pendentes: +fatura de cartão ============

create or replace view v_recorrencias_pendentes as
select
  'entrada'::text as tipo_lancamento,
  t.id            as template_id,
  t.user_id,
  t.titulo,
  t.valor_centavos as valor_sugerido_centavos,
  t.dia_recorrencia,
  t.fonte_id,
  null::uuid      as categoria_id,
  t.total_parcelas,
  1 + (select count(*) from entradas g2 where g2.template_id = t.id) as parcelas_lancadas
from entradas t
where t.recorrente
  and t.recorrencia_ativa
  and date_trunc('month', t.data) < date_trunc('month', current_date)
  and not exists (
    select 1 from entradas g
    where g.template_id = t.id
      and date_trunc('month', g.data) = date_trunc('month', current_date)
  )
  and (
    t.total_parcelas is null
    or 1 + (select count(*) from entradas g2 where g2.template_id = t.id) < t.total_parcelas
  )
  and not exists (
    select 1 from recorrencias_ignoradas i
    where i.template_id = t.id
      and i.tipo_lancamento = 'entrada'
      and i.competencia = date_trunc('month', current_date)
  )
union all
select
  'saida'::text,
  t.id,
  t.user_id,
  t.titulo,
  t.valor_total_centavos,
  t.dia_recorrencia,
  null::uuid,
  t.categoria_id,
  t.total_parcelas,
  1 + (select count(*) from saidas g2 where g2.template_id = t.id)
from saidas t
where t.recorrente
  and t.recorrencia_ativa
  and date_trunc('month', t.data) < date_trunc('month', current_date)
  and not exists (
    select 1 from saidas g
    where g.template_id = t.id
      and date_trunc('month', g.data) = date_trunc('month', current_date)
  )
  and (
    t.total_parcelas is null
    or 1 + (select count(*) from saidas g2 where g2.template_id = t.id) < t.total_parcelas
  )
  and not exists (
    select 1 from recorrencias_ignoradas i
    where i.template_id = t.id
      and i.tipo_lancamento = 'saida'
      and i.competencia = date_trunc('month', current_date)
  )
union all
select
  'fatura_cartao'::text,
  f.id,
  f.user_id,
  f.nome,
  (-v.saldo_centavos)::bigint,
  f.dia_fatura,
  f.id,
  null::uuid,
  null::smallint,
  null::bigint
from fontes f
join v_saldo_fontes v on v.fonte_id = f.id
where f.eh_cartao
  and not f.arquivada
  and v.saldo_centavos < 0
  and f.dia_fatura <= extract(day from current_date)
  and not exists (
    select 1 from entradas p
    where p.fonte_id = f.id
      and p.eh_pagamento_fatura
      and date_trunc('month', p.data) = date_trunc('month', current_date)
  );

alter view v_recorrencias_pendentes set (security_invoker = true);

-- ============ criar_saida: bloqueio por limite em fontes-cartão ============
-- novo parâmetro = overload novo, precisa dropar a versão de 9 parâmetros.

drop function if exists criar_saida(text, bigint, uuid, date, jsonb, boolean, smallint, uuid, smallint);

create function criar_saida(
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb,
  p_recorrente boolean default false,
  p_dia_recorrencia smallint default null,
  p_template_id uuid default null,
  p_total_parcelas smallint default null,
  p_eh_pagamento_fatura boolean default false
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
    user_id, categoria_id, titulo, valor_total_centavos, data,
    recorrente, dia_recorrencia, template_id, total_parcelas, eh_pagamento_fatura
  ) values (
    v_user_id, p_categoria_id, p_titulo, p_valor_total_centavos, p_data,
    p_recorrente, p_dia_recorrencia, p_template_id, p_total_parcelas,
    p_eh_pagamento_fatura
  ) returning id into v_saida_id;

  insert into saida_splits (saida_id, fonte_id, valor_centavos)
  select v_saida_id, (s->>'fonte_id')::uuid, (s->>'valor_centavos')::bigint
  from jsonb_array_elements(p_splits) s;

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

alter function criar_saida(text, bigint, uuid, date, jsonb, boolean, smallint, uuid, smallint, boolean)
  set search_path = public;

-- ============ confirmar_fatura_cartao ============

create function confirmar_fatura_cartao(
  p_cartao_fonte_id uuid,
  p_fonte_pagadora_id uuid,
  p_valor_centavos bigint,
  p_data date
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_nome_cartao text;
  v_categoria_id uuid;
  v_resultado jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select nome into v_nome_cartao
  from fontes
  where id = p_cartao_fonte_id and user_id = v_user_id and eh_cartao;

  if not found then
    raise exception 'CARTAO_INVALIDO' using errcode = 'P0001';
  end if;

  select id into v_categoria_id
  from categorias
  where user_id = v_user_id and nome = 'Fatura de cartão';

  if not found then
    insert into categorias (user_id, nome)
    values (v_user_id, 'Fatura de cartão')
    returning id into v_categoria_id;
  end if;

  select criar_saida(
    p_titulo => 'Fatura ' || v_nome_cartao,
    p_valor_total_centavos => p_valor_centavos,
    p_categoria_id => v_categoria_id,
    p_data => p_data,
    p_splits => jsonb_build_array(
      jsonb_build_object('fonte_id', p_fonte_pagadora_id, 'valor_centavos', p_valor_centavos)
    ),
    p_eh_pagamento_fatura => true
  ) into v_resultado;

  insert into entradas (user_id, fonte_id, titulo, valor_centavos, data, eh_pagamento_fatura)
  values (v_user_id, p_cartao_fonte_id, 'Pagamento fatura ' || v_nome_cartao, p_valor_centavos, p_data, true);

  select jsonb_build_object(
    'saida_id', v_resultado->'saida_id',
    'fontes', (
      select jsonb_agg(jsonb_build_object(
        'fonte_id', v.fonte_id,
        'nome', v.nome,
        'tipo', v.tipo,
        'saldo_centavos', v.saldo_centavos
      ))
      from v_saldo_fontes v
      where v.fonte_id in (p_fonte_pagadora_id, p_cartao_fonte_id)
    ),
    'categoria', v_resultado->'categoria'
  ) into v_resultado;

  return v_resultado;
end;
$$;
