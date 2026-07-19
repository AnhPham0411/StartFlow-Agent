#!/usr/bin/env bash
#SBATCH --job-name=startflow-vlm-core
#SBATCH --account=def-yalda_gpu
#SBATCH --partition=gpubase_bygpu_b1
#SBATCH --gpus-per-node=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=96G
#SBATCH --time=03:00:00
#SBATCH --output=%x-%j.out
#SBATCH --error=%x-%j.err

set -euo pipefail

project_dir="${STARTFLOW_PROJECT_DIR:?STARTFLOW_PROJECT_DIR is required}"
spool_dir="${STARTFLOW_SPOOL_DIR:?STARTFLOW_SPOOL_DIR is required}"
secret_file="${STARTFLOW_HPC_SECRET_FILE:?STARTFLOW_HPC_SECRET_FILE is required}"
model_path="${STARTFLOW_GENERAL_MODEL_PATH:?STARTFLOW_GENERAL_MODEL_PATH is required}"
model_id="${STARTFLOW_GENERAL_MODEL_ID:-Qwen/Qwen3-VL-4B-Instruct}"
scratch_root="${SCRATCH:-/scratch/${USER}}"
ocr_path="${STARTFLOW_OCR_MODEL_PATH:-${scratch_root}/startflow-models/PaddlePaddle--PaddleOCR-VL-1.6--66317acc}"
embedding_path="${STARTFLOW_EMBEDDING_MODEL_PATH:-${scratch_root}/startflow-models/Qwen--Qwen3-Embedding-0.6B--97b0c614}"
reranker_path="${STARTFLOW_RERANKER_MODEL_PATH:-${scratch_root}/startflow-models/Qwen--Qwen3-Reranker-0.6B--e61197ed}"
safety_path="${STARTFLOW_SAFETY_MODEL_PATH:-${scratch_root}/startflow-models/protectai--deberta-v3-base-prompt-injection-v2--90c9989b}"
container="${STARTFLOW_CONTAINER:-${scratch_root}/dovla/containers/pytorch_2.7.1_cuda12.8.sif}"
python_bin="${STARTFLOW_PYTHON:-${scratch_root}/dovla/envs/maniskill/bin/python}"

export OMP_NUM_THREADS=1
export OPENBLAS_NUM_THREADS=1
export MKL_NUM_THREADS=1
export TOKENIZERS_PARALLELISM=false
export PYTHONUNBUFFERED=1
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export HF_DATASETS_OFFLINE=1
unset SSL_CERT_FILE

mkdir -p "${spool_dir}"
if [[ ! -e "${secret_file}" ]]; then
  mkdir -p "$(dirname "${secret_file}")"
  umask 077
  openssl rand -hex 32 >"${secret_file}"
fi
chmod 0600 "${secret_file}"
cd "${project_dir}"

module load StdEnv/2023 apptainer/1.4.5 >/dev/null 2>&1
exec apptainer exec --nv \
  -B "${project_dir}:${project_dir}" \
  -B "${scratch_root}:${scratch_root}" \
  "${container}" \
  "${python_bin}" hpc/startflow_vlm_worker.py \
  --spool "${spool_dir}" \
  --secret-file "${secret_file}" \
  --model-path "${model_path}" \
  --model-id "${model_id}" \
  --ocr-path "${ocr_path}" \
  --embedding-path "${embedding_path}" \
  --reranker-path "${reranker_path}" \
  --safety-path "${safety_path}"
