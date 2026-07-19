#!/usr/bin/env bash
set -euo pipefail

origin="${1:?Usage: $0 http://compute-node:port [state-directory]}"
state_dir="${2:-${SCRATCH:-/scratch/${USER}}/startflow-tools/cloudflare}"
cloudflared_bin="${STARTFLOW_CLOUDFLARED_BIN:-${SCRATCH:-/scratch/${USER}}/startflow-tools/cloudflared}"
pid_file="${state_dir}/cloudflared.pid"
log_file="${state_dir}/cloudflared.log"

mkdir -p "${state_dir}"
if [[ -s "${pid_file}" ]]; then
  old_pid="$(<"${pid_file}")"
  if [[ "${old_pid}" =~ ^[0-9]+$ ]] && kill -0 "${old_pid}" 2>/dev/null; then
    echo "A detached quick tunnel is already running: pid=${old_pid}" >&2
    exit 3
  fi
fi

: > "${log_file}"
setsid nohup env GOMAXPROCS=2 "${cloudflared_bin}" tunnel \
  --url "${origin}" \
  --no-autoupdate \
  --protocol http2 \
  >"${log_file}" 2>&1 < /dev/null &
pid="$!"
echo "${pid}" > "${pid_file}"

for _ in $(seq 1 30); do
  url="$(sed -n 's/.*\(https:\/\/[a-z0-9-]*\.trycloudflare\.com\).*/\1/p' "${log_file}" | tail -n 1)"
  if [[ -n "${url}" ]]; then
    printf 'pid=%s\nurl=%s\nlog=%s\n' "${pid}" "${url}" "${log_file}"
    exit 0
  fi
  if ! kill -0 "${pid}" 2>/dev/null; then
    tail -n 80 "${log_file}" >&2
    exit 4
  fi
  sleep 1
done

echo "Tunnel started but no public URL appeared within 30 seconds; inspect ${log_file}" >&2
exit 5
