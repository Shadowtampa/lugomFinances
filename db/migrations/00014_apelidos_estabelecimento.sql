-- M22 — Apelidos de estabelecimento.
-- O apelido nunca é gravado no lançamento: é aplicado na leitura, casando pela chave derivada da
-- descrição da Pluggy. Ver .specs/22-apelidos-estabelecimento.md.

-- ---------- chave ----------

-- "Compra no débito - Esthneygomesguima     Santarem     Bra" -> "esthneygomesguima"
-- "Pix enviado  - Helana Miranda Da Cruz Gomes"               -> "helana miranda da cruz gomes"
create function chave_estabelecimento(p_descricao text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      btrim(regexp_replace(
        regexp_replace(
          regexp_replace(lower(p_descricao), '^[^-]*?\s-\s+', ''),
          '\s{2,}.*$', ''
        ),
        '\s+', ' ', 'g'
      )),
      ''
    ),
    lower(btrim(p_descricao))
  )
$$;

-- ---------- tabela ----------

create table apelidos_estabelecimento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chave text not null,
  apelido text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apelidos_estabelecimento_chave_unica unique (user_id, chave),
  constraint apelidos_estabelecimento_chave_valida check (length(chave) between 1 and 200),
  constraint apelidos_estabelecimento_apelido_valido
    check (length(apelido) between 1 and 60 and apelido = btrim(apelido))
);

alter table apelidos_estabelecimento enable row level security;

create policy "own_apelidos_estabelecimento" on apelidos_estabelecimento
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger trg_apelidos_estabelecimento_user_id
  before insert on apelidos_estabelecimento
  for each row execute function set_user_id_from_auth();

-- ---------- definir / remover ----------

create function definir_apelido(p_chave text, p_apelido text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_apelido text := nullif(btrim(coalesce(p_apelido, '')), '');
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if coalesce(btrim(p_chave), '') = '' or length(p_chave) > 200 or length(coalesce(v_apelido, '')) > 60 then
    raise exception 'APELIDO_INVALIDO' using errcode = 'P0001';
  end if;

  if v_apelido is null then
    delete from apelidos_estabelecimento where user_id = v_user_id and chave = p_chave;
    return;
  end if;

  insert into apelidos_estabelecimento (user_id, chave, apelido)
  values (v_user_id, p_chave, v_apelido)
  on conflict (user_id, chave)
  do update set apelido = excluded.apelido, updated_at = now();
end;
$$;

-- ---------- campos computados (PostgREST: select=*,apelido_estabelecimento,...) ----------

create function descricao_pluggy(s saidas)
returns text
language sql
stable
set search_path = public
as $$
  select t.descricao from transacoes_importadas t where t.saida_id = s.id limit 1
$$;

create function descricao_pluggy(e entradas)
returns text
language sql
stable
set search_path = public
as $$
  select t.descricao from transacoes_importadas t where t.entrada_id = e.id limit 1
$$;

create function chave_estabelecimento(s saidas)
returns text
language sql
stable
set search_path = public
as $$
  select chave_estabelecimento(descricao_pluggy(s))
$$;

create function chave_estabelecimento(e entradas)
returns text
language sql
stable
set search_path = public
as $$
  select chave_estabelecimento(descricao_pluggy(e))
$$;

-- Título editado à mão vence: só mostra o apelido enquanto o título é a descrição original.
create function apelido_estabelecimento(s saidas)
returns text
language sql
stable
set search_path = public
as $$
  select a.apelido
  from apelidos_estabelecimento a
  where a.user_id = s.user_id
    and s.titulo = descricao_pluggy(s)
    and a.chave = chave_estabelecimento(descricao_pluggy(s))
$$;

create function apelido_estabelecimento(e entradas)
returns text
language sql
stable
set search_path = public
as $$
  select a.apelido
  from apelidos_estabelecimento a
  where a.user_id = e.user_id
    and e.titulo = descricao_pluggy(e)
    and a.chave = chave_estabelecimento(descricao_pluggy(e))
$$;

-- ---------- importadas pendentes ----------

create or replace view v_importadas_pendentes as
select
  t.id,
  t.user_id,
  t.pluggy_transaction_id,
  t.pluggy_account_id,
  f.id                as fonte_id,
  t.data,
  t.descricao,
  t.valor_centavos,
  t.direcao,
  t.status_pluggy,
  t.categoria_pluggy,
  t.parcela,
  t.total_parcelas,
  t.estado,
  t.entrada_id,
  t.saida_id,
  (
    select s.categoria_id
    from transacoes_importadas t2
    join saidas s on s.id = t2.saida_id
    where t2.user_id = t.user_id
      and t2.estado = 'confirmada'
      and t2.direcao = 'saida'
      and lower(t2.descricao) = lower(t.descricao)
    order by t2.updated_at desc
    limit 1
  )                   as categoria_sugerida_id,
  t.data_compra,
  coalesce(parcela_anterior_ao_corte(t.parcela, t.data_compra, c.data_corte), false)
                      as sugerir_ignorar_parcela,
  chave_estabelecimento(t.descricao) as chave_estabelecimento,
  a.apelido
from transacoes_importadas t
left join fontes f on f.pluggy_account_id = t.pluggy_account_id
left join pluggy_contas c on c.pluggy_account_id = t.pluggy_account_id
left join apelidos_estabelecimento a
  on a.user_id = t.user_id and a.chave = chave_estabelecimento(t.descricao)
where t.estado in ('pendente', 'divergente');

alter view v_importadas_pendentes set (security_invoker = true);

-- ---------- grants ----------

grant select, insert, update, delete on apelidos_estabelecimento to authenticated;
grant execute on function
  chave_estabelecimento(text),
  definir_apelido(text, text),
  descricao_pluggy(saidas),
  descricao_pluggy(entradas),
  chave_estabelecimento(saidas),
  chave_estabelecimento(entradas),
  apelido_estabelecimento(saidas),
  apelido_estabelecimento(entradas)
to authenticated;
