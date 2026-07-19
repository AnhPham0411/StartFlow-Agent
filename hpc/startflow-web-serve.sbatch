#!/usr/bin/env bash
#SBATCH --job-name=startflow-shb-18h
#SBATCH --account=def-yalda
#SBATCH --partition=cpubase_bycore_b3
#SBATCH --cpus-per-task=1
#SBATCH --mem=4G
#SBATCH --time=18:00:00
#SBATCH --output=%x-%j.out
#SBATCH --error=%x-%j.err

set -euo pipefail

release_archive="${STARTFLOW_RELEASE_ARCHIVE:?STARTFLOW_RELEASE_ARCHIVE is required}"
serve_root="${SLURM_TMPDIR}/startflow-web"
scratch_root="${SCRATCH:-/scratch/${USER}}"
node_bin="${STARTFLOW_NODE_BIN:-/home/${USER}/.local/bin/node}"
mkdir -p "${serve_root}"
cp "${release_archive}" "${SLURM_TMPDIR}/startflow-release.tar.gz"
tar -xzf "${SLURM_TMPDIR}/startflow-release.tar.gz" -C "${serve_root}"
cd "${serve_root}/frontend"

export HOSTNAME=0.0.0.0
export PORT="${FRONTEND_PORT:-3220}"
export NODE_ENV=production
export NEXT_PUBLIC_AUTH_MODE=demo
export NEXT_PUBLIC_DEMO_PUBLIC_WARNING=true
export STARTFLOW_HPC_SPOOL_DIR="${STARTFLOW_HPC_SPOOL_DIR:-${scratch_root}/startflow-assistant/spool}"
export STARTFLOW_HPC_SECRET_FILE="${STARTFLOW_HPC_SECRET_FILE:-${scratch_root}/startflow-assistant/spool-secret}"
export STARTFLOW_HPC_TIMEOUT_MS="${STARTFLOW_HPC_TIMEOUT_MS:-90000}"
exec "${node_bin}" server.js
