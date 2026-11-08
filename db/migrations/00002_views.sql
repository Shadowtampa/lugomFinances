-- Saldo por fonte (RN-04): acumula desde sempre
create view v_saldo_fontes as
select
  f.id                as fonte_id,
  f.user_id,
  f.nome,
  f.tipo,
  f.cor,
  f.arquivada,
  coalesce(e.total, 0)  as total_entradas_centavos,
  coalesce(s.total, 0)  as total_saidas_centavos,
  coalesce(e.total, 0) - coalesce(s.total, 0) as saldo_centavos
from fontes f
left join (
  select fonte_id, sum(valor_centavos) as total
  from entradas group by fonte_id
) e on e.fonte_id = f.id
left join (
  select fonte_id, sum(valor_centavos) as total
  from saida_splits group by fonte_id
) s on s.fonte_id = f.id;

-- Saldo por categoria (RN-05): limite acumula mês a mês
create view v_saldo_categorias as
with meses as (
  select
    c.id,
    case when c.limite_mensal_centavos is null then null
    else (
      (extract(year from current_date) - extract(year from c.vigencia_inicio)) * 12
      + (extract(month from current_date) - extract(month from c.vigencia_inicio))
      + 1
    )::int end as meses_ativos
  from categorias c
)
select
  c.id            as categoria_id,
  c.user_id,
  c.nome,
  c.cor,
  c.arquivada,
  c.limite_mensal_centavos,
  m.meses_ativos,
  case when c.limite_mensal_centavos is null then null
       else c.limite_mensal_centavos * greatest(m.meses_ativos, 0) end
                  as limite_acumulado_centavos,
  coalesce(g.total_geral, 0)  as total_gasto_centavos,
  coalesce(g.total_mes, 0)    as gasto_mes_atual_centavos,
  case when c.limite_mensal_centavos is null then null
       else c.limite_mensal_centavos * greatest(m.meses_ativos, 0)
            - coalesce(g.total_geral, 0) end
                  as saldo_disponivel_centavos
from categorias c
join meses m on m.id = c.id
left join (
  select
    categoria_id,
    sum(valor_total_centavos) as total_geral,
    sum(valor_total_centavos) filter (
      where data >= date_trunc('month', current_date)
    ) as total_mes
  from saidas
  group by categoria_id
) g on g.categoria_id = c.id;

-- Resumo geral do topo do dashboard
create view v_resumo_geral as
select
  user_id,
  sum(saldo_centavos)                                          as saldo_total_centavos,
  sum(saldo_centavos) filter (where tipo = 'livre')             as saldo_livre_centavos,
  sum(saldo_centavos) filter (where tipo = 'restrita')          as saldo_restrito_centavos
from v_saldo_fontes
where arquivada = false
group by user_id;

-- Recorrências ainda não lançadas no mês corrente (RN-08)
create view v_recorrencias_pendentes as
select
  'entrada'::text as tipo_lancamento,
  t.id            as template_id,
  t.user_id,
  t.titulo,
  t.valor_centavos as valor_sugerido_centavos,
  t.dia_recorrencia,
  t.fonte_id,
  null::uuid      as categoria_id
from entradas t
where t.recorrente
  and t.recorrencia_ativa
  and date_trunc('month', t.data) < date_trunc('month', current_date)
  and not exists (
    select 1 from entradas g
    where g.template_id = t.id
      and date_trunc('month', g.data) = date_trunc('month', current_date)
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
  t.categoria_id
from saidas t
where t.recorrente
  and t.recorrencia_ativa
  and date_trunc('month', t.data) < date_trunc('month', current_date)
  and not exists (
    select 1 from saidas g
    where g.template_id = t.id
      and date_trunc('month', g.data) = date_trunc('month', current_date)
  );

alter view v_saldo_fontes set (security_invoker = true);
alter view v_saldo_categorias set (security_invoker = true);
alter view v_resumo_geral set (security_invoker = true);
alter view v_recorrencias_pendentes set (security_invoker = true);
