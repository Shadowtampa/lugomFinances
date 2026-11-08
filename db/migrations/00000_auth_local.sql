-- M17 — O que o Supabase fornecia de graça, agora local.
-- Roda antes das outras migrations: elas referenciam auth.users e auth.uid().

create extension if not exists pgcrypto;

-- ============ papéis do PostgREST ============
-- anon: requisição sem token. authenticated: token válido.
-- authenticator: o login que o PostgREST usa; troca para anon/authenticated a cada request.
-- A senha do authenticator é definida no init (zz_settings.sh), a partir de env.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end;
$$;

grant anon, authenticated to authenticator;

-- ============ schema auth ============
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  encrypted_password text not null,          -- bcrypt (crypt(senha, gen_salt('bf')))
  created_at timestamptz not null default now()
);

-- Mesmo contrato do Supabase: o "sub" do JWT da requisição, ou null.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json ->> 'sub',
    ''
  )::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- auth.users nunca é exposta: o PostgREST só publica o schema public.

-- ============ JWT HS256 ============
create or replace function auth.base64url(dados bytea)
returns text
language sql
immutable
as $$
  select translate(encode(dados, 'base64'), E'+/=\n', '-_')
$$;

create or replace function auth.assinar_jwt(payload json, segredo text)
returns text
language sql
immutable
as $$
  with partes as (
    select
      auth.base64url(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8')) as cabecalho,
      auth.base64url(convert_to(payload::text, 'utf8')) as corpo
  )
  select cabecalho || '.' || corpo || '.' ||
         auth.base64url(hmac(cabecalho || '.' || corpo, segredo, 'sha256'))
  from partes
$$;

revoke execute on function auth.base64url(bytea) from public;
revoke execute on function auth.assinar_jwt(json, text) from public;

-- ============ login ============
-- RPC pública (anon). Confere a senha e devolve um JWT de 30 dias.
-- Erro com prefixo de código, como as outras RPCs (lib/erros.ts).
create or replace function public.login(email text, senha text)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_usuario auth.users;
  v_expira  bigint;
  v_segredo text := current_setting('app.jwt_secret', true);
begin
  if v_segredo is null or length(v_segredo) < 32 then
    raise exception 'CONFIG_INVALIDA: app.jwt_secret ausente ou curto';
  end if;

  select * into v_usuario
  from auth.users u
  where lower(u.email) = lower(login.email);

  if v_usuario.id is null
     or v_usuario.encrypted_password <> crypt(senha, v_usuario.encrypted_password) then
    raise exception 'INVALID_CREDENTIALS: e-mail ou senha incorretos';
  end if;

  v_expira := extract(epoch from now() + interval '30 days')::bigint;

  return json_build_object(
    'access_token', auth.assinar_jwt(
      json_build_object(
        'sub',   v_usuario.id,
        'email', v_usuario.email,
        'role',  'authenticated',
        'exp',   v_expira
      ),
      v_segredo
    ),
    'expires_at', v_expira,
    'user', json_build_object('id', v_usuario.id, 'email', v_usuario.email)
  );
end;
$$;

revoke execute on function public.login(text, text) from public;
grant execute on function public.login(text, text) to anon, authenticated;
