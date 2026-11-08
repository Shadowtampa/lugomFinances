-- M17 — Grants que o Supabase aplicava por padrão ao schema public.
-- RLS (M5) continua decidindo quais linhas cada usuário vê; isto só libera o acesso à tabela.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- O grant acima desfaria o hardening do M7: set_user_id_from_auth só roda como trigger.
revoke execute on function set_user_id_from_auth() from public, anon, authenticated;

-- Objetos criados por migrations futuras herdam os mesmos grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
