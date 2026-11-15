-- M34 — Método 50-15-35. Spec na issue #20.
-- Classificação opcional das Categorias existentes em 3 grupos (sem campo novo em categorias)
-- e a view de aderência do mês. Só leitura: nada aqui afeta saldo (RN-18).

create type grupo_orcamentario as enum ('necessidades', 'desejos', 'investimentos');

create table categoria_grupos (
  categoria_id uuid primary key references categorias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grupo grupo_orcamentario not null,
  created_at timestamptz not null default now()
);

create index on categoria_grupos (user_id, grupo);

create trigger trg_categoria_grupos_user_id
  before insert on categoria_grupos
  for each row execute function set_user_id_from_auth();

alter table categoria_grupos enable row level security;

-- o with check também exige a Categoria ser do usuário: sem isso daria para
-- classificar (e, pela PK, bloquear) a Categoria de outra pessoa
create policy "own_categoria_grupos" on categoria_grupos
for all using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from categorias c where c.id = categoria_id and c.user_id = auth.uid())
);

-- Renda e gasto do mês corrente, sem lançamentos futuros (RN-14) e sem pagamento de fatura:
-- a Entrada no cartão não é renda, e a Saída "Fatura" repetiria compras já contadas.
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
    sum(s.valor_total_centavos) filter (where cg.grupo = 'necessidades')  as necessidades,
    sum(s.valor_total_centavos) filter (where cg.grupo = 'desejos')       as desejos,
    sum(s.valor_total_centavos) filter (where cg.grupo = 'investimentos') as investimentos,
    sum(s.valor_total_centavos) filter (where cg.grupo is null)           as nao_classificado
  from saidas s
  left join categoria_grupos cg on cg.categoria_id = s.categoria_id
  where s.data >= date_trunc('month', current_date) and s.data <= current_date
    and not s.eh_pagamento_fatura
  group by s.user_id
)
select
  em.user_id,
  em.total_centavos                    as total_entradas_mes_centavos,
  coalesce(sm.necessidades, 0)         as gasto_necessidades_centavos,
  coalesce(sm.desejos, 0)              as gasto_desejos_centavos,
  coalesce(sm.investimentos, 0)        as gasto_investimentos_centavos,
  coalesce(sm.nao_classificado, 0)     as gasto_nao_classificado_centavos
from entradas_mes em
left join saidas_mes sm on sm.user_id = em.user_id;

alter view v_adesao_50_15_35 set (security_invoker = true);

grant select, insert, update, delete on categoria_grupos to authenticated;
grant select on v_adesao_50_15_35 to authenticated;
