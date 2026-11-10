#!/usr/bin/env bash
# Build Nightfall, run it as one local process, and expose it to friends.
#
#   ./scripts/share.sh              # auto: Tailscale Funnel, then Cloudflare Quick Tunnel
#   ./scripts/share.sh cloudflare   # anonymous https://<random>.trycloudflare.com
#   ./scripts/share.sh tailscale    # stable https://<machine>.<tailnet>.ts.net (Funnel must be enabled)
#   ./scripts/share.sh lan          # http://<local-ip>:8080 on the same network / tailnet
#
# The instance is invite-only; the generated code is printed at startup.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Private operator settings live outside the frontend build and version control.
if [[ -f "$ROOT/.share/mail.env" ]]; then
  set -a
  source "$ROOT/.share/mail.env"
  set +a
fi

MODE="${1:-auto}"
PORT="${NIGHTFALL_PORT:-8080}"
DATA_DIR="${NIGHTFALL_DATA_DIR:-$ROOT/.share}"
DB_PATH="${NIGHTFALL_DB_PATH:-$DATA_DIR/nightfall}"
LOG_DIR="$DATA_DIR/logs"
INVITE="${NIGHTFALL_INVITE_CODE:-}"
CLOUDFLARED="$ROOT/.tools/cloudflared"
MAIL_MODE="${NIGHTFALL_MAIL_MODE:-disabled}"
EMAIL_VERIFICATION="${NIGHTFALL_EMAIL_VERIFICATION:-off}"
PUBLIC_URL_FILE="$DATA_DIR/public-url-$PORT-$$.txt"

mkdir -p "$DATA_DIR" "$LOG_DIR"

