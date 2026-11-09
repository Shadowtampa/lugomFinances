-- ============ M20: Integração Pluggy ============
-- Transações das contas/cartões chegam via worker (role pluggy_worker) numa caixa de
-- entrada (transacoes_importadas). Só viram Entrada/Saída quando o usuário confirma.

begin;

-- ---------- fontes: origem + vínculo com conta da Pluggy ----------

alter table fontes
  add column origem text not null default 'manual',
  add column pluggy_account_id text,
  add constraint fontes_origem_valida check (origem in ('manual', 'pluggy')),
  add constraint fontes_pluggy_account_unica unique (pluggy_account_id);

-- ---------- tabelas de integração ----------

create table pluggy_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  nome text,
  status text,
  execution_status text,
  atualizado_na_pluggy_em timestamptz,
  created_at timestamptz not null default now(),
  constraint pluggy_itens_item_unico unique (item_id),
  constraint pluggy_itens_item_preenchido check (length(trim(item_id)) > 0)
);

create table pluggy_contas (
  pluggy_account_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references pluggy_itens(item_id) on delete cascade,
  nome text not null,
  tipo text not null,
  numero text,
  saldo_centavos bigint not null default 0,
  limite_centavos bigint,
  dia_fatura smallint,
  data_corte date,
  updated_at timestamptz not null default now(),
  constraint pluggy_contas_tipo_valido check (tipo in ('BANK', 'CREDIT'))
);

create table transacoes_importadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pluggy_transaction_id text not null,
  pluggy_account_id text not null references pluggy_contas(pluggy_account_id) on delete cascade,
  data date not null,
  descricao text not null,
  valor_centavos bigint not null,
  direcao text not null,
  status_pluggy text not null,
  categoria_pluggy text,
  parcela smallint,
  total_parcelas smallint,
  estado text not null default 'pendente',
  entrada_id uuid references entradas(id) on delete set null,
  saida_id uuid references saidas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transacoes_importadas_pluggy_unica unique (pluggy_transaction_id),
  constraint transacoes_importadas_valor_positivo check (valor_centavos > 0),
  constraint transacoes_importadas_direcao_valida check (direcao in ('entrada', 'saida')),
  constraint transacoes_importadas_estado_valido
    check (estado in ('pendente', 'confirmada', 'ignorada', 'divergente'))
);

create table sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origem text not null,
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  sucesso boolean,
  importadas int not null default 0,
  erro text,
  constraint sincronizacoes_origem_valida check (origem in ('timer', 'manual'))
);

create index on pluggy_contas (user_id);
create index on transacoes_importadas (user_id, estado, data);
create index on transacoes_importadas (pluggy_account_id);
create index on sincronizacoes (user_id, iniciada_em desc);

-- ---------- RLS + user_id automático ----------

alter table pluggy_itens enable row level security;
alter table pluggy_contas enable row level security;
alter table transacoes_importadas enable row level security;
alter table sincronizacoes enable row level security;

create policy "own_pluggy_itens" on pluggy_itens
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_pluggy_contas" on pluggy_contas
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_transacoes_importadas" on transacoes_importadas
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_sincronizacoes" on sincronizacoes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_pluggy_itens_user_id
  before insert on pluggy_itens
  for each row execute function set_user_id_from_auth();

-- ---------- role do worker ----------
-- Senha definida fora da migration (zz_settings.sh no init; à mão em banco existente).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pluggy_worker') then
    create role pluggy_worker login bypassrls;
  end if;
end;
$$;

do $$ begin execute format('grant connect on database %I to pluggy_worker', current_database()); end; $$;
grant usage on schema public to pluggy_worker;
grant select, insert, update, delete
  on pluggy_itens, pluggy_contas, transacoes_importadas, sincronizacoes
  to pluggy_worker;
grant select on fontes to pluggy_worker;

-- ---------- views ----------

create view v_importadas_pendentes as
select
  t.id,
  t.user_id,
  t.pluggy_transaction_id,
  t.pluggy_account_id,
  f.id                as fonte_id,
  t.data,
  t.descricao,
  t.valor_centavos,
  t.direcao,
  t.status_pluggy,
  t.categoria_pluggy,
  t.parcela,
  t.total_parcelas,
  t.estado,
  t.entrada_id,
  t.saida_id,
  (
    select s.categoria_id
    from transacoes_importadas t2
    join saidas s on s.id = t2.saida_id
    where t2.user_id = t.user_id
      and t2.estado = 'confirmada'
      and t2.direcao = 'saida'
      and lower(t2.descricao) = lower(t.descricao)
    order by t2.updated_at desc
    limit 1
  )                   as categoria_sugerida_id
