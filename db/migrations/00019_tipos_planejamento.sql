-- M29 — Tipo de Planejamento. Ver issue #10.
-- Classificação obrigatória de cada recorrência (Planejamento na UI). Só rótulo/filtro:
-- não muda o acompanhamento mensal nem afeta saldo.

begin;

create table tipos_planejamento (
  id smallint primary key,
  slug text not null unique,
  nome text not null,
  ordem smallint not null unique
);

insert into tipos_planejamento (id, slug, nome, ordem) values
  (1, 'assinaturas',    'Assinaturas',           1),
  (2, 'transferencias', 'Transferências manuais', 2),
  (3, 'parcelados',     'Compras parceladas',    3),
  (4, 'dividas',        'Dívidas',               4),
  (5, 'contas',         'Contas',                5);

-- Tabela global (sem user_id): qualquer usuário autenticado lê; ninguém escreve.
-- Só existe policy de select: com RLS ligada, insert/update/delete são negados. (Não adianta
-- `revoke`: 99999_grants.sql devolve DML a todas as tabelas; a RLS é a proteção real.)
alter table tipos_planejamento enable row level security;

create policy "ler_tipos_planejamento" on tipos_planejamento
  for select to authenticated using (true);

-- Registros existentes viram "Contas" (id 5); depois a coluna fica obrigatória, sem default.
alter table recorrencias
  add column tipo_planejamento_id smallint not null default 5
  references tipos_planejamento(id);

alter table recorrencias alter column tipo_planejamento_id drop default;

create index on recorrencias (tipo_planejamento_id);

-- v_recorrencias_mes ganha tipo_planejamento_id no fim.
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
  s.data              as saida_data,
  r.tipo_planejamento_id
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
  and (r.ativa or p.id is not null);

alter view v_recorrencias_mes set (security_invoker = true);

-- Pago / previsto / falta por competência e Tipo (cards da tela). Mesmas regras do front:
-- pago = valor real da Saída ligada, senão o previsto; falta = previsto das não pagas.
create or replace view v_planejamento_resumo as
select
  user_id,
  competencia,
  tipo_planejamento_id,
  count(*)::int as quantidade,
  coalesce(sum(valor_previsto_centavos), 0)::bigint as previsto_centavos,
  coalesce(sum(coalesce(valor_pago_centavos, valor_previsto_centavos)) filter (where pagamento_id is not null), 0)::bigint as pago_centavos,
  coalesce(sum(valor_previsto_centavos) filter (where pagamento_id is null), 0)::bigint as falta_centavos
from v_recorrencias_mes
group by user_id, competencia, tipo_planejamento_id;

alter view v_planejamento_resumo set (security_invoker = true);

commit;
