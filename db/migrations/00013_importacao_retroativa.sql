-- ============ M21: Importação retroativa + conciliação de cartão ============
-- "Importar desde" editável por conta (data_corte + 1), saldo inicial recalculado depois
-- da sincronização, par de pagamento de fatura (conta + cartão) e conciliação app × Pluggy.

begin;

-- ---------- colunas novas ----------

alter table pluggy_contas
  add column saldo_inicial_entrada_id uuid references entradas(id) on delete set null,
  add column saldo_inicial_saida_id uuid references saidas(id) on delete set null,
  add column saldo_inicial_pendente_desde timestamptz;

alter table transacoes_importadas
  add column data_compra date;

-- Backfill: liga os saldos iniciais lançados pelo M20 (mesma Fonte, data = data_corte).
update pluggy_contas c
set saldo_inicial_entrada_id = (
  select e.id from entradas e
  join fontes f on f.id = e.fonte_id
  where f.pluggy_account_id = c.pluggy_account_id
    and e.titulo = 'Saldo inicial' and e.data = c.data_corte
  order by e.created_at limit 1
)
where c.data_corte is not null and c.tipo = 'BANK';

update pluggy_contas c
set saldo_inicial_saida_id = (
  select s.id from saidas s
  join saida_splits sp on sp.saida_id = s.id
  join fontes f on f.id = sp.fonte_id
  where f.pluggy_account_id = c.pluggy_account_id
    and s.titulo = 'Fatura em aberto (saldo inicial)' and s.data = c.data_corte
  order by s.created_at limit 1
)
where c.data_corte is not null and c.tipo = 'CREDIT';

-- ---------- helper: efeito de uma importada no saldo (entrada +, saída −) ----------

create function efeito_importada(p_direcao text, p_valor bigint) returns bigint
language sql immutable
as $$ select case when p_direcao = 'entrada' then p_valor else -p_valor end $$;

-- Parcela de compra anterior ao corte: o saldo Pluggy do cartão (limite usado) já a inclui,
-- então ela fica fora do cálculo do saldo inicial e da conciliação (sugestão: ignorar).
create function parcela_anterior_ao_corte(p_parcela smallint, p_data_compra date, p_corte date) returns boolean
language sql immutable
as $$ select p_parcela is not null and p_data_compra is not null and p_data_compra <= p_corte $$;

-- ---------- vincular_conta_pluggy: saldo inicial só depois da sincronização ----------

drop function vincular_conta_pluggy(text, uuid, jsonb);

create function vincular_conta_pluggy(
  p_pluggy_account_id text,
  p_fonte_id uuid default null,
  p_nova_fonte jsonb default null,
  p_data_inicio date default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conta pluggy_contas;
  v_fonte_id uuid := p_fonte_id;
  v_inicio date := coalesce(p_data_inicio, date_trunc('month', current_date)::date);
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if v_inicio > current_date then
    raise exception 'CORTE_INVALIDO' using errcode = 'P0001';
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

  update pluggy_contas
  set data_corte = v_inicio - 1, saldo_inicial_pendente_desde = now()
  where pluggy_account_id = p_pluggy_account_id;

  return v_fonte_id;
end;
$$;

-- ---------- alterar_corte_conta ----------

create function alterar_corte_conta(p_pluggy_account_id text, p_data_inicio date) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conta pluggy_contas;
  v_corte date := p_data_inicio - 1;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_conta from pluggy_contas
  where pluggy_account_id = p_pluggy_account_id and user_id = v_user_id
  for update;
  if not found or v_conta.data_corte is null
     or not exists (select 1 from fontes where pluggy_account_id = p_pluggy_account_id) then
    raise exception 'CONTA_NAO_VINCULADA' using errcode = 'P0001';
  end if;
  if p_data_inicio is null or p_data_inicio > current_date then
    raise exception 'CORTE_INVALIDO' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from transacoes_importadas
    where pluggy_account_id = p_pluggy_account_id and data <= v_corte
      and (estado = 'confirmada' or entrada_id is not null or saida_id is not null)
  ) then
    raise exception 'CORTE_COM_CONFIRMADAS' using errcode = 'P0001';
  end if;

  -- Fora da nova janela e nunca confirmadas: somem.
  delete from transacoes_importadas
  where pluggy_account_id = p_pluggy_account_id and data <= v_corte;

  if v_conta.saldo_inicial_entrada_id is not null then
    delete from entradas where id = v_conta.saldo_inicial_entrada_id;
  end if;
  if v_conta.saldo_inicial_saida_id is not null then
    delete from saidas where id = v_conta.saldo_inicial_saida_id;
  end if;

  update pluggy_contas
  set data_corte = v_corte,
      saldo_inicial_entrada_id = null,
      saldo_inicial_saida_id = null,
      saldo_inicial_pendente_desde = now()
  where pluggy_account_id = p_pluggy_account_id;
