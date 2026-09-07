-- Seed de desenvolvimento. Roda como postgres (bypassa RLS), então user_id é
-- explícito. Assume que existe pelo menos um usuário em auth.users; troque
-- v_user_id abaixo se quiser semear para um usuário específico.
do $$
declare
  v_user_id uuid;
  v_cat_alimentacao uuid;
  v_cat_supermercado uuid;
  v_cat_transporte uuid;
  v_cat_moradia uuid;
  v_cat_lazer uuid;
  v_cat_saude uuid;
  v_fonte_conta uuid;
  v_fonte_vr uuid;
  v_fonte_carteira uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;

  if v_user_id is null then
    raise notice 'Nenhum usuário em auth.users — crie um usuário (M3) antes de rodar o seed.';
    return;
  end if;

  -- categorias
  insert into categorias (user_id, nome, limite_mensal_centavos)
    values (v_user_id, 'Alimentação', 120000) returning id into v_cat_alimentacao;
  insert into categorias (user_id, nome, limite_mensal_centavos)
    values (v_user_id, 'Supermercado', 80000) returning id into v_cat_supermercado;
  insert into categorias (user_id, nome, limite_mensal_centavos)
    values (v_user_id, 'Transporte', 30000) returning id into v_cat_transporte;
  insert into categorias (user_id, nome, limite_mensal_centavos)
    values (v_user_id, 'Moradia', null) returning id into v_cat_moradia;
  insert into categorias (user_id, nome, limite_mensal_centavos)
    values (v_user_id, 'Lazer', 40000) returning id into v_cat_lazer;
  insert into categorias (user_id, nome, limite_mensal_centavos)
    values (v_user_id, 'Saúde', null) returning id into v_cat_saude;

  -- fontes
  insert into fontes (user_id, nome, tipo)
    values (v_user_id, 'Conta Corrente', 'livre') returning id into v_fonte_conta;
  insert into fontes (user_id, nome, tipo)
    values (v_user_id, 'VR Flash', 'restrita') returning id into v_fonte_vr;
  insert into fontes (user_id, nome, tipo)
    values (v_user_id, 'Carteira', 'livre') returning id into v_fonte_carteira;

  insert into fonte_categorias (fonte_id, categoria_id) values
    (v_fonte_vr, v_cat_alimentacao),
    (v_fonte_vr, v_cat_supermercado);

  -- entradas
  insert into entradas (user_id, fonte_id, titulo, valor_centavos, data, recorrente, dia_recorrencia)
    values (v_user_id, v_fonte_conta, 'Salário', 500000, date_trunc('month', current_date) + interval '4 days', true, 5);
  insert into entradas (user_id, fonte_id, titulo, valor_centavos, data, recorrente, dia_recorrencia)
    values (v_user_id, v_fonte_vr, 'VR', 90000, date_trunc('month', current_date), true, 1);
  insert into entradas (user_id, fonte_id, titulo, valor_centavos, data)
    values (v_user_id, v_fonte_conta, 'Freelance', 80000, current_date);

  -- saídas (via RPC pra passar pelas mesmas validações que o app usaria)
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);

  perform criar_saida(
    'Aluguel', 180000, v_cat_moradia, current_date,
    jsonb_build_array(jsonb_build_object('fonte_id', v_fonte_conta, 'valor_centavos', 180000)),
    true, 5
  );
  perform criar_saida(
    'Almoço', 4500, v_cat_alimentacao, current_date,
    jsonb_build_array(jsonb_build_object('fonte_id', v_fonte_vr, 'valor_centavos', 4500))
  );
  perform criar_saida(
    'Uber', 2200, v_cat_transporte, current_date,
    jsonb_build_array(jsonb_build_object('fonte_id', v_fonte_conta, 'valor_centavos', 2200))
  );
end $$;
