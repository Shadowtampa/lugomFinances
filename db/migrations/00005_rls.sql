alter table categorias      enable row level security;
alter table fontes          enable row level security;
alter table fonte_categorias enable row level security;
alter table entradas        enable row level security;
alter table saidas          enable row level security;
alter table saida_splits    enable row level security;

create policy "own_categorias" on categorias
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_fontes" on fontes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_entradas" on entradas
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_saidas" on saidas
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
