#!/bin/sh
set -eu

: "${VITE_API_BASE_URL:=https://victora-api.schischos-lodge.com}"
: "${VITE_API_PREFIX:=/api}"
: "${VITE_PUBLIC_API_PREFIX:=}"
: "${VITE_HUB_URL:=/hubs/tournament}"

: "${NGINX_API_SCHEME:=https}"
: "${NGINX_API_HOST:=victora-api.schischos-lodge.com}"
: "${NGINX_PUBLIC_API_SCHEME:=${NGINX_API_SCHEME}}"
: "${NGINX_PUBLIC_API_HOST:=${NGINX_API_HOST}}"
: "${NGINX_HUB_SCHEME:=${NGINX_API_SCHEME}}"
: "${NGINX_HUB_HOST:=${NGINX_API_HOST}}"

cat > /usr/share/nginx/html/env.js <<EOF
window.__APP_CONFIG__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL}",
  VITE_API_PREFIX: "${VITE_API_PREFIX}",
  VITE_PUBLIC_API_PREFIX: "${VITE_PUBLIC_API_PREFIX}",
  VITE_HUB_URL: "${VITE_HUB_URL}"
};
EOF

envsubst '
$NGINX_API_SCHEME
$NGINX_API_HOST
$NGINX_PUBLIC_API_SCHEME
$NGINX_PUBLIC_API_HOST
$NGINX_HUB_SCHEME
$NGINX_HUB_HOST
' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'

