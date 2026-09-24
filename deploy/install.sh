#!/usr/bin/env bash
# Instala ou atualiza o Caca Carros numa VPS Ubuntu que ja tem Docker e nginx.
# Nao mexe em outros sistemas da maquina: cria so os containers "caca-carros-*"
# e um arquivo de site no nginx para o dominio.
#
# Uso (como root):
#   curl -fsSL https://raw.githubusercontent.com/Totex-Motors/caca-carros/main/deploy/install.sh | bash
# ou, com o repositorio ja clonado:
#   bash /opt/caca-carros/deploy/install.sh

set -euo pipefail

REPO_URL="https://github.com/Totex-Motors/caca-carros.git"
APP_DIR="/opt/caca-carros"
DOMAIN="${DOMAIN:-carros.grupocardoso.online}"
ENV_FILE="$APP_DIR/deploy/.env"
COMPOSE="docker compose -f $APP_DIR/deploy/docker-compose.vps.yml --env-file $ENV_FILE"

step() { printf '\n==> %s\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root." >&2
  exit 1
fi

step "Conferindo Docker e nginx"
command -v docker >/dev/null || { echo "Docker nao encontrado." >&2; exit 1; }
docker compose version >/dev/null || { echo "Plugin 'docker compose' nao encontrado." >&2; exit 1; }
command -v nginx >/dev/null || { echo "nginx nao encontrado." >&2; exit 1; }

step "Baixando o codigo em $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi

if [ ! -f "$ENV_FILE" ]; then
  step "Configurando o login do app"
  read -rp "E-mail para entrar no app: " ADMIN_EMAIL </dev/tty
  while :; do
    read -rsp "Senha (min. 8 caracteres): " ADMIN_PASSWORD </dev/tty; echo
    if [ "${#ADMIN_PASSWORD}" -lt 8 ]; then echo "Senha muito curta."; continue; fi
    case "$ADMIN_PASSWORD" in
      *'$'*|*' '*|*'"'*|*"'"*) echo "Nao use \$, espacos ou aspas na senha."; continue ;;
    esac
    break
  done

  cp "$APP_DIR/deploy/.env.example" "$ENV_FILE"
  sed -i \
    -e "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" \
    -e "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=$ADMIN_EMAIL|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" \
    "$ENV_FILE"
  # A senha pode ter caracteres especiais: grava sem passar pelo sed.
  grep -v '^ADMIN_PASSWORD=' "$ENV_FILE" > "$ENV_FILE.tmp"
  printf 'ADMIN_PASSWORD=%s\n' "$ADMIN_PASSWORD" >> "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  echo "Usando configuracao existente em $ENV_FILE"
fi

step "Subindo banco, servidor e site (a primeira vez demora alguns minutos)"
$COMPOSE up -d --build

step "Publicando https://$DOMAIN no nginx"
# Usa sites-available/sites-enabled quando o nginx da VPS e configurado assim; senao, conf.d.
if [ -d /etc/nginx/sites-enabled ] && grep -q 'sites-enabled' /etc/nginx/nginx.conf; then
  SITE="/etc/nginx/sites-available/$DOMAIN"
  LINK="/etc/nginx/sites-enabled/$DOMAIN"
else
  SITE="/etc/nginx/conf.d/$DOMAIN.conf"
  LINK=""
fi
if [ ! -f "$SITE" ]; then
  cat > "$SITE" <<NGINX
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN;

  client_max_body_size 25m;

  location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 900s;
  }
}
NGINX
  [ -n "$LINK" ] && ln -sf "$SITE" "$LINK"
fi
# Instalacoes antigas criaram o site com limite de 5m; a analise de anuncios envia fotos.
sed -i 's/client_max_body_size 5m;/client_max_body_size 25m;/' "$SITE"
if ! nginx -t; then
  echo "Configuracao do nginx invalida; removendo $SITE para nao afetar os outros sites." >&2
  rm -f "$SITE" ${LINK:+"$LINK"}
  exit 1
fi
systemctl reload nginx

step "Gerando certificado HTTPS"
if ! command -v certbot >/dev/null; then
  apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx
fi
if certbot certificates 2>/dev/null | grep -q "Domains: .*$DOMAIN"; then
  echo "Certificado ja existe."
else
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
fi

step "Pronto"
echo "Acesse: https://$DOMAIN"
echo "Ver logs do servidor: $COMPOSE logs -f backend"
