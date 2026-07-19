#!/usr/bin/env bash
set -Eeuo pipefail

release_sha="${RELEASE_SHA:-}"
target_env="${TARGET_ENV:-dev}"
droplet_path="${DROPLET_PATH:-/opt/startflow-agent/$target_env}"

fail() {
  printf 'StartFlow deploy error: %s\n' "$1" >&2
  exit 2
}

is_safe_absolute_path() {
  local path="$1" segment
  local -a segments
  [[ "$path" =~ ^/[A-Za-z0-9._/-]+$ ]] || return 1
  [[ "$path" != '/' && "$path" != */ && "$path" != *'//'* ]] || return 1
  IFS='/' read -r -a segments <<< "${path#/}"
  for segment in "${segments[@]}"; do
    [[ -n "$segment" && "$segment" != '.' && "$segment" != '..' ]] || return 1
  done
}

is_safe_absolute_path "$droplet_path" \
  || fail 'DROPLET_PATH must not contain empty, dot, or dot-dot segments.'
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || fail 'RELEASE_SHA must be a full Git SHA.'
[[ "$target_env" =~ ^(dev|prod)$ ]] || fail 'TARGET_ENV must be dev or prod.'

command -v realpath >/dev/null || fail 'realpath is not installed.'
authorized_root="$(realpath -m -- "$droplet_path")"
archive_root="$droplet_path/release"
canonical_archive_root="$(realpath -m -- "$archive_root")"
[[ "$canonical_archive_root" == "$authorized_root/release" && ! -L "$archive_root" ]] \
  || fail 'archive root must remain within DROPLET_PATH.'

archive="$archive_root/release-$release_sha.tar.gz"
[[ -f "$archive" && ! -L "$archive" ]] || fail 'release archive is missing.'

previous_release=''
deployment_succeeded=false
on_exit() {
  local status=$?
  rm -f -- "$archive" || true
  if [[ "$status" -eq 0 || "$deployment_succeeded" == 'true' || -z "$previous_release" || ! -d "$previous_release" ]]; then
    return "$status"
  fi
  printf 'Deployment failed; restoring StartFlow containers from %s. Database migrations are forward-only.\n' "$previous_release" >&2
  cd "$previous_release" || return "$status"
  docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d \
    backend ai-service frontend || true
  return "$status"
}
trap on_exit EXIT

release_root="$droplet_path/releases"
canonical_release_root="$(realpath -m -- "$release_root")"
[[ "$canonical_release_root" == "$authorized_root/releases" ]] \
  || fail 'release root must remain within DROPLET_PATH.'
release_dir="$release_root/$release_sha"
canonical_release_dir="$canonical_release_root/$release_sha"
current_link="$droplet_path/current"

command -v docker >/dev/null || fail 'Docker is not installed.'
docker compose version >/dev/null || fail 'Docker Compose v2 is not installed.'
command -v curl >/dev/null || fail 'curl is not installed.'
command -v timeout >/dev/null || fail 'GNU timeout is not installed.'

mkdir -p "$release_root"
[[ ! -L "$release_root" && "$(realpath -m -- "$release_root")" == "$canonical_release_root" ]] \
  || fail 'release root changed during deployment.'
if [[ -L "$current_link" && "$(readlink -f "$current_link")" == "$release_dir" && -d "$release_dir" ]]; then
  printf 'StartFlow release %s is already current; nothing to replace.\n' "$release_sha"
  exit 0
fi
[[ ! -L "$release_dir" && "$(realpath -m -- "$release_dir")" == "$canonical_release_dir" ]] \
  || fail 'release directory escaped the authorized release root.'
rm -rf -- "$release_dir"
mkdir -p "$release_dir"
tar -xzf "$archive" -C "$release_dir"
chmod 600 "$release_dir/.env"
[[ ! -f "$release_dir/postgres-ca.crt" ]] || chmod 600 "$release_dir/postgres-ca.crt"
gzip -dc "$release_dir/images.tar.gz" | docker load

compose=(docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml)
cd "$release_dir"
startflow_network="$(sed -n 's/^STARTFLOW_NETWORK=//p' .env | tail -n 1)"
startflow_network="${startflow_network:-startflow-$target_env}"
[[ "$startflow_network" =~ ^[A-Za-z0-9_.-]+$ ]] || fail 'invalid STARTFLOW_NETWORK.'
if ! docker network inspect "$startflow_network" >/dev/null 2>&1; then
  docker network create "$startflow_network" >/dev/null
fi
"${compose[@]}" config --quiet

