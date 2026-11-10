-- M31 — Dashboard analítico. Spec: issue #17.
-- Duas views de SOMAS por dia (as fórmulas ficam em src/lib/indicadores.ts).
-- Fora das somas: pagamento de fatura (os dois lados), saldo inicial lançado pela Pluggy e
-- lançamentos futuros (RN-14). Entradas em Fonte cartão (estorno/crédito) não são renda e
-- também ficam de fora. Só leitura: nada aqui altera saldo ou regra de outro módulo.

begin;

create view v_saidas_dia_categoria as
select
  s.user_id,
  s.data,
  s.categoria_id,
  sum(s.valor_total_centavos)::bigint as total_centavos,
  count(*)::bigint                    as quantidade
from saidas s
where not s.eh_pagamento_fatura
  and s.data <= current_date
  and not exists (select 1 from pluggy_contas c where c.saldo_inicial_saida_id = s.id)
group by s.user_id, s.data, s.categoria_id;

create view v_entradas_dia_fonte as
select
  e.user_id,
  e.data,
  e.fonte_id,
  sum(e.valor_centavos)::bigint as total_centavos,
  count(*)::bigint              as quantidade
from entradas e
join fontes f on f.id = e.fonte_id
where not e.eh_pagamento_fatura
  and not f.eh_cartao
  and e.data <= current_date
  and not exists (select 1 from pluggy_contas c where c.saldo_inicial_entrada_id = e.id)
group by e.user_id, e.data, e.fonte_id;

alter view v_saidas_dia_categoria set (security_invoker = true);
alter view v_entradas_dia_fonte set (security_invoker = true);

grant select on v_saidas_dia_categoria, v_entradas_dia_fonte to authenticated;

commit;