end;
$$;

-- ---------- aplicar_saldos_iniciais_pendentes ----------
-- Só aplica quando uma sincronização bem-sucedida começou depois da marca: aí as
-- importadas e o saldo Pluggy da conta são da mesma leitura.

create function aplicar_saldos_iniciais_pendentes() returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conta pluggy_contas;
  v_fonte_id uuid;
  v_alvo bigint;
  v_abertura bigint;
  v_categoria_id uuid;
  v_entrada_id uuid;
  v_resultado jsonb;
  v_aplicadas int := 0;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  for v_conta in
    select c.* from pluggy_contas c
    where c.user_id = v_user_id
      and c.saldo_inicial_pendente_desde is not null
      and c.data_corte is not null
      and exists (
        select 1 from sincronizacoes s
        where s.user_id = v_user_id and s.sucesso
          and s.iniciada_em > c.saldo_inicial_pendente_desde
      )
    for update of c
  loop
    select id into v_fonte_id from fontes where pluggy_account_id = v_conta.pluggy_account_id;
    continue when v_fonte_id is null;

    -- Saldo Pluggy no padrão do app: cartão = −dívida.
    v_alvo := case when v_conta.tipo = 'CREDIT' then -v_conta.saldo_centavos else v_conta.saldo_centavos end;
    v_abertura := v_alvo - coalesce((
      select sum(efeito_importada(t.direcao, t.valor_centavos))
      from transacoes_importadas t
      where t.pluggy_account_id = v_conta.pluggy_account_id and t.data > v_conta.data_corte
        and not parcela_anterior_ao_corte(t.parcela, t.data_compra, v_conta.data_corte)
    ), 0);

    v_entrada_id := null;
    v_resultado := null;
    if v_abertura > 0 then
      insert into entradas (user_id, fonte_id, titulo, valor_centavos, data)
      values (v_user_id, v_fonte_id, 'Saldo inicial', v_abertura, v_conta.data_corte)
      returning id into v_entrada_id;
    elsif v_abertura < 0 and v_conta.tipo = 'CREDIT' then
      select id into v_categoria_id from categorias
      where user_id = v_user_id and nome = 'Ajuste de saldo';
      if not found then
        insert into categorias (user_id, nome) values (v_user_id, 'Ajuste de saldo')
        returning id into v_categoria_id;
      end if;
      v_resultado := criar_saida(
        p_titulo => 'Fatura em aberto (saldo inicial)',
        p_valor_total_centavos => -v_abertura,
        p_categoria_id => v_categoria_id,
        p_data => v_conta.data_corte,
        p_splits => jsonb_build_array(
          jsonb_build_object('fonte_id', v_fonte_id, 'valor_centavos', -v_abertura)
        )
      );
    end if;
    -- Conta com abertura negativa não lança (RN-02); a conciliação mostra a diferença.

    update pluggy_contas
    set saldo_inicial_entrada_id = v_entrada_id,
        saldo_inicial_saida_id = (v_resultado->>'saida_id')::uuid,
        saldo_inicial_pendente_desde = null
    where pluggy_account_id = v_conta.pluggy_account_id;
    v_aplicadas := v_aplicadas + 1;
  end loop;

  return v_aplicadas;
end;
$$;

-- ---------- v_importadas_pendentes: + sugestão de ignorar parcela anterior ao corte ----------

create or replace view v_importadas_pendentes as
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
  )                   as categoria_sugerida_id,
  t.data_compra,
  coalesce(parcela_anterior_ao_corte(t.parcela, t.data_compra, c.data_corte), false)
                      as sugerir_ignorar_parcela
from transacoes_importadas t
left join fontes f on f.pluggy_account_id = t.pluggy_account_id
left join pluggy_contas c on c.pluggy_account_id = t.pluggy_account_id
where t.estado in ('pendente', 'divergente');

