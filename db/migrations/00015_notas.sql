-- M24 — Notas em Saídas, Entradas e Recorrências. Ver .specs/24-notas.md.
-- A nota é texto livre, opcional, sem efeito em saldo, split ou limite.

alter table entradas add column nota text
  constraint entradas_nota_valida check (nota is null or length(nota) between 1 and 500);
alter table saidas add column nota text
  constraint saidas_nota_valida check (nota is null or length(nota) between 1 and 500);
alter table recorrencias add column nota text
  constraint recorrencias_nota_valida check (nota is null or length(nota) between 1 and 500);

-- Saída nunca é alterada direto pelo front (CLAUDE.md): a nota tem RPC própria, que não toca em
-- valor, data, Categoria nem splits — por isso não passa pela atualizar_saida.
create function definir_nota_saida(p_saida_id uuid, p_nota text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if length(coalesce(v_nota, '')) > 500 then
    raise exception 'NOTA_INVALIDA' using errcode = 'P0001';
  end if;

  update saidas set nota = v_nota where id = p_saida_id and user_id = v_user_id;
  if not found then
    raise exception 'SAIDA_INVALIDA' using errcode = 'P0001';
  end if;
end;
$$;

-- v_recorrencias_mes ganha a nota (fixa, da recorrência) no fim da lista de colunas.
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
  r.nota
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

grant execute on function definir_nota_saida(uuid, text) to authenticated;
