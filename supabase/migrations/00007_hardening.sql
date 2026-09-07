-- fixa search_path nas funções de saída (evita search_path hijacking)
alter function criar_saida(text, bigint, uuid, date, jsonb, boolean, smallint, uuid)
  set search_path = public;

alter function excluir_saida(uuid)
  set search_path = public;

alter function atualizar_saida(uuid, text, bigint, uuid, date, jsonb, boolean, smallint, uuid)
  set search_path = public;

-- set_user_id_from_auth só deve rodar como trigger, nunca como RPC pública
revoke execute on function set_user_id_from_auth() from public, anon, authenticated;
