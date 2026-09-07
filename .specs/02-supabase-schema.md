# M2 — Supabase: Schema, Views, RPC e RLS

**Objetivo:** o banco inteiro pronto e testável direto pelo SQL Editor do Supabase,
antes de qualquer linha de frontend consumir dados. Ao fim deste milestone, todas as
regras de negócio bloqueantes já existem **no banco** — o frontend não é a fonte da
verdade.

**Pré-requisitos:** M1 concluído. Projeto criado no Supabase.

---

## Escopo

**Dentro:** extensões, tabelas, constraints, índices, views de saldo, função RPC de
criação de saída, RLS em tudo, script de seed.

**Fora:** frontend, autenticação de UI.

---

## Princípio de arquitetura

Toda validação bloqueante (RN-02, RN-03) mora numa função Postgres, não no React. O
frontend valida **antes** só para dar feedback rápido; o banco valida **de novo** e é
quem manda. Isso significa que mesmo que alguém chame a API na mão, não consegue
furar as regras.

---

## Tarefas

### 2.1 Migrations

Usar migrations versionadas (Supabase CLI, `supabase/migrations/`). Nada de rodar SQL
solto no editor sem salvar o arquivo. Cada bloco abaixo é uma migration.

### 2.2 Tabelas

```sql
-- ============ categorias ============
create table categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  limite_mensal_centavos bigint,              -- null = sem limite
  vigencia_inicio date not null default date_trunc('month', current_date),
  cor text not null default '#5C6B64',
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  constraint categorias_nome_unico unique (user_id, nome),
  constraint categorias_limite_positivo check (
    limite_mensal_centavos is null or limite_mensal_centavos >= 0
  )
);

-- ============ fontes ============
create type fonte_tipo as enum ('livre', 'restrita');

create table fontes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  tipo fonte_tipo not null default 'livre',
  cor text not null default '#0F6E4F',
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  constraint fontes_nome_unico unique (user_id, nome)
);

-- ============ fonte_categorias (N:N, só p/ fontes restritas) ============
create table fonte_categorias (
  fonte_id uuid not null references fontes(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete cascade,
  primary key (fonte_id, categoria_id)
);

-- ============ entradas ============
create table entradas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fonte_id uuid not null references fontes(id) on delete restrict,
  titulo text not null,
  valor_centavos bigint not null,
  data date not null default current_date,
  recorrente boolean not null default false,
  dia_recorrencia smallint,
  recorrencia_ativa boolean not null default true,
  template_id uuid references entradas(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint entradas_valor_positivo check (valor_centavos > 0),
  constraint entradas_dia_valido check (
    dia_recorrencia is null or dia_recorrencia between 1 and 31
  ),
  constraint entradas_recorrente_tem_dia check (
    not recorrente or dia_recorrencia is not null
  )
);

-- ============ saidas ============
create table saidas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete restrict,
  titulo text not null,
  valor_total_centavos bigint not null,
  data date not null default current_date,
  recorrente boolean not null default false,
  dia_recorrencia smallint,
  recorrencia_ativa boolean not null default true,
  template_id uuid references saidas(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint saidas_valor_positivo check (valor_total_centavos > 0),
  constraint saidas_dia_valido check (
    dia_recorrencia is null or dia_recorrencia between 1 and 31
  ),
  constraint saidas_recorrente_tem_dia check (
    not recorrente or dia_recorrencia is not null
  )
);

-- ============ saida_splits ============
create table saida_splits (
  id uuid primary key default gen_random_uuid(),
  saida_id uuid not null references saidas(id) on delete cascade,
  fonte_id uuid not null references fontes(id) on delete restrict,
  valor_centavos bigint not null,
  constraint splits_valor_positivo check (valor_centavos > 0),
  constraint splits_fonte_unica_por_saida unique (saida_id, fonte_id)
);
```

**Índices:**
```sql
create index on entradas (user_id, fonte_id);
create index on entradas (user_id, data);
create index on entradas (template_id) where template_id is not null;
create index on saidas (user_id, categoria_id);
create index on saidas (user_id, data);
create index on saidas (template_id) where template_id is not null;
create index on saida_splits (fonte_id);
create index on saida_splits (saida_id);
```

**Sobre `template_id`:** um lançamento com `recorrente = true` é o **template**. Os
lançamentos gerados a partir dele nos meses seguintes têm `recorrente = false` e
`template_id` apontando para o template. O template também conta como o lançamento
do próprio mês em que foi criado.

### 2.3 Views de saldo

```sql
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
```

```sql
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
```

```sql
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
```

> **`saldo_livre` é a resposta ao problema original.** É a soma só das fontes livres.
> Se entrar R$ 100 avulsos numa fonte livre, eles aumentam o disponível geral sem
> tocar no VR. E o VR aparece separado, sem inflar o "posso gastar".

```sql
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
```

**Importante:** views herdam RLS das tabelas base quando criadas com
`security_invoker = true`. Definir isso em todas:

