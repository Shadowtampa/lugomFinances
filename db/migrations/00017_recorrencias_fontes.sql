-- M27 — Meio de pagamento previsto da recorrência. Ver .specs/27-meio-pagamento-recorrencia.md.
-- Só autocontrole: quais Fontes devem pagar a recorrência, sem valores e sem efeito em saldo.

create table recorrencias_fontes (
  recorrencia_id uuid not null references recorrencias(id) on delete cascade,
  fonte_id uuid not null references fontes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recorrencia_id, fonte_id)
);

alter table recorrencias_fontes enable row level security;

create policy "own_recorrencias_fontes" on recorrencias_fontes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger trg_recorrencias_fontes_user_id
  before insert on recorrencias_fontes
  for each row execute function set_user_id_from_auth();

-- Troca o conjunto inteiro de uma vez. Lista vazia remove o meio previsto.
create function definir_fontes_recorrencia(p_recorrencia_id uuid, p_fonte_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ids uuid[] := array(select distinct unnest(coalesce(p_fonte_ids, '{}')));
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not exists (select 1 from recorrencias where id = p_recorrencia_id and user_id = v_user_id) then
    raise exception 'RECORRENCIA_INVALIDA' using errcode = 'P0001';
  end if;
  if (select count(*) from fontes where id = any(v_ids) and user_id = v_user_id) <> cardinality(v_ids) then
    raise exception 'FONTE_INVALIDA' using errcode = 'P0001';
  end if;

  delete from recorrencias_fontes where recorrencia_id = p_recorrencia_id;
  insert into recorrencias_fontes (recorrencia_id, fonte_id, user_id)
  select p_recorrencia_id, unnest(v_ids), v_user_id;
end;
$$;

-- v_recorrencias_mes ganha fontes_previstas (ids, em ordem de nome) no fim.
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
  )                   as fontes_previstas
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

grant select, insert, update, delete on recorrencias_fontes to authenticated;
grant execute on function definir_fontes_recorrencia(uuid, uuid[]) to authenticated;
