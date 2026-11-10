-- M30 — Planejamento por Duração e Forma de pagamento. Spec: issue #12.
-- Troca o Tipo de Planejamento (M29) por dois eixos independentes:
--   Duração: derivada de total_parcelas (nulo = recorrente, preenchido = parcelado);
--   Forma de pagamento: manual (usuário transfere) ou automática (cartão/débito).
-- Só classificação: não afeta saldo nem o acompanhamento mensal.

begin;

alter table recorrencias
  add column forma_pagamento text not null default 'manual'
  constraint recorrencias_forma_pagamento_valida check (forma_pagamento in ('manual', 'automatica'));

-- Preenchimento: Transferências manuais (Tipo 2) ficam manuais; quem tem Fonte prevista de
-- cartão vira automática; o resto fica manual (o usuário corrige na tela).
update recorrencias r
set forma_pagamento = 'automatica'
where r.tipo_planejamento_id <> 2
  and exists (
    select 1 from recorrencias_fontes rf
    join fontes f on f.id = rf.fonte_id
    where rf.recorrencia_id = r.id and f.eh_cartao
  );

-- Views dependentes saem antes de remover o Tipo (v_sugestoes_recorrencia lê v_recorrencias_mes).
drop view v_sugestoes_recorrencia;
drop view v_planejamento_resumo;
drop view v_recorrencias_mes;

alter table recorrencias drop column tipo_planejamento_id;
drop table tipos_planejamento;

create view v_recorrencias_mes as
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
  r.forma_pagamento
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

create view v_sugestoes_recorrencia as
select t.id as transacao_id, t.user_id, r.recorrencia_id, r.titulo, r.competencia
from transacoes_importadas t
join v_recorrencias_mes r
  on r.user_id = t.user_id
 and r.competencia = date_trunc('month', t.data::timestamptz)::date
 and r.pagamento_id is null
 and r.valor_previsto_centavos = t.valor_centavos
where t.estado = 'pendente' and t.direcao = 'saida';

alter view v_sugestoes_recorrencia set (security_invoker = true);

-- Pago / previsto / falta por competência, forma de pagamento e duração (cards da tela).
-- pago = valor real da Saída ligada, senão o previsto; falta = previsto das não pagas.
create view v_planejamento_resumo as
select
  user_id,
  competencia,
  forma_pagamento,
  (total_parcelas is null) as recorrente,
  count(*)::int as quantidade,
  coalesce(sum(valor_previsto_centavos), 0)::bigint as previsto_centavos,
  coalesce(sum(coalesce(valor_pago_centavos, valor_previsto_centavos)) filter (where pagamento_id is not null), 0)::bigint as pago_centavos,
  coalesce(sum(valor_previsto_centavos) filter (where pagamento_id is null), 0)::bigint as falta_centavos
from v_recorrencias_mes
group by user_id, competencia, forma_pagamento, (total_parcelas is null);

alter view v_planejamento_resumo set (security_invoker = true);

commit;