say() { printf '\n\033[1;36m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

for command in npm java curl; do
  command -v "$command" >/dev/null 2>&1 || fail "Missing $command. Install it first."
done
MAVEN="$(command -v mvn || true)"
if [[ -z "$MAVEN" && -x "$HOME/.config/Code/User/globalStorage/pleiades.java-extension-pack-jdk/maven/latest/bin/mvn" ]]; then
  MAVEN="$HOME/.config/Code/User/globalStorage/pleiades.java-extension-pack-jdk/maven/latest/bin/mvn"
fi
[[ -n "$MAVEN" ]] || fail "Maven was not found. Install it or add mvn to PATH."

if [[ "$MAIL_MODE" == "smtp" ]]; then
  EMAIL_VERIFICATION="required"
  if [[ -z "${NIGHTFALL_SMTP_PASSWORD:-}" && -t 0 ]]; then
    read -r -s -p "Gmail app password for $NIGHTFALL_SMTP_USERNAME: " NIGHTFALL_SMTP_PASSWORD
    printf '\n'
    export NIGHTFALL_SMTP_PASSWORD
  fi
  for setting in NIGHTFALL_MAIL_FROM NIGHTFALL_SMTP_HOST NIGHTFALL_SMTP_USERNAME NIGHTFALL_SMTP_PASSWORD; do
    [[ -n "${!setting:-}" ]] || fail "Set $setting before enabling SMTP."
  done
elif [[ "$MAIL_MODE" != "disabled" && "$MAIL_MODE" != "console" ]]; then
  fail "NIGHTFALL_MAIL_MODE must be disabled, console, or smtp."
elif [[ "$EMAIL_VERIFICATION" != "off" && "$MAIL_MODE" == "disabled" ]]; then
  fail "Email verification needs NIGHTFALL_MAIL_MODE=smtp (or console for development)."
fi
if [[ "$MAIL_MODE" == "console" ]]; then
  EMAIL_VERIFICATION="required"
fi

if [[ -z "$INVITE" ]]; then
  INVITE_FILE="$DATA_DIR/invite-code"
  if [[ -s "$INVITE_FILE" ]]; then
    INVITE="$(cat "$INVITE_FILE")"
  else
    INVITE="$(openssl rand -hex 12)"
    (umask 077; printf '%s\n' "$INVITE" > "$INVITE_FILE")
  fi
fi

if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  fail "Port $PORT already serves a Nightfall API. Stop it or set NIGHTFALL_PORT."
fi

if [[ ! -d node_modules ]]; then
  say "Installing frontend dependencies"
  npm ci
fi

say "Building the frontend"
npm run build

say "Building the backend"
(cd backend && "$MAVEN" -q -DskipTests package)

JAR="$(find backend/target -maxdepth 1 -name '*.jar' ! -name '*-sources.jar' ! -name '*.original' | head -n 1)"
[[ -n "$JAR" ]] || fail "Backend jar was not produced."

BIND="127.0.0.1"
COOKIE_SECURE="true"
if [[ "$MODE" == "lan" ]]; then
  BIND="0.0.0.0"
  COOKIE_SECURE="false"
fi

say "Starting Nightfall on 127.0.0.1:$PORT"
: > "$PUBLIC_URL_FILE"
env \
  SPRING_PROFILES_ACTIVE=share \
  SERVER_PORT="$PORT" \
  NIGHTFALL_BIND="$BIND" \
  NIGHTFALL_INVITE_CODE="$INVITE" \
  NIGHTFALL_EMAIL_VERIFICATION="$EMAIL_VERIFICATION" \
  NIGHTFALL_MAIL_MODE="$MAIL_MODE" \
  NIGHTFALL_SMTP_AUTH="${NIGHTFALL_SMTP_AUTH:-$([[ "$MAIL_MODE" == "smtp" ]] && printf true || printf false)}" \
  NIGHTFALL_PUBLIC_URL_FILE="$PUBLIC_URL_FILE" \
  NIGHTFALL_STATIC_DIR="$ROOT/dist" \
  NIGHTFALL_COOKIE_SECURE="$COOKIE_SECURE" \
  NIGHTFALL_PUBLIC_URL="http://127.0.0.1:$PORT" \
  SPRING_DATASOURCE_URL="jdbc:h2:file:$DB_PATH;DB_CLOSE_ON_EXIT=FALSE" \
  java -jar "$JAR" >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

cleanup() {
  trap - EXIT INT TERM
  rm -f -- "$PUBLIC_URL_FILE"
  [[ -n "${TUNNEL_PID:-}" ]] && kill "$TUNNEL_PID" 2>/dev/null || true
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  if [[ "${TS_CREATED:-0}" == "1" ]]; then
    tailscale funnel reset >/dev/null 2>&1 || true
  fi
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "${TUNNEL_PID:-0}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

say "Waiting for the API"
READY=0
for _ in $(seq 1 90); do
  if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    tail -n 40 "$LOG_DIR/backend.log" >&2 || true
    fail "Backend stopped during startup."
  fi
  sleep 1
done
[[ "$READY" == "1" ]] || { tail -n 40 "$LOG_DIR/backend.log" >&2 || true; fail "Backend did not become ready."; }

start_cloudflare() {
  command -v curl >/dev/null 2>&1 || return 1
  if [[ ! -x "$CLOUDFLARED" ]]; then
    local asset
    case "$(uname -m)" in
      x86_64|amd64) asset="cloudflared-linux-amd64" ;;
      aarch64|arm64) asset="cloudflared-linux-arm64" ;;
      *) fail "Unsupported architecture for cloudflared: $(uname -m)" ;;
    esac
    say "Downloading cloudflared (one time, no account needed)"
    mkdir -p "$ROOT/.tools"
    curl -fL --retry 3 --max-time 180 -o "$CLOUDFLARED" \
      "https://github.com/cloudflare/cloudflared/releases/latest/download/$asset"
    chmod +x "$CLOUDFLARED"
  fi

  say "Opening an anonymous Cloudflare Quick Tunnel"
  "$CLOUDFLARED" tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate >"$LOG_DIR/cloudflared.log" 2>&1 &
  TUNNEL_PID=$!
  URL=""
  for _ in $(seq 1 60); do
    URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/cloudflared.log" | head -n 1 || true)"
    [[ -n "$URL" ]] && break
    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
      tail -n 30 "$LOG_DIR/cloudflared.log" >&2 || true
      return 1
    fi
    sleep 0.5
  done
  [[ -n "$URL" ]] || { tail -n 30 "$LOG_DIR/cloudflared.log" >&2 || true; return 1; }
}