from transacoes_importadas t
left join fontes f on f.pluggy_account_id = t.pluggy_account_id
where t.estado in ('pendente', 'divergente');

alter view v_importadas_pendentes set (security_invoker = true);

create view v_sugestoes_recorrencia as
select
  t.id                as transacao_id,
  t.user_id,
  r.recorrencia_id,
  r.titulo,
  r.competencia
from transacoes_importadas t
join v_recorrencias_mes r
  on r.user_id = t.user_id
 and r.competencia = date_trunc('month', t.data)::date
 and r.pagamento_id is null
 and r.valor_previsto_centavos = t.valor_centavos
where t.estado = 'pendente'
  and t.direcao = 'saida';

alter view v_sugestoes_recorrencia set (security_invoker = true);

create view v_status_integracao as
select
  u.user_id,
  (select count(*) from pluggy_itens i where i.user_id = u.user_id)::int as total_itens,
  ult.iniciada_em     as ultima_sincronizacao_em,
  ult.sucesso         as ultima_sincronizacao_sucesso,
  ult.erro            as ultima_sincronizacao_erro,
  ult.importadas      as ultima_sincronizacao_importadas,
  (
    select max(s.iniciada_em) from sincronizacoes s
    where s.user_id = u.user_id and s.sucesso
  )                   as ultima_sincronizacao_ok_em,
  coalesce((
    select jsonb_agg(jsonb_build_object('item_id', i.item_id, 'nome', i.nome, 'status', i.status))
    from pluggy_itens i
    where i.user_id = u.user_id
      and i.status in ('LOGIN_ERROR', 'OUTDATED', 'WAITING_USER_INPUT')
  ), '[]'::jsonb)     as itens_com_problema
from (select distinct user_id from pluggy_itens) u
left join lateral (
  select s.iniciada_em, s.sucesso, s.erro, s.importadas
  from sincronizacoes s
  where s.user_id = u.user_id and s.finalizada_em is not null
  order by s.iniciada_em desc
  limit 1
) ult on true;

alter view v_status_integracao set (security_invoker = true);

-- ---------- RPCs ----------