```sql
alter view v_saldo_fontes set (security_invoker = true);
alter view v_saldo_categorias set (security_invoker = true);
alter view v_resumo_geral set (security_invoker = true);
alter view v_recorrencias_pendentes set (security_invoker = true);
```

### 2.4 RPC `criar_saida`

O núcleo do sistema. Valida e grava numa transação só.

```sql
create or replace function criar_saida(
  p_titulo text,
  p_valor_total_centavos bigint,
  p_categoria_id uuid,
  p_data date,
  p_splits jsonb,               -- [{"fonte_id":"...","valor_centavos":1000}, ...]
  p_recorrente boolean default false,
  p_dia_recorrencia smallint default null,
  p_template_id uuid default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_saida_id uuid;
  v_soma bigint;
  v_split jsonb;
  v_fonte record;
  v_saldo bigint;
  v_permitida boolean;
  v_resultado jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- valida categoria pertence ao usuário
  if not exists (
    select 1 from categorias
    where id = p_categoria_id and user_id = v_user_id
  ) then
    raise exception 'CATEGORIA_INVALIDA' using errcode = 'P0001';
  end if;

  -- RN-01: soma dos splits = total
  select coalesce(sum((s->>'valor_centavos')::bigint), 0)
    into v_soma
  from jsonb_array_elements(p_splits) s;

  if v_soma <> p_valor_total_centavos then
    raise exception 'SPLIT_SOMA_DIVERGENTE: esperado %, recebido %',
      p_valor_total_centavos, v_soma using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_splits) = 0 then
    raise exception 'SPLIT_VAZIO' using errcode = 'P0001';
  end if;

  -- valida cada split ANTES de inserir qualquer coisa
  for v_split in select * from jsonb_array_elements(p_splits) loop
    select f.*, v.saldo_centavos into v_fonte
    from fontes f
    join v_saldo_fontes v on v.fonte_id = f.id
    where f.id = (v_split->>'fonte_id')::uuid
      and f.user_id = v_user_id;

    if not found then
      raise exception 'FONTE_INVALIDA: %', v_split->>'fonte_id'
        using errcode = 'P0001';
    end if;

    -- RN-03: fonte restrita só aceita categorias permitidas
    if v_fonte.tipo = 'restrita' then
      select exists (
        select 1 from fonte_categorias
        where fonte_id = v_fonte.id and categoria_id = p_categoria_id
      ) into v_permitida;

      if not v_permitida then
        raise exception
          'CATEGORIA_NAO_PERMITIDA_NA_FONTE: fonte=% categoria=%',
          v_fonte.nome, p_categoria_id using errcode = 'P0001';
      end if;
    end if;

    -- RN-02: não deixa saldo negativo
    if v_fonte.saldo_centavos < (v_split->>'valor_centavos')::bigint then
      raise exception
        'SALDO_INSUFICIENTE: fonte=% saldo=% solicitado=%',
        v_fonte.nome, v_fonte.saldo_centavos,
        (v_split->>'valor_centavos')::bigint using errcode = 'P0001';
    end if;
  end loop;

  -- grava
  insert into saidas (
    user_id, categoria_id, titulo, valor_total_centavos, data,
    recorrente, dia_recorrencia, template_id
  ) values (
    v_user_id, p_categoria_id, p_titulo, p_valor_total_centavos, p_data,
    p_recorrente, p_dia_recorrencia, p_template_id
  ) returning id into v_saida_id;

  insert into saida_splits (saida_id, fonte_id, valor_centavos)
  select v_saida_id, (s->>'fonte_id')::uuid, (s->>'valor_centavos')::bigint
  from jsonb_array_elements(p_splits) s;

  -- RN-07: devolve saldos pós-lançamento
  select jsonb_build_object(
    'saida_id', v_saida_id,
    'fontes', (
      select jsonb_agg(jsonb_build_object(
        'fonte_id', v.fonte_id,
        'nome', v.nome,
        'tipo', v.tipo,
        'saldo_centavos', v.saldo_centavos
      ))
      from v_saldo_fontes v
      where v.fonte_id in (
        select (s->>'fonte_id')::uuid from jsonb_array_elements(p_splits) s
      )
    ),
    'categoria', (
      select jsonb_build_object(
        'categoria_id', c.categoria_id,
        'nome', c.nome,
        'limite_mensal_centavos', c.limite_mensal_centavos,
        'saldo_disponivel_centavos', c.saldo_disponivel_centavos,
        'gasto_mes_atual_centavos', c.gasto_mes_atual_centavos
      )
      from v_saldo_categorias c
      where c.categoria_id = p_categoria_id
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;
```

**Contrato de erro:** toda exceção começa com um código em SCREAMING_SNAKE antes do
`:`. O frontend (M8) faz o parsing desse prefixo para escolher a mensagem. Nunca
mostre a mensagem crua do Postgres pro usuário.

Códigos possíveis:
`AUTH_REQUIRED`, `CATEGORIA_INVALIDA`, `SPLIT_SOMA_DIVERGENTE`, `SPLIT_VAZIO`,
`FONTE_INVALIDA`, `CATEGORIA_NAO_PERMITIDA_NA_FONTE`, `SALDO_INSUFICIENTE`.

