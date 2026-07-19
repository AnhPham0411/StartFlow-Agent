# StartFlow Banking Multi-Agent — Demo, HPC and Deployment Guide

This is the single canonical guide for the SHB-style StartFlow demo. It covers the current HPC deployment, Cloudflare access, VPS reverse proxy, verification, rollback and known limitations. Existing project documents remain historical/reference material.

## 1. What StartFlow is

StartFlow is an internal banking assistant with one simple entry point. An employee uploads one or more files and asks a question. A supervisor/planner then:

1. classifies the request and its risk;
2. selects only the required logical agents from a catalog of 128 agents in 16 domains;
3. routes each task to an appropriate local core/model;
4. returns an evidence-backed answer and execution plan;
5. pauses sensitive tasks for an authorized human to approve or reject.

The 128 agents are declarative capabilities, not 128 model processes. Several shared specialist cores are loaded or routed on demand. No training is performed, no model is downloaded from a compute node, and no public cloud model is used by this demo.

Use synthetic data only. Do not upload real customer PII, credentials, production banking records or legally binding decisions.

## 2. Current user experience

- `/assistant`: ask any banking work question and upload up to 12 arbitrary file types, 50 MB per file and 120 MB total.
- `/manager`: manager-only view of worker heartbeat, active core/model inventory and signed spool queue.
- Conversation history: up to 12 synthetic demo conversations are retained in shared browser local storage so banker can hand a pending conversation to manager on the same demo browser; file bytes are never retained by the history feature.
- Planner output: selected agents, domain, reason, core dependencies, model ID and status.
- Evidence: source filename, evidence label, excerpt and confidence.
- Approval: an inline gate appears inside the assistant answer only for explicit high-impact execution; manager can click **Phê duyệt** / **Từ chối**, or type `approve` / `reject`. The right column remains workflow-only.
- Synthetic database: policy, procedure, lead, KYC, transaction, product and workforce records make read-only demos repeatable without real banking data.
- Honest fallback: if the GPU worker is unavailable, the UI visibly labels the result `Demo fallback`; it never silently calls a public model.

Demo-only accounts:

| Account | Password | Roles |
| --- | --- | --- |
| `manager` | `12345678` | analyst, approver, admin |
| `banker` | `12345678` | analyst |

These credentials are intentionally weak and are not production authentication. Production/default authentication remains Keycloak Authorization Code + PKCE.

Demo history is a browser-only convenience, not a production audit store. Use the existing authenticated backend/PostgreSQL event model before retaining real conversations. The synthetic database is [`frontend/src/data/synthetic-banking-demo.json`](frontend/src/data/synthetic-banking-demo.json) and every record is explicitly marked demo-only. It includes a masked aggregate projection of `seed_20k.sql`: 37,624 insert rows across 27 tables; names, CIF, dates of birth, addresses, transaction narratives and password hashes are never copied into assistant evidence.

## 3. Architecture

Current HPC-only demo:

```text
Browser
  -> HTTPS Quick/Named Cloudflare Tunnel
  -> Next.js web job on a Slurm CPU node
  -> HMAC-signed shared spool on $SCRATCH
  -> Slurm GPU worker (offline model inference)
  -> signed result/evidence in spool outbox
  -> Next.js API
  -> browser
```

The GPU worker opens no public port. Browser traffic cannot reach the GPU node directly. Attachments are written per request, processed on the GPU job and removed after a terminal result.

Future VPS/DigitalOcean public plane:

```text
Internet -> DNS/TLS -> Nginx on VPS
                     -> stable Cloudflare Named Tunnel hostname
                     -> HPC Next.js web job -> signed spool -> GPU worker
```

Deterministic fallback:

```text
Browser -> Next.js API -> deterministic planner/fallback
```

The fallback remains usable when Rorqual is unavailable and is always labelled.

## 4. Prerequisites

- Node.js 22.12 or newer and pnpm 10 for development.
- Slurm account `<PROJECT_ACCOUNT>` with CPU and GPU partitions.
- Shared `<SCRATCH_PATH>` visible to web and GPU jobs.
- Apptainer/PyTorch CUDA image already downloaded to scratch.
- Local pinned model snapshots already downloaded to scratch.
- `cloudflared` for temporary/public access.
- For a stable hostname: a Cloudflare account, managed zone and Named Tunnel token.

