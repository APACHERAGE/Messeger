#!/usr/bin/env bash
# Start the private, loopback-only Nightfall build after public sharing stops.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JAR="$ROOT/backend/target/messenger-api-1.0.0.jar"
ENV_FILE="$ROOT/.share/local.env"
JAVA_BIN="$HOME/.config/Code/User/globalStorage/pleiades.java-extension-pack-jdk/java/25/bin/java"

[[ -f "$ENV_FILE" ]] || { printf 'Missing private local configuration: %s\n' "$ENV_FILE" >&2; exit 1; }
[[ -f "$JAR" ]] || { printf 'Build the backend first: %s\n' "$JAR" >&2; exit 1; }
if [[ ! -x "$JAVA_BIN" ]]; then JAVA_BIN="$(command -v java)"; fi

if ! systemctl --user is-active --quiet nightfall-local.service; then
  systemd-run --user --unit=nightfall-local --collect \
    --property="WorkingDirectory=$ROOT/backend" \
    --property="EnvironmentFile=$ENV_FILE" \
    --property=UMask=0077 \
    "$JAVA_BIN" -jar "$JAR"
fi

for _ in $(seq 1 90); do
  if curl -fsS --max-time 2 http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    printf 'Local Nightfall is ready: http://127.0.0.1:8080/\n'
    exit 0
  fi
  if ! systemctl --user is-active --quiet nightfall-local.service; then
    printf 'Local Nightfall stopped during startup. Check: journalctl --user -u nightfall-local.service -n 40\n' >&2
    exit 1
  fi
  sleep 1
done
printf 'Local Nightfall did not become ready within 90 seconds.\n' >&2
exit 1