if [[ -L "$current_link" ]]; then
  candidate_previous_release="$(readlink -f "$current_link")"
  case "$candidate_previous_release" in
    "$canonical_release_root"/*) ;;
    *) fail 'current release link escaped the authorized release root.' ;;
  esac
  previous_release_name="${candidate_previous_release##*/}"
  [[ "$previous_release_name" =~ ^[0-9a-f]{40}$ ]] \
    || fail 'current release link does not target a release SHA.'
  previous_release="$candidate_previous_release"
fi

env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" .env | tail -n 1
}

issuer="$(env_value KEYCLOAK_ISSUER)"
[[ "$issuer" =~ ^https?:// ]] || fail 'KEYCLOAK_ISSUER must be an HTTP(S) URL.'
curl --fail --silent --show-error --max-time 10 \
  "${issuer%/}/.well-known/openid-configuration" >/dev/null

# Migrations finish before any long-running StartFlow container is replaced.
"${compose[@]}" run --interactive=false --no-TTY --rm backend-migrate
"${compose[@]}" run --interactive=false --no-TTY --rm ai-migrate
"${compose[@]}" run --interactive=false --no-TTY --rm backend-profile-seed
"${compose[@]}" run --interactive=false --no-TTY --rm backend-demo-seed
if [[ "$(env_value STARTFLOW_ENABLE_IDENTITY_SEED)" == 'true' ]]; then
  "${compose[@]}" run --interactive=false --no-TTY --rm backend-identity-seed
  printf 'Keycloak identities are synchronized.\n'
else
  printf 'Keycloak identity seed is disabled; existing identities are preserved.\n'
fi
"${compose[@]}" up -d backend ai-service frontend

frontend_port="$(env_value FRONTEND_PORT)"
backend_port="$(env_value BACKEND_PORT)"
[[ "$frontend_port" =~ ^[0-9]{2,5}$ && "$backend_port" =~ ^[0-9]{2,5}$ ]] || fail 'invalid service port.'

wait_for_url() {
  local name="$1" url="$2"
  local attempt
  for attempt in $(seq 1 45); do
    if curl --fail --silent --show-error --max-time 3 "$url" >/dev/null 2>&1; then
      printf '%s is ready.\n' "$name"
      return 0
    fi
    sleep 2
  done
  "${compose[@]}" ps
  "${compose[@]}" logs --tail 100 "$name" || true
  fail "$name readiness timed out."
}

wait_for_url backend "http://127.0.0.1:$backend_port/ready"
wait_for_url frontend "http://127.0.0.1:$frontend_port/health"

app_domain="$(env_value APP_DOMAIN)"
api_domain="$(env_value API_DOMAIN)"
[[ "$app_domain" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'invalid APP_DOMAIN.'
[[ "$api_domain" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'invalid API_DOMAIN.'
command -v nginx >/dev/null || fail 'Nginx is not installed.'

ensure_tls_certificate() {
  local domain="$1"
  if sudo test -s "/etc/letsencrypt/live/$domain/fullchain.pem" \
    && sudo test -s "/etc/letsencrypt/live/$domain/privkey.pem"; then
    return 0
  fi
  command -v certbot >/dev/null || fail "TLS certificate is missing for $domain and Certbot is not installed."
  sudo test -d /var/www/html || fail 'Certbot webroot /var/www/html is missing.'
  printf 'Requesting TLS certificate for %s.\n' "$domain"
  sudo certbot certonly \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    --webroot \
    --webroot-path /var/www/html \
    --keep-until-expiring \
    --cert-name "$domain" \
    --domain "$domain" \
    || fail "Certbot could not issue a TLS certificate for $domain."
}

for domain in "$app_domain" "$api_domain"; do
  ensure_tls_certificate "$domain"
  sudo test -s "/etc/letsencrypt/live/$domain/fullchain.pem" \
    || fail "TLS certificate is missing for $domain."
  sudo test -s "/etc/letsencrypt/live/$domain/privkey.pem" \
    || fail "TLS private key is missing for $domain."
done
sed -e "s/__APP_DOMAIN__/$app_domain/g" -e "s/__FRONTEND_PORT__/$frontend_port/g" \
  nginx/frontend.conf.template > "/tmp/startflow-$target_env-frontend.conf"
sed -e "s/__API_DOMAIN__/$api_domain/g" -e "s/__BACKEND_PORT__/$backend_port/g" \
  nginx/backend.conf.template > "/tmp/startflow-$target_env-backend.conf"

if ! nginx_dump="$(sudo nginx -T 2>&1)"; then
  fail 'Nginx configuration cannot be inspected.'
fi

sites_enabled_glob='/etc/nginx/sites-enabled/*'
conf_d_glob='/etc/nginx/conf.d/*.conf'
frontend_name="startflow-$target_env-frontend.conf"
backend_name="startflow-$target_env-backend.conf"

if grep -Fq "include $sites_enabled_glob;" <<<"$nginx_dump"; then
  sudo install -d -m 755 /etc/nginx/sites-available /etc/nginx/sites-enabled
  sudo install -m 644 "/tmp/$frontend_name" "/etc/nginx/sites-available/$frontend_name"
  sudo install -m 644 "/tmp/$backend_name" "/etc/nginx/sites-available/$backend_name"
  sudo ln -sfn "/etc/nginx/sites-available/$frontend_name" "/etc/nginx/sites-enabled/$frontend_name"
  sudo ln -sfn "/etc/nginx/sites-available/$backend_name" "/etc/nginx/sites-enabled/$backend_name"
  sudo rm -f -- "/etc/nginx/conf.d/$frontend_name" "/etc/nginx/conf.d/$backend_name"
elif grep -Fq "include $conf_d_glob;" <<<"$nginx_dump"; then
  sudo install -d -m 755 /etc/nginx/conf.d
  sudo install -m 644 "/tmp/$frontend_name" "/etc/nginx/conf.d/$frontend_name"
  sudo install -m 644 "/tmp/$backend_name" "/etc/nginx/conf.d/$backend_name"
  sudo rm -f -- \
    "/etc/nginx/sites-enabled/$frontend_name" "/etc/nginx/sites-enabled/$backend_name" \
    "/etc/nginx/sites-available/$frontend_name" "/etc/nginx/sites-available/$backend_name"
else
  fail 'Nginx does not include /etc/nginx/sites-enabled/* or /etc/nginx/conf.d/*.conf.'
fi

if ! nginx_test_output="$(sudo nginx -t 2>&1)"; then
  fail 'Nginx rejected the StartFlow virtual hosts.'
fi
if grep -F 'conflicting server name' <<<"$nginx_test_output" \
  | grep -Fq -e "$app_domain" -e "$api_domain"; then
  fail 'Another active Nginx virtual host already owns a StartFlow domain.'
fi
if ! active_nginx_dump="$(sudo nginx -T 2>&1)"; then
  fail 'Nginx rejected the active StartFlow configuration.'
fi
grep -Fq "server_name $app_domain;" <<<"$active_nginx_dump" \
  || fail 'The StartFlow frontend virtual host is not loaded by Nginx.'
grep -Fq "proxy_pass http://127.0.0.1:$frontend_port;" <<<"$active_nginx_dump" \
  || fail 'The StartFlow frontend upstream is not loaded by Nginx.'
grep -Fq "server_name $api_domain;" <<<"$active_nginx_dump" \
  || fail 'The StartFlow backend virtual host is not loaded by Nginx.'
grep -Fq "proxy_pass http://127.0.0.1:$backend_port;" <<<"$active_nginx_dump" \
  || fail 'The StartFlow backend upstream is not loaded by Nginx.'

sudo systemctl reload nginx

verify_nginx_route() {
  local name="$1" domain="$2" path="$3" marker="$4"
  local attempt response
  for attempt in $(seq 1 10); do
    if response="$(curl --fail --silent --max-time 10 --noproxy '*' \
      --resolve "$domain:443:127.0.0.1" "https://$domain$path")" \
      && grep -Fq "$marker" <<<"$response"; then
      printf '%s Nginx route is active.\n' "$name"
      return 0
    fi
    sleep 1
  done
  fail "$name is not reachable through the expected local Nginx virtual host."
}

verify_nginx_route frontend "$app_domain" '/health' 'ok'
verify_nginx_route backend "$api_domain" '/health' '"service":"startflow-backend"'

ln -sfn "$release_dir" "$current_link"
deployment_succeeded=true

# Seed data improves the demo but an unavailable vector store must not take the
# website, API, and Nginx routes offline. Qdrant readiness remains observable at
# the AI service /ready endpoint and the seed can be retried manually.
seed_output=''
if seed_output="$(timeout --foreground --kill-after=10s 90s \
  "${compose[@]}" run --interactive=false --no-TTY --rm ai-seed 2>&1)"; then
  [[ -z "$seed_output" ]] || printf '%s\n' "$seed_output"
  printf 'AI knowledge seed is ready.\n'
else
  seed_status=$?
  printf 'StartFlow deploy warning: AI knowledge seed skipped (exit %s); web services remain active.\n' \
    "$seed_status" >&2
fi

# Keep the current release plus two rollback candidates inside StartFlow's own path.
mapfile -t old_releases < <(find "$droplet_path/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +4 | cut -d' ' -f2-)
for old_release in "${old_releases[@]:-}"; do
  [[ -n "$old_release" && "$old_release" != "$release_dir" ]] || continue
  rm -rf -- "$old_release"
done

"${compose[@]}" ps
printf 'StartFlow release %s deployed independently to %s.\n' "$release_sha" "$target_env"