Do not run builds, tests, downloads or model inference on a shared login node. Submit them to Slurm. A temporary Quick Tunnel is a single lightweight network process only; confirm site acceptable-use rules and stop it after the demo.

## 5. Environment variables

Frontend/web:

```bash
NODE_ENV=production
NEXT_PUBLIC_AUTH_MODE=demo
NEXT_PUBLIC_DEMO_PUBLIC_WARNING=true
STARTFLOW_HPC_SPOOL_DIR=<SCRATCH_PATH>/startflow-assistant/spool
STARTFLOW_HPC_SECRET_FILE=<SCRATCH_PATH>/startflow-assistant/spool-secret
STARTFLOW_HPC_TIMEOUT_MS=90000
FRONTEND_PORT=3220
```

GPU worker:

```bash
STARTFLOW_PROJECT_DIR=<STARTFLOW_REPOSITORY>
STARTFLOW_SPOOL_DIR=<SCRATCH_PATH>/startflow-assistant/spool
STARTFLOW_HPC_SECRET_FILE=<SCRATCH_PATH>/startflow-assistant/spool-secret
STARTFLOW_GENERAL_MODEL_PATH=<SCRATCH_PATH>/startflow-models/Qwen3-VL-4B-Instruct-<REVISION>
STARTFLOW_GENERAL_MODEL_ID=Qwen/Qwen3-VL-4B-Instruct
STARTFLOW_OCR_MODEL_PATH=<SCRATCH_PATH>/startflow-models/PaddlePaddle--PaddleOCR-VL-1.6--<REVISION>
STARTFLOW_EMBEDDING_MODEL_PATH=<SCRATCH_PATH>/startflow-models/Qwen--Qwen3-Embedding-0.6B--<REVISION>
STARTFLOW_RERANKER_MODEL_PATH=<SCRATCH_PATH>/startflow-models/Qwen--Qwen3-Reranker-0.6B--<REVISION>
STARTFLOW_SAFETY_MODEL_PATH=<SCRATCH_PATH>/startflow-models/protectai--deberta-v3-base-prompt-injection-v2--<REVISION>
```

The web and every worker must use the same spool and secret file. The secret must have mode `0600`. Never put its contents in Git, Slurm arguments, browser variables or logs.

Optional existing control plane:

```bash
AUTH_MODE=keycloak
NEXT_PUBLIC_AUTH_MODE=keycloak
NEXT_PUBLIC_KEYCLOAK_URL=https://<AUTH_DOMAIN>
NEXT_PUBLIC_KEYCLOAK_REALM=startflow
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=startflow-web
DATABASE_URL=postgresql://<USER>:<PASSWORD>@<PRIVATE_DB_HOST>:5432/startflow_app?sslmode=require
```

## 6. Quick local development

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm --filter @startflow/contracts build
NEXT_PUBLIC_AUTH_MODE=demo \
NEXT_PUBLIC_DEMO_PUBLIC_WARNING=true \
pnpm --filter @startflow/frontend dev
```

Open `http://localhost:3000`. For local development without a GPU worker, the assistant returns the visibly labelled deterministic fallback.

## 7. Model inventory and download rules

The authoritative audit file is:

```text
<SCRATCH_PATH>/startflow-models/download-manifest.json
```

The demo set includes general VLM, OCR, text embedding, text reranking, multimodal embedding/reranking, prompt-injection safety, time-series, forecasting and ASR candidates. Some registry entries can be gated, license-blocked, research-only or incomplete. Their status must be shown honestly; a downloaded checkpoint is not automatically approved for production banking use.

Download on an approved internet-capable transfer/login host only, sequentially with one worker:

```bash
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1
python3 hpc/model_downloader.py \
  --registry <STARTFLOW_ROOT>/banking_core_models/registries/models.yaml \
  --output <SCRATCH_PATH>/startflow-models \
  --manifest <SCRATCH_PATH>/startflow-models/download-manifest.json
```

