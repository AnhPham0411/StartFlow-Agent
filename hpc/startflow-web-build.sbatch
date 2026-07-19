#!/usr/bin/env bash
#SBATCH --job-name=sf-web-release-build
#SBATCH --account=def-yalda
#SBATCH --partition=cpubase_bycore_b1
#SBATCH --cpus-per-task=2
#SBATCH --mem=12G
#SBATCH --time=00:20:00
#SBATCH --output=runtime-logs/%x-%j.out
#SBATCH --error=runtime-logs/%x-%j.err

set -euo pipefail

project_dir="${STARTFLOW_PROJECT_DIR:?STARTFLOW_PROJECT_DIR is required}"
release_name="${STARTFLOW_RELEASE_NAME:?STARTFLOW_RELEASE_NAME is required}"
build_root="${SLURM_TMPDIR}/startflow-release"
node_bin="${STARTFLOW_NODE_BIN:-/home/${USER}/.local/bin/node}"
if [[ ! "${release_name}" =~ ^\.next-release-[a-zA-Z0-9._-]+$ ]]; then
  echo "STARTFLOW_RELEASE_NAME must match .next-release-<safe-name>" >&2
  exit 2
fi
release_archive="${STARTFLOW_RELEASE_ARCHIVE_OUTPUT:-${project_dir}/frontend/startflow-release-${release_name#.next-release-}.tar.gz}"

mkdir -p "${build_root}"
mkdir -p "${build_root}/frontend" "${build_root}/packages/contracts"
rsync -a \
  --exclude node_modules \
  --exclude '.next*' \
  --exclude '*.out' \
  --exclude '*.err' \
  --exclude 'startflow-release-*.tar.gz' \
  "${project_dir}/frontend/" "${build_root}/frontend/"
rsync -a \
  --exclude node_modules \
  --exclude dist \
  "${project_dir}/packages/contracts/" "${build_root}/packages/contracts/"
cp \
  "${project_dir}/package.json" \
  "${project_dir}/pnpm-workspace.yaml" \
  "${project_dir}/tsconfig.base.json" \
  "${build_root}/"
ln -s "${project_dir}/node_modules" "${build_root}/node_modules"
ln -s "${project_dir}/frontend/node_modules" "${build_root}/frontend/node_modules"

cd "${build_root}/frontend"
env \
  NEXT_DIST_DIR="${release_name}" \
  NEXT_PUBLIC_AUTH_MODE=demo \
  NEXT_PUBLIC_DEMO_PUBLIC_WARNING=true \
  NODE_ENV=production \
  "${node_bin}" node_modules/next/dist/bin/next build --webpack

test -f "${release_name}/BUILD_ID"
# Copying the complete .next tree to Lustre creates thousands of metadata
# operations and can take longer than the build. The deployable archive below
# contains the same standalone output and is the only artifact serving needs.
if [[ "${STARTFLOW_COPY_NEXT_DIR:-false}" == "true" ]]; then
  cp -a "${release_name}" "${project_dir}/frontend/${release_name}"
fi

bundle_root="${SLURM_TMPDIR}/startflow-standalone-bundle"
mkdir -p "${bundle_root}"
cp -a "${release_name}/standalone/." "${bundle_root}/"
mkdir -p "${bundle_root}/frontend/${release_name}"
cp -a "${release_name}/static" "${bundle_root}/frontend/${release_name}/static"
if [[ -d public ]]; then
  mkdir -p "${bundle_root}/frontend/public"
  cp -a public/. "${bundle_root}/frontend/public/"
fi

# The workspace uses pnpm symlinks on Lustre. A standalone archive containing
# those symlinks can block for minutes during cold start on another node. Copy
# the small runtime dependency set as real files so serving stays local to
# $SLURM_TMPDIR. Build-only tooling remains outside the release.
rm -f "${bundle_root}/node_modules" "${bundle_root}/frontend/node_modules"
mkdir -p "${bundle_root}/frontend/node_modules"
runtime_modules=(
  next
  react
  react-dom
  scheduler
  styled-jsx
  postcss
  baseline-browser-mapping
  caniuse-lite
  zod
  server-only
  client-only
  @next/env
  @swc/helpers
)
for module_name in "${runtime_modules[@]}"; do
  source_module="${project_dir}/frontend/node_modules/${module_name}"
  if [[ ! -e "${source_module}" ]]; then
    source_module="${project_dir}/node_modules/${module_name}"
  fi
  if [[ ! -e "${source_module}" ]]; then
    source_module="$(find "${project_dir}/node_modules/.pnpm" -maxdepth 5 -type d -path "*/node_modules/${module_name}" -print -quit)"
  fi
  if [[ -e "${source_module}" ]]; then
    destination_module="${bundle_root}/frontend/node_modules/${module_name}"
    mkdir -p "$(dirname "${destination_module}")"
    cp -aL "${source_module}" "${destination_module}"
  fi
done
contracts_target="${bundle_root}/frontend/node_modules/@startflow/contracts"
mkdir -p "${contracts_target}"
cp "${project_dir}/packages/contracts/package.json" "${contracts_target}/package.json"
cp -a "${project_dir}/packages/contracts/dist" "${contracts_target}/dist"
ln -s frontend/node_modules "${bundle_root}/node_modules"

tar -czf "${SLURM_TMPDIR}/startflow-release.tar.gz" -C "${bundle_root}" .
cp "${SLURM_TMPDIR}/startflow-release.tar.gz" "${release_archive}"
echo "release_archive=${release_archive}"
