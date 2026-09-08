-- ============ parcelamento (recorrência finita) ============

alter table entradas add column total_parcelas smallint;
alter table entradas add constraint entradas_parcelas_valida
  check (total_parcelas is null or total_parcelas >= 1);
alter table entradas add constraint entradas_parcelas_requer_recorrente
  check (total_parcelas is null or recorrente);

alter table saidas add column total_parcelas smallint;
alter table saidas add constraint saidas_parcelas_valida
  check (total_parcelas is null or total_parcelas >= 1);
alter table saidas add constraint saidas_parcelas_requer_recorrente
  check (total_parcelas is null or recorrente);

-- ============ recorrencias_ignoradas ============

create table recorrencias_ignoradas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  tipo_lancamento text not null check (tipo_lancamento in ('entrada','saida')),
  competencia date not null,   -- primeiro dia do mês ignorado
  created_at timestamptz not null default now(),
  unique (template_id, tipo_lancamento, competencia)
);

alter table recorrencias_ignoradas enable row level security;

create policy "own_recorrencias_ignoradas" on recorrencias_ignoradas
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_recorrencias_ignoradas_user_id
  before insert on recorrencias_ignoradas
  for each row execute function set_user_id_from_auth();

-- ============ criar_saida / atualizar_saida: +p_total_parcelas ============
-- CREATE OR REPLACE não troca a assinatura (novo parâmetro = overload novo),
-- então as funções antigas de 8 parâmetros precisam ser removidas primeiro.

drop function if exists atualizar_saida(uuid, text, bigint, uuid, date, jsonb, boolean, smallint, uuid);
drop function if exists criar_saida(text, bigint, uuid, date, jsonb, boolean, smallint, uuid);

create function criar_saida(
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb,
  p_recorrente boolean default false,
  p_dia_recorrencia smallint default null,
  p_template_id uuid default null,
  p_total_parcelas smallint default null
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

    if v_fonte.saldo_centavos < (v_split->>'valor_centavos')::bigint then
      raise exception
        'SALDO_INSUFICIENTE: fonte=% saldo=% solicitado=%',
        v_fonte.nome, v_fonte.saldo_centavos,
        (v_split->>'valor_centavos')::bigint using errcode = 'P0001';
    end if;
  end loop;

  insert into saidas (
    user_id, categoria_id, titulo, valor_total_centavos, data,
    recorrente, dia_recorrencia, template_id, total_parcelas
  ) values (
    v_user_id, p_categoria_id, p_titulo, p_valor_total_centavos, p_data,
    p_recorrente, p_dia_recorrencia, p_template_id, p_total_parcelas
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

create function atualizar_saida(
  p_saida_id uuid,
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb,
  p_recorrente boolean default false,
  p_dia_recorrencia smallint default null,
  p_template_id uuid default null,
  p_total_parcelas smallint default null
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
    p_titulo,
    p_valor_total_centavos,
    p_categoria_id,
    p_data,
    p_splits,
    p_recorrente,
    p_dia_recorrencia,
    p_template_id,
    p_total_parcelas
  ) into v_resultado;

  return v_resultado;
end;
$$;

-- ============ v_recorrencias_pendentes: +parcelas, +ignoradas ============

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
  );

alter view v_recorrencias_pendentes set (security_invoker = true);

-- ============ v_recorrencias_templates ============

create view v_recorrencias_templates as
select
  'entrada'::text as tipo_lancamento,
  t.id            as template_id,
  t.user_id,
  t.titulo,
  t.valor_centavos as valor_centavos,
  t.dia_recorrencia,
  t.recorrencia_ativa,
  t.total_parcelas,
  1 + (select count(*) from entradas g2 where g2.template_id = t.id) as parcelas_lancadas,
  t.fonte_id,
  null::uuid      as categoria_id
from entradas t
where t.recorrente
union all
select
  'saida'::text,
  t.id,
  t.user_id,
  t.titulo,
  t.valor_total_centavos,
  t.dia_recorrencia,
  t.recorrencia_ativa,
  t.total_parcelas,
  1 + (select count(*) from saidas g2 where g2.template_id = t.id),
  null::uuid,
  t.categoria_id
from saidas t
where t.recorrente;

alter view v_recorrencias_templates set (security_invoker = true);
