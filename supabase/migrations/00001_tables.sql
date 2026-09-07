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

-- ============ índices ============
create index on entradas (user_id, fonte_id);
create index on entradas (user_id, data);
create index on entradas (template_id) where template_id is not null;
create index on saidas (user_id, categoria_id);
create index on saidas (user_id, data);
create index on saidas (template_id) where template_id is not null;
create index on saida_splits (fonte_id);
create index on saida_splits (saida_id);