Never download inside `startflow-vlm-worker.sbatch`; it forces `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`.

## 8. Build and verify through Slurm

Run the focused offline demo gate:

```bash
sbatch \
  --export=ALL,STARTFLOW_PROJECT_DIR=<STARTFLOW_REPOSITORY> \
  hpc/startflow-demo-verify.sbatch
```

It copies source to `$SLURM_TMPDIR`, limits CPU threads, then runs:

- contracts TypeScript build;
- frontend TypeScript check;
- single-worker planner/routing tests;
- synthetic policy/workforce retrieval tests;
- signed spool protocol `unittest` tests;
- a production Next.js webpack build.

Inspect results:

```bash
squeue -u "$USER"
sacct -j <VERIFY_JOB_ID> --format=JobID,State,ExitCode,Elapsed,MaxRSS
sed -n '1,260p' startflow-demo-verify-<VERIFY_JOB_ID>.out
sed -n '1,260p' startflow-demo-verify-<VERIFY_JOB_ID>.err
```

## 9. Start GPU workers

Prepare the shared secret once:

```bash
mkdir -p <SCRATCH_PATH>/startflow-assistant/spool
umask 077
openssl rand -hex 32 > <SCRATCH_PATH>/startflow-assistant/spool-secret
chmod 0600 <SCRATCH_PATH>/startflow-assistant/spool-secret
```

Submit a bounded three-hour segment:

```bash
sbatch --export=ALL,\
STARTFLOW_PROJECT_DIR=<STARTFLOW_REPOSITORY>,\
STARTFLOW_SPOOL_DIR=<SCRATCH_PATH>/startflow-assistant/spool,\
STARTFLOW_HPC_SECRET_FILE=<SCRATCH_PATH>/startflow-assistant/spool-secret,\
STARTFLOW_GENERAL_MODEL_PATH=<GENERAL_MODEL_PATH> \
hpc/startflow-vlm-worker.sbatch
```

For at least 18 hours of coverage, submit seven three-hour segments linked by `afterany`. Do not submit seven independent concurrent model replicas:

```bash
first_job=$(sbatch --parsable --export=ALL,<ENVIRONMENT_ABOVE> hpc/startflow-vlm-worker.sbatch)
previous_job="$first_job"
for segment in 2 3 4 5 6 7; do
  previous_job=$(sbatch --parsable --dependency="afterany:${previous_job}" \
    --export=ALL,<ENVIRONMENT_ABOVE> hpc/startflow-vlm-worker.sbatch)
done
```

Verify that each pending segment references the previous job:

```bash
squeue -u "$USER" -o '%.18i %.28j %.9T %.10M %.9l %.22E %R'
```

## 10. Serve the production web build

Build a standalone release using `hpc/startflow-web-build.sbatch`, package it, then submit:

```bash
sbatch --export=ALL,\
STARTFLOW_RELEASE_ARCHIVE=<STARTFLOW_RELEASE_ARCHIVE>,\
STARTFLOW_HPC_SPOOL_DIR=<SCRATCH_PATH>/startflow-assistant/spool,\
STARTFLOW_HPC_SECRET_FILE=<SCRATCH_PATH>/startflow-assistant/spool-secret,\
FRONTEND_PORT=3220 \
hpc/startflow-web-serve.sbatch
```

The serve job copies the release to `$SLURM_TMPDIR`; it does not serve thousands of Next.js files directly from the shared project filesystem.

Check from a host that can reach the allocated CPU node:

```bash
curl --fail http://<WEB_COMPUTE_NODE>:3220/api/health
curl --fail -H 'Authorization: Bearer demo-manager-token' \
  http://<WEB_COMPUTE_NODE>:3220/api/manager/status
```

## 11. Cloudflare access

Temporary Quick Tunnel:

```bash
env GOMAXPROCS=2 <CLOUDFLARED_BINARY> tunnel \
  --url http://<WEB_COMPUTE_NODE>:3220 \
  --no-autoupdate \
  --protocol http2
```

To keep the one lightweight tunnel process alive after closing VS Code/Codex, start it detached only after the origin passes health checks:

