#!/usr/bin/env bash
# Sobe (ou atualiza) o Lugom no Kubernetes do homelab. Pode rodar de novo à vontade.
#  - na primeira vez gera o Secret (senhas + segredo do JWT) e guarda uma cópia em .segredos (fora do git)
#  - atualiza os ConfigMaps (migrations e nginx)
#  - faz o build do front (dist/, servido direto pelo nginx via hostPath)
#  - aplica os manifests e espera tudo ficar pronto
#
# As migrations só rodam quando o banco é criado (pasta de dados vazia). Migration nova
# num banco existente: aplique à mão (ver README).
set -euo pipefail
cd "$(dirname "$0")"
RAIZ=$(cd ../.. && pwd)
NS=lugom-financas

kubectl apply -f 00-namespace.yaml

if ! kubectl -n "$NS" get secret lugom-financas >/dev/null 2>&1; then
  echo "== Gerando segredos"
  # umask só neste subshell: fora dele o build do front precisa sair legível para o nginx.
  (umask 077; cat > .segredos <<EOF
postgres-password=$(openssl rand -hex 24)
authenticator-password=$(openssl rand -hex 24)
jwt-secret=$(openssl rand -hex 32)
EOF
  )
  kubectl -n "$NS" create secret generic lugom-financas --from-env-file=.segredos
fi

# M20: segredos da Pluggy + senha do role do worker (pedidos uma vez; nunca vão para o git).
if ! kubectl -n "$NS" get secret lugom-financas -o jsonpath='{.data.pluggy-client-id}' | grep -q .; then
  echo "== Credenciais da Pluggy (Dashboard → Applications)"
  read -r -p "PLUGGY_CLIENT_ID: " PLUGGY_CLIENT_ID
  read -r -s -p "PLUGGY_CLIENT_SECRET: " PLUGGY_CLIENT_SECRET; echo
  SENHA_WORKER=$(openssl rand -hex 24)
  kubectl -n "$NS" patch secret lugom-financas --type merge -p "$(printf '{"stringData":{"pluggy-client-id":"%s","pluggy-client-secret":"%s","pluggy-worker-password":"%s"}}' \
    "$PLUGGY_CLIENT_ID" "$PLUGGY_CLIENT_SECRET" "$SENHA_WORKER")"
  (umask 077; printf 'pluggy-client-id=%s\npluggy-client-secret=%s\npluggy-worker-password=%s\n' \
    "$PLUGGY_CLIENT_ID" "$PLUGGY_CLIENT_SECRET" "$SENHA_WORKER" >> .segredos)
  unset PLUGGY_CLIENT_SECRET
  # Banco já existente: a senha do role não vem do init, aplica aqui (o role nasce na migration 00012).
  POD=$(kubectl -n "$NS" get pod -l app=postgres -o name 2>/dev/null | head -1)
  if [ -n "$POD" ]; then
    # psql não interpola :'var' em -c; precisa vir pelo stdin.
    printf "alter role pluggy_worker with password :'senha';\n" \
      | kubectl -n "$NS" exec -i "$POD" -- psql -v ON_ERROR_STOP=1 -U postgres -d lugom -v senha="$SENHA_WORKER" >/dev/null 2>&1 \
      || echo "   (role pluggy_worker ainda não existe: aplique a 00012 e rode de novo o alter role — ver README)"
  fi
fi

echo "== ConfigMaps"
kubectl -n "$NS" create configmap db-init \
  --from-file="$RAIZ/db/migrations" --from-file="$RAIZ/db/zz_settings.sh" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" create configmap web-nginx --from-file=default.conf=nginx.conf \
  --dry-run=client -o yaml | kubectl apply -f -

echo "== Build do front"
(cd "$RAIZ" && npm ci --silent && npm run build)
echo "== Dependências do worker"
(cd "$RAIZ/worker" && npm ci --silent --omit=dev)

echo "== Manifests"
kubectl apply -f 10-postgres.yaml -f 20-postgrest.yaml -f 30-web.yaml -f 40-worker.yaml
kubectl -n "$NS" rollout restart deployment/web     # pega nginx.conf novo
kubectl -n "$NS" rollout restart deployment/worker  # pega código novo do worker/
kubectl -n "$NS" rollout status deployment/postgres --timeout=180s
kubectl -n "$NS" rollout status deployment/postgrest --timeout=120s
kubectl -n "$NS" rollout status deployment/web --timeout=120s
kubectl -n "$NS" rollout status deployment/worker --timeout=120s

echo
echo "Pronto: http://localhost:10070"
echo "Primeiro uso: ../criar-usuario.sh  (ou ../migrar-do-supabase.sh para trazer os dados da nuvem)"
