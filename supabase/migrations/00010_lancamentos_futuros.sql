-- ============ M14: lançamentos futuros não contam no saldo ============

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
  from entradas
  where data <= current_date
  group by fonte_id
) e on e.fonte_id = f.id
left join (
  select sp.fonte_id, sum(sp.valor_centavos) as total
  from saida_splits sp
  join saidas sa on sa.id = sp.saida_id
  where sa.data <= current_date
  group by sp.fonte_id
) s on s.fonte_id = f.id;

alter view v_saldo_fontes set (security_invoker = true);

create or replace view v_saldo_categorias as
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
  where data <= current_date
  group by categoria_id
) g on g.categoria_id = c.id;

alter view v_saldo_categorias set (security_invoker = true);
