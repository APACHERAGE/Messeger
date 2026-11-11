#!/usr/bin/env bash
# Opened in a visible local terminal so the owner can type the Gmail app password privately.
cd "$(dirname "$0")/.." || exit 1
local_stopped=0
restore_local() {
  trap - EXIT
  if (( local_stopped )); then
    ./scripts/start-local.sh || printf 'Could not restore local Nightfall. Run ./scripts/start-local.sh to retry.\n' >&2
  fi
}
trap restore_local EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
if systemctl --user is-active --quiet nightfall-local.service; then
  systemctl --user stop nightfall-local.service || exit 1
  local_stopped=1
fi
./scripts/share.sh cloudflare
status=$?
restore_local
if (( status != 0 )); then
  printf '\nNightfall stopped with exit code %s. Press Enter to close this window.\n' "$status"
  read -r _
fi
exit "$status"
