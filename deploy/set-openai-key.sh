#!/usr/bin/env bash
# Grava a chave da OpenAI em deploy/.env sem exibi-la na tela e reinicia o servidor.
# Uso (como root, na VPS): bash /opt/caca-carros/deploy/set-openai-key.sh

set -euo pipefail

APP_DIR="/opt/caca-carros"
ENV_FILE="$APP_DIR/deploy/.env"
COMPOSE="docker compose -f $APP_DIR/deploy/docker-compose.vps.yml --env-file $ENV_FILE"

[ -f "$ENV_FILE" ] || { echo "Instale o app primeiro (deploy/install.sh)." >&2; exit 1; }

read -rsp "Cole a chave da OpenAI (sk-...) e aperte Enter: " KEY </dev/tty; echo
# Remove espacos e quebras de linha que a colagem as vezes traz junto.
KEY=$(printf '%s' "$KEY" | tr -d '[:space:]')
# Mostra so o comeco, o fim e o tamanho, para conferir se a colagem veio inteira.
echo "Recebido: ${KEY:0:8}...${KEY: -4} (${#KEY} caracteres; chaves sk-proj costumam ter mais de 150)"
case "$KEY" in
  sk-*) ;;
  *) echo "Isso nao parece uma chave da OpenAI (deve comecar com sk-)." >&2; exit 1 ;;
esac
if [ "${#KEY}" -lt 40 ]; then
  echo "A chave parece incompleta: a colagem pode ter cortado. Tente de novo (clique com o botao direito > Colar)." >&2
  exit 1
fi

echo "Testando a chave..."
MODEL=$(grep '^OPENAI_MODEL=' "$ENV_FILE" | cut -d= -f2- || true)
MODEL=${MODEL:-gpt-5.5}
STATUS=$(curl -s -o /dev/null -w '%{http_code}' https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ok\"}],\"max_completion_tokens\":16}")
case "$STATUS" in
  200) echo "Chave OK para o modelo $MODEL." ;;
  401)
    echo "A OpenAI recusou a chave (401): ela foi apagada, esta incompleta ou nao e a chave certa." >&2
    echo "Crie uma chave nova em https://platform.openai.com/api-keys e rode este script de novo." >&2
    echo "Nada foi alterado." >&2
    rm -f "$ENV_FILE.tmp"
    exit 1 ;;
  403|404) echo "A chave nao tem acesso ao modelo $MODEL (HTTP $STATUS). Libere o modelo no projeto da OpenAI." >&2 ;;
  *) echo "Resposta inesperada da OpenAI (HTTP $STATUS). A chave foi gravada mesmo assim." >&2 ;;
esac

grep -v -e '^OPENAI_API_KEY=' "$ENV_FILE" > "$ENV_FILE.tmp"
printf 'OPENAI_API_KEY=%s\n' "$KEY" >> "$ENV_FILE.tmp"
grep -q '^OPENAI_MODEL=' "$ENV_FILE.tmp" || printf 'OPENAI_MODEL=gpt-5.5\n' >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Reiniciando o servidor..."
$COMPOSE up -d backend
echo "Pronto."