```bash
chmod +x hpc/startflow-cloudflare-quick.sh
hpc/startflow-cloudflare-quick.sh http://<WEB_COMPUTE_NODE>:3220
```

The script keeps its PID and log under `$SCRATCH/startflow-tools/cloudflare/` and refuses to create a duplicate while the recorded PID is alive.

Validate the generated hostname:

```bash
curl --fail https://<QUICK_TUNNEL_HOST>/api/health
curl --fail https://<QUICK_TUNNEL_HOST>/assistant
```

A Quick Tunnel is for short demos only: its URL changes after restart, it has no uptime guarantee and does not support SSE. Use a Cloudflare Named Tunnel for a stable VPS upstream or long-running demo.

Named Tunnel outline:

1. Create a remotely managed tunnel in the Cloudflare dashboard.
2. Map `<TUNNEL_ORIGIN_HOST>` to `http://<WEB_COMPUTE_NODE>:3220`.
3. Install/run its token only on an approved outbound host.
4. Keep the GPU endpoint and Slurm services private.
5. Run more than one approved connector only when cluster policy permits it.

## 12. VPS DNS, TLS and reverse proxy

Give the VPS operator:

- public domain: `<APP_DOMAIN>`;
- upstream: `https://<TUNNEL_ORIGIN_HOST>`;
- health path: `/api/health`;
- upload limit: at least 130 MB;
- request timeout: at least 300 seconds;
- requirement to preserve every path and query string, including `/`, `/assistant`, `/manager`, `/api/*` and `/_next/*`.

Nginx example:

```nginx
server {
    listen 80;
    server_name <APP_DOMAIN>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name <APP_DOMAIN>;

    ssl_certificate /etc/letsencrypt/live/<APP_DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<APP_DOMAIN>/privkey.pem;
    client_max_body_size 130m;

    location / {
        proxy_pass https://<TUNNEL_ORIGIN_HOST>;
        proxy_ssl_server_name on;
        proxy_ssl_name <TUNNEL_ORIGIN_HOST>;
        proxy_set_header Host <TUNNEL_ORIGIN_HOST>;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_cache off;
        proxy_redirect https://<TUNNEL_ORIGIN_HOST>/ https://<APP_DOMAIN>/;
    }
}
```

Apply and test:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl --fail https://<APP_DOMAIN>/api/health
```

Proxying only `/api` is insufficient because the UI and Next.js assets use other paths.

## 13. Demo script (5–8 minutes)

1. Open `/assistant` and sign in as `banker`.
2. Upload a synthetic SME PDF/image/spreadsheet.
3. Ask: “Đánh giá sơ bộ hồ sơ SME, trích dẫn dữ liệu và nêu điểm cần phê duyệt.”
4. Show `Local VLM`, the evidence excerpts and the selected agent/core/model plan.
5. Show that sensitive tasks remain `Chờ phê duyệt`.
6. Show that `banker` cannot resolve the gate, then sign out and use the shared browser history.
7. Sign in as `manager`, resolve the inline gate, open `/manager`, and show the worker heartbeat/model inventory.
8. Ask “Hướng dẫn cách kiểm tra hồ sơ KYC theo chính sách công ty” and show that StartFlow uses a minimal read-only Policy RAG workflow without an approval button.
9. Open **Lịch sử** to reload the earlier conversation, then show the synthetic workforce table in `/manager`.
10. Explain that 128 logical agents share specialist local cores; the browser never selects a model or workflow manually.

## 14. Health, logs and traces

```bash
curl --fail https://<PUBLIC_HOST>/api/health
curl --fail -H 'Authorization: Bearer demo-manager-token' \
  https://<PUBLIC_HOST>/api/manager/status
