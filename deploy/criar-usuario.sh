#!/usr/bin/env bash
# Cria (ou troca a senha de) um usuário do Lugom no banco do k8s.
# Uso: deploy/criar-usuario.sh email@exemplo.com
set -euo pipefail

EMAIL=${1:?uso: $0 email}
read -rsp "Senha para $EMAIL: " SENHA; echo
[ ${#SENHA} -ge 8 ] || { echo "Use pelo menos 8 caracteres."; exit 1; }

POD=$(kubectl -n lugom-financas get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}')

# E-mail e senha vão pelo stdin (\set), não pela linha de comando (que aparece no ps).
aspas() { printf "'%s'" "${1//\'/\'\'}"; }
{
  echo "\\set email $(aspas "$EMAIL")"
  echo "\\set senha $(aspas "$SENHA")"
  cat <<'SQL'
insert into auth.users (email, encrypted_password)
values (lower(:'email'), crypt(:'senha', gen_salt('bf')))
on conflict (email) do update set encrypted_password = excluded.encrypted_password;
select id, email from auth.users where email = lower(:'email');
SQL
} | kubectl -n lugom-financas exec -i "$POD" -- psql -v ON_ERROR_STOP=1 -U postgres -d lugom
