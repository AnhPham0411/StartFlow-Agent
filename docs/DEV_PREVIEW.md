# DEV PREVIEW — Chạy BE + FE để xem trước luồng (bỏ Keycloak / Postgres tự dựng)

> Mục tiêu: bấm được toàn bộ luồng nghiệp vụ trên trình duyệt **ngay bây giờ**, chưa cần
> dựng Keycloak và chưa cần Postgres server riêng. Model AI thật + Keycloak thật + DB
> production sẽ cắm vào **sau**. File này là bản ghi nhớ quyết định để cả team (và AI agent)
> theo cùng một hướng.

## Quyết định stack tạm

| Thành phần | Preview (tạm) | Sản xuất (sau) |
|-----------|---------------|----------------|
| **Đăng nhập** | **dev-login giả** — `AUTH_MODE=mock`, không cần Keycloak. User demo `demo-reviewer` có sẵn role `analyst + approver + admin` | Keycloak (Authorization Code + PKCE) — `AUTH_MODE=keycloak` |
| **Database** | **Supabase** (Postgres + pgvector) — chỉ đổi `DATABASE_URL` / `AI_DATABASE_URL` | Postgres 18 nội bộ có sẵn |
| **LLM / agent** | Model đã lo hết luồng agent, BE chỉ **gọi → chờ → nhận kết quả**. Xem trước bằng `LLM_MODE=mock` (deterministic, không tốn key) hoặc `openai-compatible` + **gpt-4o-mini** | Provider LLM thật theo quyết định cuối |

Nguyên tắc: **`mock` không bao giờ chạy ở production** — cả backend (`env.validation`) lẫn
frontend (`auth-context`) đều chặn `mock` khi `NODE_ENV=production`.

## Phần đã code cho preview

- `backend/src/config/env.validation.ts` — thêm `AUTH_MODE` (`keycloak|mock`); `KEYCLOAK_*`
  chỉ bắt buộc khi `AUTH_MODE=keycloak`; chặn `mock` ở production.
- `backend/src/modules/auth/jwt-auth.guard.ts` — khi `AUTH_MODE=mock`: bỏ verify Keycloak,
  gán user `demo-reviewer`. Có thể thu hẹp role bằng header `x-dev-roles: analyst,approver`.
  JWKS chỉ được dựng khi thật sự dùng Keycloak (không crash khi thiếu issuer).
- `frontend/src/auth/auth-context.tsx` — `NEXT_PUBLIC_AUTH_MODE=mock` tự đăng nhập demo với
  đủ 3 role (`analyst/approver/admin`) để xem hết trang, kể cả admin.

> ai-service **đã có sẵn** cả hai chế độ LLM (`mock` / `openai-compatible`) trong
> `ai-service/src/core/settings.py` + `clients/llm.py` — chỉ cần đổi biến môi trường, không sửa code.

## Seam đổi "bộ não": luồng mô phỏng tạm ↔ model riêng (AGENT_MODE)

Backend chỉ gọi `POST /runs` rồi chờ event — **không biết** bên trong ai-service dùng luồng nào.
Nhờ đó thay bộ não mà **không đụng backend/frontend**. Điểm cắt: `ai-service/src/api/agent_runner.py`.

| `AGENT_MODE` | Ai xử lý | Trạng thái |
|--------------|----------|-----------|
| `simulate` (mặc định) | `WorkflowRunner` (LangGraph + LLM gpt-4o-mini) trong `src/graph` + `src/agents` + `src/tools` — **luồng MÔ PHỎNG tạm** | Dùng bây giờ để demo |
| `external` | `ExternalAgentRunner` ủy quyền cho **model riêng** ở `EXTERNAL_MODEL_URL` | Dùng SAU; khi bật, code mô phỏng **không được gọi tới** = coi như đã "ẩn", xóa gọn sau |

Cách chuyển sang model riêng (sau này):
1. Đặt `AGENT_MODE=external` + `EXTERNAL_MODEL_URL=<url model riêng>` trong `.env`.
2. Hiện thực `ExternalAgentRunner._to_workflow_state` theo hợp đồng `/agent-run` (ghi trong docstring file đó).
3. (tùy chọn) Xóa `src/graph`, `src/agents`, `src/tools` — không còn được tham chiếu.

> Cả hai provider đều trả `WorkflowState` nên `execute_run` (`src/api/runner.py`) dùng chung một
> đường phát event — không rẽ nhánh. Đã kiểm chứng: 27 test ai-service pass + smoke test chọn đúng provider.

## Seam thứ hai: lời giải thích "vì sao phù hợp SP" (EXPLAINER_MODE)

Chức năng đánh giá 3/6 tháng (`GET /api/nba/customer/:id/assessment`) có seam riêng, cùng
kiểu với `AGENT_MODE`. Điểm cắt: `backend/src/modules/nba/assessment/explainer/`.

| `EXPLAINER_MODE` | Ai viết lời giải thích | Trạng thái |
|------------------|------------------------|-----------|
| `rules` | Không ai — chỉ chuỗi bằng chứng suy diễn xác định từ policy + R1..R12 | Luôn dùng được, miễn phí, tái lập 100% |
| `llm` (đang bật) | `LlmExplainer` gọi OpenAI-compatible diễn đạt lại bảng tiêu chí | **Code TẠM**, xoá khi có model riêng |
| `model` | `ModelExplainer` gọi `EXTERNAL_MODEL_URL` | Dùng SAU; bật lên là nhánh `llm` không còn được nạp |