> **Nota sobre concorrência:** com um único usuário, a chance de corrida é
> desprezível. Se quiser blindar, adicionar `select ... from fontes where id = ...
> for update` antes de ler o saldo. Opcional no MVP.

### 2.5 RPC de exclusão e edição

`excluir_saida(p_saida_id uuid)` — remove a saída (splits caem por cascade).

`atualizar_saida(...)` — a forma mais segura é **deletar e recriar** dentro de uma
transação, reaproveitando `criar_saida`. Assim toda a validação roda de novo.
Implementar como `atualizar_saida` que chama `excluir_saida` + `criar_saida`.

Não é necessário RPC para entradas — `insert` direto via PostgREST resolve, já que
entrada não tem validação cruzada.

### 2.6 RLS

Habilitar em **todas** as tabelas e criar as políticas:

```sql
alter table categorias      enable row level security;
alter table fontes          enable row level security;
alter table fonte_categorias enable row level security;
alter table entradas        enable row level security;
alter table saidas          enable row level security;
alter table saida_splits    enable row level security;
```

Para `categorias`, `fontes`, `entradas`, `saidas` — política única por operação
usando `auth.uid() = user_id` em `using` e `with check`.

Para `fonte_categorias` e `saida_splits` (que não têm `user_id`), a política valida
por join no pai:

```sql
create policy "own_fonte_categorias" on fonte_categorias
for all using (
  exists (select 1 from fontes f where f.id = fonte_id and f.user_id = auth.uid())
) with check (
  exists (select 1 from fontes f where f.id = fonte_id and f.user_id = auth.uid())
  and exists (select 1 from categorias c where c.id = categoria_id and c.user_id = auth.uid())
);

create policy "own_saida_splits" on saida_splits
for all using (
  exists (select 1 from saidas s where s.id = saida_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from saidas s where s.id = saida_id and s.user_id = auth.uid())
);
```

### 2.7 Trigger de `user_id`

Para não depender do frontend mandar `user_id` certo, criar trigger `before insert`
nas tabelas com `user_id` que faz `new.user_id := auth.uid()` quando vier nulo.

### 2.8 Seed

Script `supabase/seed.sql` com dados realistas para desenvolvimento:

- Categorias: `Alimentação` (limite R$ 1.200), `Supermercado` (R$ 800),
  `Transporte` (R$ 300), `Moradia` (sem limite), `Lazer` (R$ 400), `Saúde` (sem limite)
- Fontes: `Conta Corrente` (livre), `VR Flash` (restrita → Alimentação, Supermercado),
  `Carteira` (livre)
- Entradas: salário R$ 5.000 recorrente dia 5 na Conta Corrente; VR R$ 900 recorrente
  dia 1 no VR Flash; freelance R$ 800 avulso na Conta Corrente
- Saídas: aluguel R$ 1.800 recorrente (Moradia, Conta Corrente); almoço R$ 45
  (Alimentação, VR Flash); Uber R$ 22 (Transporte, Conta Corrente)

---

## Testes manuais obrigatórios (SQL Editor)

Rodar e conferir o resultado de cada um:

1. `select * from v_saldo_fontes;` → Conta Corrente = 5000+800−1800−22 = R$ 3.978,00;
   VR Flash = 900−45 = R$ 855,00
2. `select * from v_resumo_geral;` → `saldo_livre` **não inclui** o VR
3. **Uber no VR deve falhar:** chamar `criar_saida` com categoria `Transporte` e split
   na fonte `VR Flash` → erro `CATEGORIA_NAO_PERMITIDA_NA_FONTE`
4. **Estouro de saldo deve falhar:** `criar_saida` de R$ 99.999 na Carteira (saldo 0)
   → erro `SALDO_INSUFICIENTE`
5. **Split que não fecha deve falhar:** total R$ 100, splits somando R$ 90 →
   `SPLIT_SOMA_DIVERGENTE`
6. **Split válido multi-fonte:** almoço de R$ 80 com R$ 50 do VR (Alimentação) e
   R$ 30 da Conta Corrente → sucesso, retorno traz os dois saldos
7. **Estouro de categoria não bloqueia:** gastar acima do limite de `Transporte` →
   grava normalmente, `saldo_disponivel_centavos` fica negativo
8. **RLS:** criar segundo usuário de teste e confirmar que ele enxerga zero linhas

---

## Critérios de aceite

- [ ] Todas as migrations aplicam do zero num banco limpo, na ordem, sem erro
- [ ] Os 8 testes acima passam com o resultado esperado
- [ ] `security_invoker = true` em todas as views
- [ ] RLS habilitada nas 6 tabelas; nenhuma tabela acessível sem sessão
- [ ] Nenhum valor monetário é `numeric`/`float` — tudo `bigint`
- [ ] Seed roda e popula um cenário completo

## Definition of Done

Migrations commitadas em `supabase/migrations/`, seed em `supabase/seed.sql`, e um
`docs/schema.md` curto listando tabelas, views e os códigos de erro do RPC.