alter view v_importadas_pendentes set (security_invoker = true);

-- ---------- par de pagamento de fatura ----------

create view v_pares_pagamento_fatura as
select
  b.user_id,
  b.id                as banco_id,
  c.id                as cartao_id,
  fb.id               as fonte_pagadora_id,
  fc.id               as cartao_fonte_id,
  b.valor_centavos,
  b.data              as data,
  c.data              as data_cartao
from transacoes_importadas b
join pluggy_contas cb on cb.pluggy_account_id = b.pluggy_account_id and cb.tipo = 'BANK'
join fontes fb on fb.pluggy_account_id = b.pluggy_account_id
join transacoes_importadas c
  on c.user_id = b.user_id
 and c.valor_centavos = b.valor_centavos
 and c.direcao = 'entrada'
 and c.estado = 'pendente'
 and abs(c.data - b.data) <= 3
join pluggy_contas cc on cc.pluggy_account_id = c.pluggy_account_id and cc.tipo = 'CREDIT'
join fontes fc on fc.pluggy_account_id = c.pluggy_account_id and fc.eh_cartao
where b.direcao = 'saida'
  and b.estado = 'pendente';

alter view v_pares_pagamento_fatura set (security_invoker = true);

create function confirmar_pagamento_fatura(p_banco_id uuid, p_cartao_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_par v_pares_pagamento_fatura;
  v_resultado jsonb;
  v_entrada_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  perform 1 from transacoes_importadas
  where id in (p_banco_id, p_cartao_id) and user_id = v_user_id
  for update;

  select * into v_par from v_pares_pagamento_fatura
  where banco_id = p_banco_id and cartao_id = p_cartao_id and user_id = v_user_id;
  if not found then
    raise exception 'PAR_INVALIDO' using errcode = 'P0001';
  end if;

  v_resultado := confirmar_fatura_cartao(
    p_cartao_fonte_id => v_par.cartao_fonte_id,
    p_fonte_pagadora_id => v_par.fonte_pagadora_id,
    p_valor_centavos => v_par.valor_centavos,
    p_data => v_par.data
  );

  select id into v_entrada_id from entradas
  where fonte_id = v_par.cartao_fonte_id and eh_pagamento_fatura
    and valor_centavos = v_par.valor_centavos and data = v_par.data
  order by created_at desc
  limit 1;

  update transacoes_importadas
  set estado = 'confirmada', saida_id = (v_resultado->>'saida_id')::uuid, updated_at = now()
  where id = p_banco_id;
  update transacoes_importadas
  set estado = 'confirmada', entrada_id = v_entrada_id, updated_at = now()
  where id = p_cartao_id;

  return v_resultado;
end;
$$;

-- ---------- conciliação app × Pluggy ----------

create view v_conciliacao_contas as
select
  c.user_id,
  c.pluggy_account_id,
  f.id                as fonte_id,
  v.saldo_centavos    as saldo_app_centavos,
  coalesce((
    select sum(efeito_importada(t.direcao, t.valor_centavos))
    from transacoes_importadas t
    where t.pluggy_account_id = c.pluggy_account_id
      and t.estado = 'pendente'
      and t.data > c.data_corte
      and not parcela_anterior_ao_corte(t.parcela, t.data_compra, c.data_corte)
  ), 0)::bigint       as pendentes_centavos,
  (case when c.tipo = 'CREDIT' then -c.saldo_centavos else c.saldo_centavos end)::bigint
                      as saldo_pluggy_centavos,
  c.saldo_inicial_pendente_desde is not null as saldo_inicial_pendente
from pluggy_contas c
join fontes f on f.pluggy_account_id = c.pluggy_account_id
join v_saldo_fontes v on v.fonte_id = f.id
where c.data_corte is not null;

alter view v_conciliacao_contas set (security_invoker = true);

grant select on v_pares_pagamento_fatura, v_conciliacao_contas to authenticated;
grant execute on function
  efeito_importada(text, bigint),
  parcela_anterior_ao_corte(smallint, date, date),
  vincular_conta_pluggy(text, uuid, jsonb, date),
  alterar_corte_conta(text, date),
  aplicar_saldos_iniciais_pendentes(),
  confirmar_pagamento_fatura(uuid, uuid)
  to authenticated;

commit;
