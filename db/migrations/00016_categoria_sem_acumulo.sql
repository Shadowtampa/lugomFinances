-- M25 — Limite de Categoria sem acúmulo. Ver .specs/25-categoria-sem-acumulo.md.
-- Antes: saldo = limite × meses_ativos − Σ saídas de sempre (triplicava com 3 meses de vigência).
-- Agora (RN-05): saldo = limite mensal − gasto do mês corrente; zera todo dia 1º.
-- As RPCs (criar_saida, confirmar_fatura_cartao...) só leem saldo_disponivel_centavos e
-- gasto_mes_atual_centavos, que continuam existindo com a nova regra.

drop view v_saldo_categorias;

create view v_saldo_categorias as
select
  c.id            as categoria_id,
  c.user_id,
  c.nome,
  c.cor,
  c.arquivada,
  c.limite_mensal_centavos,
  coalesce(g.total_mes, 0) as gasto_mes_atual_centavos,
  case when c.limite_mensal_centavos is null then null
       else c.limite_mensal_centavos - coalesce(g.total_mes, 0) end
                  as saldo_disponivel_centavos
from categorias c
left join (
  select categoria_id, sum(valor_total_centavos) as total_mes
  from saidas
  where data >= date_trunc('month', current_date) and data <= current_date
  group by categoria_id
) g on g.categoria_id = c.id;

alter view v_saldo_categorias set (security_invoker = true);
grant select on v_saldo_categorias to authenticated;

-- vigencia_inicio só servia para contar meses do acúmulo.
alter table categorias drop column vigencia_inicio;
