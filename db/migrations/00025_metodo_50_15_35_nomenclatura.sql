-- M34 (ajuste 2.14.1) — Nomenclatura do método 50-15-35 da Nathalia Arcuri (Me Poupe!).
-- 50% Essenciais, 15% Prioridades (quitar dívidas e investir), 35% Estilo de vida. Spec na issue #20.
-- Renomear o valor do enum preserva as classificações já feitas em categoria_grupos.

alter type grupo_orcamentario rename value 'necessidades' to 'essenciais';
alter type grupo_orcamentario rename value 'investimentos' to 'prioridades';
alter type grupo_orcamentario rename value 'desejos' to 'estilo_de_vida';

drop view v_adesao_50_15_35;

-- Mesmo cálculo da 00024; só mudam os grupos e os nomes das colunas.
create view v_adesao_50_15_35 as
with entradas_mes as (
  select user_id, sum(valor_centavos) as total_centavos
  from entradas
  where data >= date_trunc('month', current_date) and data <= current_date
    and not eh_pagamento_fatura
  group by user_id
),
saidas_mes as (
  select
    s.user_id,
    sum(s.valor_total_centavos) filter (where cg.grupo = 'essenciais')     as essenciais,
    sum(s.valor_total_centavos) filter (where cg.grupo = 'prioridades')    as prioridades,
    sum(s.valor_total_centavos) filter (where cg.grupo = 'estilo_de_vida') as estilo_de_vida,
    sum(s.valor_total_centavos) filter (where cg.grupo is null)            as nao_classificado
  from saidas s
  left join categoria_grupos cg on cg.categoria_id = s.categoria_id
  where s.data >= date_trunc('month', current_date) and s.data <= current_date
    and not s.eh_pagamento_fatura
  group by s.user_id
)
select
  em.user_id,
  em.total_centavos                    as total_entradas_mes_centavos,
  coalesce(sm.essenciais, 0)           as gasto_essenciais_centavos,
  coalesce(sm.prioridades, 0)          as gasto_prioridades_centavos,
  coalesce(sm.estilo_de_vida, 0)       as gasto_estilo_de_vida_centavos,
  coalesce(sm.nao_classificado, 0)     as gasto_nao_classificado_centavos
from entradas_mes em
left join saidas_mes sm on sm.user_id = em.user_id;

alter view v_adesao_50_15_35 set (security_invoker = true);

grant select on v_adesao_50_15_35 to authenticated;
