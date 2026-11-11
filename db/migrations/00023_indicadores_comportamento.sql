-- M33 — Dashboard: Comportamento financeiro. Spec: issue #19.
-- Uma linha por Saída (mesmas exclusões do M31: sem pagamento de fatura, saldo inicial da
-- Pluggy e lançamentos futuros), com a chave e o nome do estabelecimento já com o apelido do
-- M22 aplicado na leitura (título editado à mão vence). Só leitura.

begin;

create view v_saidas_lancamento as
select
  s.user_id,
  s.id as saida_id,
  s.data,
  coalesce(chave_estabelecimento(s), 'titulo:' || lower(btrim(s.titulo))) as chave,
  coalesce(apelido_estabelecimento(s), s.titulo)                           as nome,
  s.valor_total_centavos
from saidas s
where not s.eh_pagamento_fatura
  and s.data <= current_date
  and not exists (select 1 from pluggy_contas c where c.saldo_inicial_saida_id = s.id);

alter view v_saidas_lancamento set (security_invoker = true);
grant select on v_saidas_lancamento to authenticated;

commit;
