-- ============ M19: Recorrências como acompanhamento ============
-- Recorrência deixa de ser lançamento (template de Entrada/Saída) e passa a ser
-- um checklist mensal de contas a pagar. Nunca afeta saldo.

begin;

-- ---------- tabelas novas ----------

create table recorrencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  valor_previsto_centavos bigint not null,
  dia smallint not null,
  categoria_id uuid references categorias(id) on delete set null,
  mes_inicio date not null,
  total_parcelas smallint,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  constraint recorrencias_titulo_preenchido check (length(trim(titulo)) > 0),
  constraint recorrencias_valor_positivo check (valor_previsto_centavos > 0),
  constraint recorrencias_dia_valido check (dia between 1 and 31),
  constraint recorrencias_mes_inicio_dia_1 check (extract(day from mes_inicio) = 1),
  constraint recorrencias_parcelas_valida check (total_parcelas is null or total_parcelas >= 1)
);

create table recorrencias_pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorrencia_id uuid not null references recorrencias(id) on delete cascade,
  competencia date not null,
  pago_em date not null,
  saida_id uuid references saidas(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint recorrencias_pagamentos_competencia_dia_1 check (extract(day from competencia) = 1),
  constraint recorrencias_pagamentos_unico unique (recorrencia_id, competencia)
);

create index on recorrencias (user_id);
create index on recorrencias_pagamentos (user_id, competencia);
create index on recorrencias_pagamentos (saida_id) where saida_id is not null;

alter table recorrencias enable row level security;
alter table recorrencias_pagamentos enable row level security;

create policy "own_recorrencias" on recorrencias
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_recorrencias_pagamentos" on recorrencias_pagamentos
for all using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from recorrencias r where r.id = recorrencia_id and r.user_id = auth.uid())
);

create trigger trg_recorrencias_user_id
  before insert on recorrencias
  for each row execute function set_user_id_from_auth();

create trigger trg_recorrencias_pagamentos_user_id
  before insert on recorrencias_pagamentos
  for each row execute function set_user_id_from_auth();

-- ---------- migração dos templates de Saída ----------
-- Entradas recorrentes (Salário, VR) não migram: viram Entradas comuns.

create temporary table _map_recorrencias as
select gen_random_uuid() as recorrencia_id, s.id as template_id
from saidas s
where s.recorrente;

insert into recorrencias (
  id, user_id, titulo, valor_previsto_centavos, dia, categoria_id,
  mes_inicio, total_parcelas, ativa, created_at
)
select
  m.recorrencia_id, s.user_id, s.titulo, s.valor_total_centavos, s.dia_recorrencia,
  s.categoria_id, date_trunc('month', s.data)::date, s.total_parcelas,
  s.recorrencia_ativa, s.created_at
from _map_recorrencias m
join saidas s on s.id = m.template_id;

-- Histórico: o próprio template + cada Saída gerada a partir dele.
-- Mais de uma na mesma competência -> fica a mais antiga.
insert into recorrencias_pagamentos (user_id, recorrencia_id, competencia, pago_em, saida_id)
select distinct on (m.recorrencia_id, date_trunc('month', s.data))
  s.user_id, m.recorrencia_id, date_trunc('month', s.data)::date, s.data, s.id
from _map_recorrencias m
join saidas s on s.id = m.template_id or s.template_id = m.template_id
order by m.recorrencia_id, date_trunc('month', s.data), s.data, s.created_at;

drop table _map_recorrencias;

-- ---------- remove o modelo antigo ----------

drop view if exists v_recorrencias_pendentes;
drop view if exists v_recorrencias_templates;
drop table if exists recorrencias_ignoradas;

drop function if exists atualizar_saida(uuid, text, bigint, uuid, date, jsonb, boolean, smallint, uuid, smallint);
drop function if exists confirmar_fatura_cartao(uuid, uuid, bigint, date);
drop function if exists criar_saida(text, bigint, uuid, date, jsonb, boolean, smallint, uuid, smallint, boolean);

alter table entradas
  drop column recorrente,
  drop column dia_recorrencia,
  drop column recorrencia_ativa,
  drop column template_id,
  drop column total_parcelas;

alter table saidas
  drop column recorrente,
  drop column dia_recorrencia,
  drop column recorrencia_ativa,
  drop column template_id,
  drop column total_parcelas;

-- ---------- criar_saida sem parâmetros de recorrência ----------

create function criar_saida(
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb,
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
    user_id, categoria_id, titulo, valor_total_centavos, data, eh_pagamento_fatura
  ) values (
    v_user_id, p_categoria_id, p_titulo, p_valor_total_centavos, p_data,
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

alter function criar_saida(text, bigint, uuid, date, jsonb, boolean)
  set search_path = public;

create function atualizar_saida(
  p_saida_id uuid,
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb
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
    p_splits => p_splits
  ) into v_resultado;
  return v_resultado;
end;
$$;

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

-- ---------- v_faturas_pendentes (ramo de fatura da antiga v_recorrencias_pendentes, RN-13) ----------

create view v_faturas_pendentes as
select
  f.id              as fonte_id,
  f.user_id,
  f.nome,
  (-v.saldo_centavos)::bigint as valor_sugerido_centavos,
  f.dia_fatura
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

alter view v_faturas_pendentes set (security_invoker = true);

-- ---------- v_recorrencias_mes: uma linha por recorrência vigente x competência ----------
-- Competências de mes_inicio até 12 meses à frente do mês atual. Status (paga/pendente/
-- atrasada) é derivado no front, porque depende do "hoje" do cliente.

create view v_recorrencias_mes as
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
  s.valor_total_centavos as valor_pago_centavos
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
commit;