create function vincular_conta_pluggy(
  p_pluggy_account_id text,
  p_fonte_id uuid default null,
  p_nova_fonte jsonb default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conta pluggy_contas;
  v_fonte_id uuid := p_fonte_id;
  v_categoria_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_conta from pluggy_contas
  where pluggy_account_id = p_pluggy_account_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'CONTA_INVALIDA' using errcode = 'P0001';
  end if;
  if v_conta.data_corte is not null
     or exists (select 1 from fontes where pluggy_account_id = p_pluggy_account_id) then
    raise exception 'CONTA_JA_VINCULADA' using errcode = 'P0001';
  end if;

  if v_fonte_id is not null then
    if not exists (
      select 1 from fontes
      where id = v_fonte_id and user_id = v_user_id and not arquivada
        and eh_cartao = (v_conta.tipo = 'CREDIT')
    ) then
      raise exception 'FONTE_INVALIDA' using errcode = 'P0001';
    end if;
    if exists (select 1 from fontes where id = v_fonte_id and pluggy_account_id is not null) then
      raise exception 'FONTE_JA_VINCULADA' using errcode = 'P0001';
    end if;
    update fontes set origem = 'pluggy', pluggy_account_id = p_pluggy_account_id
    where id = v_fonte_id;
  else
    if p_nova_fonte is null or coalesce(trim(p_nova_fonte->>'nome'), '') = '' then
      raise exception 'FONTE_INVALIDA' using errcode = 'P0001';
    end if;
    insert into fontes (user_id, nome, tipo, origem, pluggy_account_id, eh_cartao, limite_centavos, dia_fatura)
    values (
      v_user_id,
      trim(p_nova_fonte->>'nome'),
      'livre',
      'pluggy',
      p_pluggy_account_id,
      v_conta.tipo = 'CREDIT',
      case when v_conta.tipo = 'CREDIT' then (p_nova_fonte->>'limite_centavos')::bigint end,
      case when v_conta.tipo = 'CREDIT' then (p_nova_fonte->>'dia_fatura')::smallint end
    )
    returning id into v_fonte_id;
  end if;

  update pluggy_contas set data_corte = current_date where pluggy_account_id = p_pluggy_account_id;

  -- Saldo inicial: conta com saldo positivo -> Entrada; cartão com dívida -> Saída.
  if v_conta.tipo = 'BANK' and v_conta.saldo_centavos > 0 then
    insert into entradas (user_id, fonte_id, titulo, valor_centavos, data)
    values (v_user_id, v_fonte_id, 'Saldo inicial', v_conta.saldo_centavos, current_date);
  elsif v_conta.tipo = 'CREDIT' and v_conta.saldo_centavos > 0 then
    select id into v_categoria_id from categorias
    where user_id = v_user_id and nome = 'Ajuste de saldo';
    if not found then
      insert into categorias (user_id, nome) values (v_user_id, 'Ajuste de saldo')
      returning id into v_categoria_id;
    end if;
    perform criar_saida(
      p_titulo => 'Fatura em aberto (saldo inicial)',
      p_valor_total_centavos => v_conta.saldo_centavos,
      p_categoria_id => v_categoria_id,
      p_data => current_date,
      p_splits => jsonb_build_array(
        jsonb_build_object('fonte_id', v_fonte_id, 'valor_centavos', v_conta.saldo_centavos)
      )
    );
  end if;

  return v_fonte_id;
end;
$$;

create function confirmar_importada(
  p_id uuid,
  p_categoria_id uuid default null,
  p_recorrencia_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_t transacoes_importadas;
  v_fonte_id uuid;
  v_entrada_id uuid;
  v_resultado jsonb;
  v_competencia date;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_t from transacoes_importadas
  where id = p_id and user_id = v_user_id
  for update;
  if not found or v_t.estado <> 'pendente' then
    raise exception 'IMPORTADA_NAO_PENDENTE' using errcode = 'P0001';
  end if;

  select id into v_fonte_id from fontes where pluggy_account_id = v_t.pluggy_account_id;
  if v_fonte_id is null then
    raise exception 'CONTA_NAO_VINCULADA' using errcode = 'P0001';
  end if;

  if v_t.direcao = 'entrada' then
    insert into entradas (user_id, fonte_id, titulo, valor_centavos, data)
    values (v_user_id, v_fonte_id, v_t.descricao, v_t.valor_centavos, v_t.data)
    returning id into v_entrada_id;
    update transacoes_importadas
    set estado = 'confirmada', entrada_id = v_entrada_id, updated_at = now()
    where id = p_id;
    return jsonb_build_object('entrada_id', v_entrada_id);
  end if;

  if p_categoria_id is null then
    raise exception 'CATEGORIA_OBRIGATORIA' using errcode = 'P0001';
  end if;

  v_resultado := criar_saida(
    p_titulo => v_t.descricao,
    p_valor_total_centavos => v_t.valor_centavos,
    p_categoria_id => p_categoria_id,
    p_data => v_t.data,
    p_splits => jsonb_build_array(
      jsonb_build_object('fonte_id', v_fonte_id, 'valor_centavos', v_t.valor_centavos)
    )
  );

  update transacoes_importadas
  set estado = 'confirmada', saida_id = (v_resultado->>'saida_id')::uuid, updated_at = now()
  where id = p_id;

  if p_recorrencia_id is not null then
    v_competencia := date_trunc('month', v_t.data)::date;
    if exists (
      select 1 from recorrencias_pagamentos
      where recorrencia_id = p_recorrencia_id and competencia = v_competencia
    ) then
      raise exception 'RECORRENCIA_JA_PAGA' using errcode = 'P0001';
    end if;
    insert into recorrencias_pagamentos (user_id, recorrencia_id, competencia, pago_em, saida_id)
    values (v_user_id, p_recorrencia_id, v_competencia, v_t.data, (v_resultado->>'saida_id')::uuid);
  end if;

  return v_resultado;
end;
$$;

create function ignorar_importada(p_id uuid) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update transacoes_importadas
  set estado = 'ignorada', updated_at = now()
  where id = p_id and user_id = auth.uid() and estado in ('pendente', 'divergente');
  if not found then
    raise exception 'IMPORTADA_NAO_PENDENTE' using errcode = 'P0001';
  end if;
end;
$$;

create function desfazer_ignorar_importada(p_id uuid) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update transacoes_importadas
  set estado = case when entrada_id is null and saida_id is null then 'pendente' else 'divergente' end,
      updated_at = now()
  where id = p_id and user_id = auth.uid() and estado = 'ignorada';
  if not found then
    raise exception 'IMPORTADA_NAO_IGNORADA' using errcode = 'P0001';
  end if;
end;
$$;

commit;
