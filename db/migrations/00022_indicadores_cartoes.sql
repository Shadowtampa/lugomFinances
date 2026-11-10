-- M32 — Dashboard: Cartões e meios de pagamento. Spec: issue #18.
-- Só leitura: três views de apoio. As fórmulas ficam em src/lib/indicadores.ts.
--   v_saidas_fonte: uma linha por split de Saída (rateio por Fonte), sem fatura/saldo inicial/futuros.
--   v_pagamentos_fatura_mes: pagamentos de fatura por cartão e mês (a "fatura" do mês).
--   v_parcelas_cartao_restantes: parcelas de compra no cartão que ainda vão vencer, a partir
--     do maior número de parcela já importado de cada compra (a Pluggy não traz as futuras).

begin;

create view v_saidas_fonte as
select
  s.user_id,
  s.id            as saida_id,
  s.data,
  sp.fonte_id,
  s.categoria_id,
  s.titulo,
  sp.valor_centavos
from saidas s
join saida_splits sp on sp.saida_id = s.id
where not s.eh_pagamento_fatura
  and s.data <= current_date
  and not exists (select 1 from pluggy_contas c where c.saldo_inicial_saida_id = s.id);

create view v_pagamentos_fatura_mes as
select
  e.user_id,
  e.fonte_id,
  date_trunc('month', e.data)::date as mes,
  sum(e.valor_centavos)::bigint     as total_centavos
from entradas e
join fontes f on f.id = e.fonte_id
where e.eh_pagamento_fatura
  and f.eh_cartao
  and e.data <= current_date
group by e.user_id, e.fonte_id, date_trunc('month', e.data);

create view v_parcelas_cartao_restantes as
select
  u.user_id,
  u.fonte_id,
  u.descricao,
  u.parcela,
  u.total_parcelas,
  (u.total_parcelas - u.parcela)::int as restantes,
  u.valor_centavos                    as valor_parcela_centavos,
  greatest(
    (date_trunc('month', u.data) + interval '1 month')::date,
    date_trunc('month', current_date)::date
  )                                   as proximo_mes
from (
  select distinct on (t.user_id, f.id, t.descricao, t.total_parcelas, coalesce(t.data_compra, t.data))
    t.user_id, f.id as fonte_id, t.descricao, t.parcela, t.total_parcelas, t.valor_centavos, t.data
  from transacoes_importadas t
  join fontes f on f.pluggy_account_id = t.pluggy_account_id and f.user_id = t.user_id
  where t.direcao = 'saida'
    and t.parcela is not null
    and t.total_parcelas is not null
  order by t.user_id, f.id, t.descricao, t.total_parcelas, coalesce(t.data_compra, t.data), t.parcela desc, t.data desc
) u
where u.parcela < u.total_parcelas;

alter view v_saidas_fonte set (security_invoker = true);
alter view v_pagamentos_fatura_mes set (security_invoker = true);
alter view v_parcelas_cartao_restantes set (security_invoker = true);

grant select on v_saidas_fonte, v_pagamentos_fatura_mes, v_parcelas_cartao_restantes to authenticated;

commit;
