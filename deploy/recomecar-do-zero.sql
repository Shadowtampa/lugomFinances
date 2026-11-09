-- M20 — Recomeço do zero (roda UMA vez, à mão, depois de um pg_dump).
--   kubectl -n lugom-financas exec -i $POD -- psql -v ON_ERROR_STOP=1 -U postgres -d lugom < deploy/recomecar-do-zero.sql
-- Apaga todas as Entradas/Saídas e todas as Fontes, menos a VR Flash (fica com saldo 0).
-- Categorias e Recorrências ficam (o histórico de "paga" perde só o link saida_id).
begin;

do $$
begin
  if (select count(*) from fontes where nome = 'VR Flash') <> 1 then
    raise exception 'ESPERAVA_UMA_FONTE_VR_FLASH';
  end if;
end;
$$;

create temporary table _contagem_recorrencias as select count(*) as n from recorrencias;

delete from saida_splits;
delete from saidas;
delete from entradas;
delete from fonte_categorias where fonte_id <> (select id from fontes where nome = 'VR Flash');
delete from fontes where nome <> 'VR Flash';
update fontes set origem = 'manual', pluggy_account_id = null where nome = 'VR Flash';

do $$
begin
  if (select count(*) from v_saldo_fontes) <> 1
     or (select saldo_centavos from v_saldo_fontes) <> 0 then
    raise exception 'RECOMECO_SALDO_INESPERADO';
  end if;
  if (select count(*) from recorrencias) <> (select n from _contagem_recorrencias) then
    raise exception 'RECOMECO_PERDEU_RECORRENCIAS';
  end if;
end;
$$;

commit;

select nome, saldo_centavos from v_saldo_fontes;
select count(*) as recorrencias from recorrencias;
