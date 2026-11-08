create or replace function set_user_id_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger trg_categorias_user_id
  before insert on categorias
  for each row execute function set_user_id_from_auth();

create trigger trg_fontes_user_id
  before insert on fontes
  for each row execute function set_user_id_from_auth();

create trigger trg_entradas_user_id
  before insert on entradas
  for each row execute function set_user_id_from_auth();

create trigger trg_saidas_user_id
  before insert on saidas
  for each row execute function set_user_id_from_auth();