**Bất biến quan trọng:** bảng tiêu chí đạt/không đạt LUÔN do `PolicyService` tính bằng code.
LLM chỉ nhận bảng đã chấm rồi viết thành câu — **không bao giờ được quyết định đạt hay trượt**.
Nhờ vậy tắt LLM thì chức năng vẫn đủ nghĩa, chỉ mất phần câu chữ mượt.

Chuyển sang model riêng:
1. Đặt `EXPLAINER_MODE=model` + `EXTERNAL_MODEL_URL=<url>` trong `.env`.
2. Hiện thực `ModelExplainer.explain()` — hợp đồng `ExplainInput → ExplainOutput` giữ nguyên,
   không phải sửa service hay UI.
3. Xoá `explainer/llm.explainer.ts` và gỡ khỏi `assessment.module.ts`.

> Chặn bịa số: `LlmExplainer.postCheck` từ chối câu chứa số không truy được về `evidence`,
> và từ chối từ ngữ hứa hẹn ("cam kết", "đảm bảo", "100%"). Hỏng thì trả `degraded_reason`,
> KHÔNG ném lỗi — sale vẫn xem được bảng tiêu chí.

### Nợ kỹ thuật đã biết: R1..R12 tồn tại ở hai nơi

Theo yêu cầu "viết ở BE", bộ rule được chép sang TypeScript trong `assessment/policy.service.ts`,
trong khi bản gốc vẫn ở `apps/ai/src/ranker/rules.py` + `core/config.py`. **Hai bản có thể lệch nhau.**
Ngưỡng gom hết vào `RULE_PARAMS` và có `backend/test/policy-parity.spec.ts` đọc thẳng file Python
để so — sửa một bên mà quên bên kia thì test đỏ. Đây là giảm nhẹ, không phải xoá bỏ rủi ro:
test chỉ bắt được lệch **ngưỡng**, không bắt được lệch **logic**.

## `.env` recipe cho preview

Copy `.env.example` → `.env` rồi đặt các biến sau (những chỗ `<...>` bạn tự điền):

```dotenv
NODE_ENV=development

# --- Đăng nhập: dev-login, bỏ Keycloak ---
AUTH_MODE=mock
NEXT_PUBLIC_AUTH_MODE=mock
# Khi mock, KEYCLOAK_* / NEXT_PUBLIC_KEYCLOAK_* không cần thiết.

# --- Database: Supabase (lấy ở Supabase > Project Settings > Database > Connection string) ---
# Dùng cổng 5432 (session) hoặc 6543 (pooler). Bật sslmode=require.
DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require
AI_DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require
DB_SSL_MODE=require

# --- Bộ não agent: simulate (mô phỏng tạm) hoặc external (model riêng, sau) ---
AGENT_MODE=simulate
# AGENT_MODE=external
# EXTERNAL_MODEL_URL=http://<model-rieng>:PORT

# --- LLM cho luồng simulate: chọn 1 trong 2 ---
# (a) Deterministic, không cần key — xem luồng trước:
LLM_MODE=mock
# (b) Thật bằng OpenAI gpt-4o-mini:
# LLM_MODE=openai-compatible
# LLM_MODEL=gpt-4o-mini
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_API_KEY=<OpenAI API key>

# --- Nội bộ ---
AI_SERVICE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api
INTERNAL_SERVICE_TOKEN=<chuỗi ngẫu nhiên >=16 ký tự>
INTERNAL_CALLBACK_URL=http://localhost:3001/internal/ai/events
```

## Cách chạy

```powershell
# 1. Cài phụ thuộc (Node 22 / pnpm 10)
pnpm install --frozen-lockfile

# 2. Tạo schema trên Supabase (chạy 1 lần)
pnpm --filter @startflow/backend exec prisma migrate deploy
#    ai-service (pgvector) migrate bằng Alembic khi bật LLM openai-compatible

# 3. Chạy BE + FE (mỗi cái 1 terminal, hoặc dùng script dev tổng)
pnpm --filter @startflow/backend dev      # http://localhost:3001
pnpm --filter @startflow/frontend dev     # http://localhost:3000
#    Cần LLM thật thì chạy thêm ai-service (uv run) với LLM_MODE=openai-compatible
```

Mở `http://localhost:3000` → tự vào thẳng workspace (dev-login) → tạo case → chạy run →
xem timeline → approve → so sánh SINGLE/MULTI → knowledge.

## Việc còn nợ (làm sau)

- [ ] Cắm Keycloak thật (`AUTH_MODE=keycloak`) + role mapping từ `infra/keycloak`.
- [ ] Chuyển `AGENT_MODE=external` + hiện thực `ExternalAgentRunner._to_workflow_state` để dùng model riêng; xóa luồng mô phỏng `src/graph|agents|tools`.
- [ ] Chốt provider LLM production (thay gpt-4o-mini tạm) — chỉ áp dụng khi còn dùng luồng simulate.
- [ ] Chuyển DB từ Supabase tạm sang Postgres 18 nội bộ khi lên production.
- [ ] (tùy chọn) Role-picker trên dev-login để test từng role qua header `x-dev-roles`.

## Secrets bạn cần tự cung cấp

1. **Supabase**: password + project ref cho `DATABASE_URL` / `AI_DATABASE_URL`.
2. **OpenAI** (chỉ khi bật LLM thật): `LLM_API_KEY` cho `gpt-4o-mini`.
3. **INTERNAL_SERVICE_TOKEN**: tự sinh chuỗi ngẫu nhiên ≥16 ký tự.