squeue -u "$USER" -o '%.18i %.28j %.9T %.10M %.9l %.6D %R'
sacct -j <JOB_ID> --format=JobID,State,ExitCode,Elapsed,MaxRSS
```

Runtime files live under the configured spool:

```text
inbox/        signed pending requests
processing/   atomically claimed requests
outbox/       signed terminal results
attachments/  per-request temporary uploads
heartbeat.json
audit.jsonl
```

Do not publish raw spool files. The manager API reports sanitized counts and model states only. Public responses must not contain hidden prompts, credentials, access tokens or private chain-of-thought.

## 15. Troubleshooting

- `Demo fallback`: verify GPU worker state, shared spool path, secret path/mode and `STARTFLOW_HPC_TIMEOUT_MS`.
- Quick Tunnel DNS failure: verify the `cloudflared` process; restarting creates a different hostname.
- Tunnel `502`: check `curl http://<WEB_COMPUTE_NODE>:3220/api/health` from the tunnel host.
- Upload `413`: set Nginx `client_max_body_size 130m` and keep the application limit unchanged.
- Request timeout: set proxy read/send timeouts to 300 seconds and confirm a GPU worker is polling.
- Worker model load failure: inspect Slurm `.err`, pinned model path and GPU memory; never enable online download on the compute node.
- Manager shows an older worker: multiple demo workers share one heartbeat file; task results remain valid, but submit one primary chain for a clean operator view.
- Login node becomes slow: stop any local build/test/download process; leave only the bounded lightweight tunnel if policy permits it.
- Gated/license-blocked model: do not bypass terms; use an approved local candidate and retain the manifest status.

## 16. Rollback and clean shutdown

Application rollback is a normal Git revision/worktree deployment; never rewrite shared Git history:

```bash
git worktree add <ROLLBACK_WORKTREE> <KNOWN_GOOD_COMMIT>
```

Stop demo resources after recording job IDs:

```bash
scancel <WEB_JOB_ID> <GPU_JOB_IDS...> <VERIFY_JOB_ID>
```

Stop the foreground Quick Tunnel with `Ctrl-C`. Remove the VPS upstream or point it back to a known-good stable Named Tunnel. Do not delete model snapshots, shared audit results or secrets during an incident until evidence has been preserved.

## 17. Security acceptance

The demo must preserve these invariants:

- no unauthorized high-impact action;
- no approval bypass or self-approval claim;
- banker can see a pending gate but only manager/approver can resolve it;
- no public GPU/model/Slurm endpoint;
- no public database or Keycloak admin port;
- no public cloud model fallback;
- no raw chain-of-thought;
- no credentials or real customer data in source, prompts, logs or screenshots;
- every result must be linked to supplied evidence or explicitly state that evidence is unavailable;
- demo credentials are visibly labelled and never reused for production.

## 18. Known limitations and readiness labels

- Quick Tunnel cannot guarantee 18-hour public uptime; a stable Named Tunnel token/domain is required for that guarantee.
- A checkpoint being downloaded does not prove banking suitability, licensing approval or production readiness.
- The current demo UI shows the planner’s task-level progression after a response; persisted browser SSE/replay from the original full control plane is not the primary path of this simplified assistant.
- DigitalOcean/VPS deployment remains unverified until DNS, TLS and reverse proxy are applied on the user-owned VPS.
- No real banking data or production action has been tested.

Use one honest final state:

```text
DEMO_NOT_READY
DEMO_READY_LOCAL
DEMO_READY_HPC_LOCAL_VLM
DEMO_READY_VPS_REVERSE_PROXY
```

Do not claim the last state until the VPS public domain passes health, upload, local-VLM and approval tests.

## 19. Major changed files

```text
frontend/app/assistant/page.tsx
frontend/app/manager/page.tsx
frontend/app/api/assistant/route.ts
frontend/app/api/manager/status/route.ts
frontend/src/data/agent-catalog.json
frontend/src/data/synthetic-banking-demo.json
frontend/src/features/assistant/assistant-workspace.tsx
frontend/src/features/manager/manager-workspace.tsx
frontend/src/lib/assistant-routing.ts
frontend/src/lib/demo-database.ts
frontend/src/lib/hpc-spool.ts
hpc/spool_protocol.py
hpc/startflow_vlm_worker.py
hpc/startflow-vlm-worker.sbatch
hpc/startflow-web-build.sbatch
hpc/startflow-web-serve.sbatch
hpc/startflow-demo-verify.sbatch
README_DEMO_DEPLOY.md
```
