#!/usr/bin/env bash
#SBATCH --job-name=startflow-demo-verify
#SBATCH --account=def-yalda
#SBATCH --partition=cpubase_bycore_b1
#SBATCH --cpus-per-task=2
#SBATCH --mem=12G
#SBATCH --time=00:30:00
#SBATCH --output=%x-%j.out
#SBATCH --error=%x-%j.err

set -euo pipefail

project_dir="${STARTFLOW_PROJECT_DIR:?STARTFLOW_PROJECT_DIR is required}"
verify_root="${SLURM_TMPDIR}/startflow-demo-verify"
node_bin="${STARTFLOW_NODE_BIN:-/home/${USER}/.local/bin/node}"

mkdir -p "${verify_root}"
rsync -a \
  --exclude .git \
  --exclude node_modules \
  --exclude '.next*' \
  --exclude '*.out' \
  --exclude '*.err' \
  --exclude 'startflow-release-*.tar.gz' \
  "${project_dir}/" "${verify_root}/"

ln -s "${project_dir}/node_modules" "${verify_root}/node_modules"
ln -s "${project_dir}/frontend/node_modules" "${verify_root}/frontend/node_modules"
ln -s "${project_dir}/packages/contracts/node_modules" "${verify_root}/packages/contracts/node_modules"

export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1
export NODE_ENV=test

cd "${verify_root}"
"${node_bin}" node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json
"${node_bin}" frontend/node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json
cd "${verify_root}/frontend"
"${node_bin}" node_modules/vitest/vitest.mjs run \
  tests/features/assistant-routing.test.ts \
  tests/features/demo-database.test.ts \
  --maxWorkers=1
cd "${verify_root}"
python3 -m unittest hpc.tests.test_spool_protocol -v

cd "${verify_root}/frontend"
env \
  NODE_ENV=production \
  NEXT_PUBLIC_AUTH_MODE=demo \
  NEXT_PUBLIC_DEMO_PUBLIC_WARNING=true \
  "${node_bin}" node_modules/next/dist/bin/next build --webpack