start_tailscale() {
  command -v tailscale >/dev/null 2>&1 || return 1
  local https_port="${NIGHTFALL_TAILSCALE_PORT:-8443}"
  local current
  current="$(tailscale funnel status --json 2>/dev/null || true)"
  if [[ -n "$current" && "$current" != "{}" ]]; then
    printf 'Tailscale Funnel already has a configuration; not overwriting it.\n' >&2
    return 1
  fi

  say "Publishing through Tailscale Funnel on port $https_port"
  if ! timeout 45 tailscale funnel --bg --yes --https="$https_port" "http://127.0.0.1:$PORT" >"$LOG_DIR/tailscale.log" 2>&1; then
    tail -n 30 "$LOG_DIR/tailscale.log" >&2 || true
    if [[ "$(tailscale funnel status --json 2>/dev/null || true)" != "{}" ]]; then
      tailscale funnel reset >/dev/null 2>&1 || true
    fi
    ENABLE_URL="$(grep -oE 'https://login\.tailscale\.com/f/funnel[^[:space:]]*' "$LOG_DIR/tailscale.log" | head -n 1 || true)"
    if [[ -n "$ENABLE_URL" ]]; then
      printf '\nEnable Funnel for this machine in one click:\n  %s\n\n' "$ENABLE_URL" >&2
    else
      printf '\nEnable HTTPS/Funnel for this tailnet at https://login.tailscale.com/admin/dns\nand add the "funnel" node attribute in the access controls.\n\n' >&2
    fi
    return 1
  fi
  TS_CREATED=1

  local host
  host="$(tailscale status --json 2>/dev/null | jq -r '.Self.DNSName // "" | rtrimstr(".")' 2>/dev/null || true)"
  [[ -n "$host" ]] || return 1
  if [[ "$https_port" == "443" ]]; then
    URL="https://$host"
  else
    URL="https://$host:$https_port"
  fi
}

URL=""
case "$MODE" in
  auto)
    start_tailscale || start_cloudflare || fail "Could not open a tunnel. Check the logs in $LOG_DIR."
    ;;
  tailscale)
    start_tailscale || fail "Tailscale Funnel failed. See $LOG_DIR/tailscale.log."
    ;;
  cloudflare|tunnel)
    start_cloudflare || fail "Cloudflare Quick Tunnel failed. See $LOG_DIR/cloudflared.log."
    ;;
  lan)
    LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    URL="http://${LOCAL_IP:-127.0.0.1}:$PORT"
    ;;
  *)
    fail "Unknown mode '$MODE'. Use auto, cloudflare, tailscale, or lan."
    ;;
esac

printf '%s\n' "$URL" > "$PUBLIC_URL_FILE"

REACHABLE=0
if [[ "$MODE" != "lan" ]]; then
  say "Checking the public URL"
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "$URL/api/health" >/dev/null 2>&1; then REACHABLE=1; break; fi
    sleep 1
  done
  if [[ "$REACHABLE" != "1" ]]; then
    printf '\nWarning: this computer could not reach %s yet.\n' "$URL" >&2
    printf 'A local DNS filter often blocks *.trycloudflare.com. Friends on normal DNS can still open it;\n' >&2
    printf 'for a stable URL that also resolves locally, enable Tailscale Funnel and rerun with "tailscale".\n' >&2
  fi
fi

cat <<EOF

  ┌──────────────────────────────────────────────────────────────┐
  │  NIGHTFALL IS LIVE                                           │
  └──────────────────────────────────────────────────────────────┘

  URL:          $URL
  Invite code:  $INVITE

  Sign in and use Mail → Invite by email, or send the URL and code.
  Email verification: $EMAIL_VERIFICATION ($MAIL_MODE)
  Accounts are stored in: $DB_PATH.mv.db
  Logs:                   $LOG_DIR
  Stop:                   Ctrl+C

  This instance keeps running only while this computer stays awake and
  online. The Cloudflare URL changes after a restart; the Tailscale URL
  stays the same.

EOF

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    tail -n 40 "$LOG_DIR/backend.log" >&2 || true
    fail "Nightfall stopped."
  fi
  if [[ -n "${TUNNEL_PID:-}" ]] && ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    tail -n 40 "$LOG_DIR/cloudflared.log" >&2 || true
    fail "The tunnel stopped."
  fi
  sleep 5
done
