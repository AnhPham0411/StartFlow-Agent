---
name: startflow-hackathon-multi-agent
description: Đặc tả đã duyệt cho MVP multi-agent đánh giá hồ sơ vay doanh nghiệp.
contract_id: SFA-20260717-001
requirement_id: SF-HACKATHON-001
approvedAt: "2026-07-17T16:16:47+07:00"
approvedBy: nghiatt15@onemount.com
approval_source: explicit-user-choice
track: fullstack
target_root_kind: target-project
stack_profile: general
profile_confidence: high
sourceDraftPath: .sdcorejs/docs/fullstack/2026-07-17-16-09-startflow-hackathon-multi-agent-spec.md
approved_spec_hash: be8d968b1ff9f260f97681ab0f7d5f94105ed148c96c7f758cea849c92624453
acceptance_criteria_count: 24
manual_criteria_count: 2
redaction_applied: true
supersedes: null
change_control:
  revision: 1
  supersedes: null
  change_reason: null
---

# StartFlow AI Multi-Agent Banking Workflow - Approved Spec

> Snapshot of what the user approved at the `sdcorejs-spec` gate. Do not edit by hand; re-author through `sdcorejs-spec` if the contract changes.

## Approved contract

# Spec - StartFlow AI Multi-Agent Banking Workflow - 2026-07-17 16:09

```yaml
spec_context:
  source: sdcorejs-spec
  contract_id: SFA-20260717-001
  requirement_id: SF-HACKATHON-001
  approved_spec_path: .sdcorejs/specs/fullstack/2026-07-17-16-16-startflow-hackathon-multi-agent.md
  approved_spec_hash: be8d968b1ff9f260f97681ab0f7d5f94105ed148c96c7f758cea849c92624453
  supersedes: null
  target_root: C:/Users/nghiatt15_onemount/Documents/StartFlow-Agent
  target_root_kind: target-project
  track: fullstack
  stack_profile: general
  profile_confidence: high
  profile_evidence:
    - ReadMe.md mô tả mục tiêu AI ngân hàng nhưng chưa có source code triển khai
    - backend/ và frontend/ đang trống; chưa có package manifest hoặc framework config
    - người dùng yêu cầu rõ Next.js, NestJS, Python AI service, PostgreSQL 18, Keycloak, Docker và GitHub Actions
  source_requirement_context: SF-HACKATHON-001
  acceptance_criteria_count: 24
  manual_criteria_count: 2
  non_goals:
    - Tích hợp core banking, CIC, KYC hoặc AML thật
    - Xử lý dữ liệu khách hàng thật hoặc PII thật
    - Mở rộng đủ tám agent tư vấn độc lập như README cũ
    - High availability, autoscaling đa node và disaster recovery
    - Tự động phê duyệt hoặc giải ngân khoản vay
  risks:
    - Phạm vi full-stack lớn so với 48 giờ
    - LLM hoặc embedding API có thể không ổn định trong lúc demo
    - PostgreSQL 18 có sẵn cần bật pgvector hoặc cấp quyền migration phù hợp cho RAG
    - Droplet dùng chung có nguy cơ xung đột cổng, tài nguyên và Docker network
    - RAG demo có thể trả về citation yếu nếu dữ liệu seed chưa đủ chất lượng
  assumptions:
    - Use case duy nhất của MVP là đánh giá hồ sơ vay doanh nghiệp
    - Dữ liệu hồ sơ, KYC, AML và chính sách đều là dữ liệu demo không nhạy cảm
    - Mọi môi trường kết nối tới PostgreSQL 18 và Keycloak có sẵn bằng cấu hình environment
    - Docker Compose và GitHub Actions không provision hoặc chạy PostgreSQL/Keycloak mới
    - PostgreSQL có sẵn cung cấp database/schema tách biệt và hỗ trợ extension `vector`
    - Domain, chứng thư TLS, SSH key và toàn bộ secret được cung cấp qua GitHub Environments
    - AI provider dùng giao thức tương thích OpenAI và có deterministic mock mode
  redaction_applied: true
  approval:
    approved: true
    approved_at: 2026-07-17T16:16:47+07:00
    approval_source: explicit-user-choice
  change_control:
    revision: 1
    supersedes: null
    change_reason: null
```

## Problem & Goals

StartFlow cần chứng minh một hệ thống AI đa tác nhân thực sự thực hiện công việc ngân hàng, thay vì chỉ định tuyến câu hỏi đến một chatbot chuyên môn. MVP phục vụ analyst, approver và ban giám khảo hackathon qua một kịch bản duy nhất: đánh giá hồ sơ vay của doanh nghiệp, phát hiện rủi ro pháp lý, tìm tài liệu còn thiếu và đề xuất bước vận hành tiếp theo.

Mục tiêu thành công:

- Planner tạo kế hoạch và giao cùng một yêu cầu cho Credit, Compliance và Operations Agent.
- Mỗi agent dùng ít nhất một nguồn tri thức hoặc công cụ nghiệp vụ và trả kết quả có căn cứ.
- Hệ thống tổng hợp kết quả, phát hiện xung đột và chặn hành động nhạy cảm cho đến khi con người phê duyệt.
- Người dùng quan sát được toàn bộ tiến trình, citation, tool call, trạng thái và audit event trên dashboard.
- Cùng một hồ sơ có thể chạy chế độ single-agent để so sánh với multi-agent theo rubric nhất quán.
- Ba application service chạy bằng Docker Compose, kết nối PostgreSQL 18 và Keycloak có sẵn qua env; GitHub Actions triển khai chúng lên app droplet hiện hữu.

## Users & permissions

- `analyst`: tạo hồ sơ demo, khởi chạy workflow, xem kết quả và chạy phép so sánh.
- `approver`: có toàn bộ quyền analyst và được approve/reject hành động được đề xuất.
- `admin`: quản lý knowledge documents, xem audit log và cấu hình demo không chứa secret.
- Backend là điểm cưỡng chế quyền; frontend chỉ ẩn hoặc hiện hành động để hỗ trợ trải nghiệm.

## Non-goals

- Không tích hợp hoặc giả vờ kết nối core banking, CIC, KYC/AML production.
- Không thu thập CCCD, số tài khoản, hồ sơ tài chính thật hoặc dữ liệu khách hàng thật.
- Không tự phê duyệt tín dụng, giải ngân hoặc thay đổi hệ thống ngân hàng thật.
- Không xây tám agent tư vấn sản phẩm trong README cũ ở MVP.
- Không triển khai Kubernetes, message broker, autoscaling, HA hoặc multi-region.
- Không provision, nâng cấp hoặc chạy container PostgreSQL/Keycloak; vòng đời của hai dịch vụ có sẵn nằm ngoài repository này.
- Không hiển thị chain-of-thought hay prompt nội bộ; dashboard chỉ hiển thị kế hoạch, sự kiện, tool call đã lọc, căn cứ và kết luận.

## Functional scope

### Case intake

- Tạo hồ sơ vay doanh nghiệp từ form gồm thông tin doanh nghiệp giả lập, số tiền đề nghị, mục đích vay, số liệu tài chính và danh sách tài liệu đã nộp.
- Cung cấp ít nhất hai fixture: một hồ sơ có thể đề xuất phê duyệt có điều kiện và một hồ sơ bị chặn bởi compliance hoặc thiếu tài liệu.
- Cho phép xem danh sách, trạng thái và chi tiết các workflow run của từng hồ sơ.

### Multi-agent orchestration

- Planner phân rã yêu cầu thành ba task có dependency và success condition rõ ràng.
- Credit Agent tính các tỷ lệ tài chính bằng deterministic calculator, truy xuất chính sách tín dụng và đưa ra risk band.
- Compliance Agent gọi mock KYC/AML tool, truy xuất quy định và phát hiện hard-stop hoặc điều kiện bổ sung.
- Operations Agent đối chiếu checklist hồ sơ, liệt kê tài liệu thiếu và tạo đề xuất action ticket.
- Synthesizer hợp nhất kết quả, nhận diện mâu thuẫn và trả decision status thuộc `RECOMMEND`, `NEEDS_REVIEW` hoặc `BLOCKED`.
- Workflow tiếp tục tạo báo cáo ngay cả khi một agent lỗi; kết quả phải đánh dấu rõ phần thiếu và không được nâng mức tin cậy.

### RAG and tools

- Knowledge seed gồm tài liệu demo về chính sách tín dụng, KYC/AML, pháp lý và checklist vận hành; mọi tài liệu ghi rõ là dữ liệu mô phỏng cho hackathon.
- Retrieval lưu citation gồm document, section/chunk, excerpt ngắn và relevance score.
- Tool registry ghi lại tool name, thời điểm, latency, input đã lọc và output tóm tắt.
- LLM không được tự khai báo đã gọi tool khi không có tool event tương ứng.
- Mock mode tạo kết quả lặp lại được để demo khi API key hoặc internet không khả dụng.

### Human approval and audit

- Operations Agent chỉ tạo đề xuất; Action Ticket chỉ được ghi nhận sau khi approver approve.
- Approve/reject yêu cầu reason, user identity, timestamp và optimistic concurrency để tránh phê duyệt hai lần.
- Audit log append-only ghi lại case creation, run state changes, agent events, tool events, approval và ticket creation.
- Payload audit và UI phải che API key, token, password và trường dữ liệu được đánh dấu nhạy cảm.

### Dashboard and comparison

- Dashboard có tổng quan hồ sơ, số run theo trạng thái, thời gian xử lý và số item chờ phê duyệt.
- Trang case detail hiển thị plan, agent cards, dependency, timeline realtime qua SSE, citations, findings và final recommendation.
- Trang comparison chạy baseline single-agent trên cùng snapshot đầu vào và hiển thị completeness, citation coverage, tool use, conflict detection, latency và rubric score.
- Khi refresh trang, lịch sử event và kết quả vẫn được dựng lại từ PostgreSQL.

## Architecture

```text
Browser / Next.js dashboard
          |
          | OIDC PKCE + Keycloak access token
          v
NestJS API -------------------------------------------------- PostgreSQL 18
  | cases, runs, approvals, audit, SSE                           | app data
  |                                                             | AI/RAG data + pgvector
  | internal signed request / filtered callback events           | Keycloak data
  v                                                             |
FastAPI + LangGraph ---------------------------------------------+
  Planner -> Credit / Compliance / Operations -> Synthesizer
              | RAG | calculator | mock KYC/AML | checklist
```

- Next.js App Router cung cấp dashboard responsive; dữ liệu nghiệp vụ đi qua NestJS, không gọi trực tiếp AI service hoặc database.
- NestJS cung cấp REST API, xác thực Keycloak JWT qua JWKS, kiểm tra role, lưu audit và phát SSE. NestJS dùng Prisma cho application data và migrations.
- FastAPI dùng LangGraph để mô hình hóa state machine đa agent. AI service nhận snapshot hồ sơ, thực thi background run và gửi filtered event về callback nội bộ của NestJS bằng service token.
- Python dùng SQLAlchemy/pgvector cho knowledge ingestion và retrieval; không ghi trực tiếp vào application tables của NestJS.
- PostgreSQL 18 và Keycloak là external dependencies có sẵn. App và AI/RAG dùng database/schema cùng credentials riêng; Keycloak tiếp tục sở hữu datastore của nó ngoài phạm vi triển khai này.
- Docker Compose chỉ chứa frontend, backend và AI service. Cả local lẫn production nhận URL, issuer, realm, client và database connection qua env.
- AI service chỉ nằm trên Docker network nội bộ. Frontend và API được Nginx publish; trình duyệt truy cập hostname Keycloak có sẵn qua `NEXT_PUBLIC_KEYCLOAK_URL`.

## Stack profile and technology assumptions

- Track: `fullstack`.
- Detected stack profile: `general`; repository chưa có package manifest nên chưa thể chứng minh một profile framework đã tồn tại.
- Explicit stack: Next.js App Router, NestJS, Python/FastAPI/LangGraph, PostgreSQL 18, Keycloak, Docker Compose và GitHub Actions.
- Selected persistence: Prisma cho NestJS application data; SQLAlchemy + pgvector trên PostgreSQL 18 có sẵn cho AI/RAG data.
- Selected integration style: REST cho commands/queries, SSE cho timeline và signed internal callbacks cho agent events.
- Dependency versions sẽ dùng stable release tương thích tại thời điểm scaffold, được khóa bằng lockfile và image digest/tag; không dùng floating `latest` trong production.
- UI labels và tài liệu demo dùng tiếng Việt có dấu; identifiers, route paths, role names và event names dùng tiếng Anh.

## API and event contracts

- `GET /health` và `GET /ready` trả tình trạng process cùng dependency tối thiểu.
- `GET|POST /api/cases` và `GET /api/cases/:caseId` quản lý hồ sơ demo.
- `POST /api/cases/:caseId/runs` tạo immutable input snapshot và khởi chạy multi-agent workflow.
- `GET /api/runs/:runId` trả plan, agent results, citations, decision và approval state.
- `GET /api/runs/:runId/events` phát SSE có event ID tăng dần và hỗ trợ resume bằng `Last-Event-ID`.
- `POST /api/runs/:runId/approvals` approve hoặc reject proposed action theo role.
- `POST /api/cases/:caseId/comparisons` chạy baseline single-agent trên cùng snapshot.
- `GET|POST /api/knowledge` dành cho admin để liệt kê và ingest tài liệu demo.
- Internal callback yêu cầu service token, run ID hợp lệ và idempotency key; endpoint không được public qua Nginx.

Event công khai chỉ gồm `run.started`, `plan.created`, `agent.started`, `tool.completed`, `citation.added`, `agent.completed`, `synthesis.completed`, `approval.required`, `run.completed` và `run.failed`. Event không chứa chain-of-thought hoặc secret.

## Data boundaries

- Application data: users tham chiếu bằng Keycloak subject, cases, case snapshots, runs, tasks, events, findings, citations, approvals, action tickets và audit logs.
- AI data: knowledge documents, chunks, embeddings, ingestion jobs và evaluation rubric results.
- Keycloak data: realm/client/roles và demo accounts nằm trên Keycloak có sẵn; repository chỉ cung cấp template/reconciliation script không chứa password thật.
- Mọi fixture phải dùng tên doanh nghiệp hư cấu và được gắn nhãn `DEMO_DATA`.
- Case snapshot bất biến sau khi run bắt đầu để single-agent và multi-agent được so sánh trên cùng dữ liệu.

## Authentication & security

- Keycloak sử dụng Authorization Code + PKCE; frontend không lưu refresh token trong localStorage.
- NestJS xác minh issuer, audience, signature, expiry và role trước khi xử lý request.
- CORS chỉ cho phép origin cấu hình; production không dùng wildcard.
- Internal service token, LLM key, database credentials và SSH key chỉ tồn tại trong local `.env` bị ignore hoặc GitHub encrypted secrets/environments.
- `.env.example` chỉ chứa tên biến và giá trị phát triển không nhạy cảm; biến secret dùng `[REDACTED]` hoặc mô tả bắt buộc.
- Rate limit áp dụng cho tạo run, comparison và knowledge ingestion.
- Logs sử dụng correlation ID và redaction; không ghi Authorization header, cookies hoặc raw prompt chứa trường nhạy cảm.

## Deployment & CI/CD

- `.github/workflows/ci.yml` chạy install có lockfile, lint, typecheck, unit/integration test, production build, Python checks và `docker compose config` trên pull request/push.
- `.github/workflows/deploy.yml` chỉ deploy từ branch được phép và gọi reusable workflow trong `devops-config` bằng commit/tag ref được cấu hình.
- `devops-config` thêm workflow, script, Nginx templates và env examples riêng dưới namespace `startflow-agent`; không sửa hành vi deploy `enterprise-platform`.
- Workflow build ba application images trên runner, chuyển image qua SSH theo convention hiện có, chuẩn bị runtime env mode `600`, chạy migration trước khi đổi container và kiểm tra health sau deploy.
- Deploy workflow không tạo hoặc restart PostgreSQL/Keycloak; preflight chỉ kiểm tra kết nối, issuer/JWKS và quyền migration trước khi thay application containers.
- Container/project/network/port đều có tên riêng để không đụng ứng dụng khác trên cùng droplet.
- Production database connection tuân thủ TLS/fail-closed convention đang có trong `devops-config`.
- Actual deployment chỉ chạy khi GitHub Environment đã có domain, verified known-hosts, SSH key, DB TLS material và runtime secrets.

## Environment example contract

Các file example ghi rõ nhóm key sau, không chứa secret thật:

- App URLs: `APP_URL`, `API_URL`, `AUTH_URL`, `CORS_ORIGINS`.
- PostgreSQL: `DATABASE_URL`, `AI_DATABASE_URL`, `DB_SSL_MODE`, `DB_SSL_ROOT_CERT` và các key TLS cần thiết cho server có sẵn.
- Keycloak: `KEYCLOAK_URL`, `KEYCLOAK_ISSUER`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_AUDIENCE` và browser-safe public counterparts.
- AI: `AI_SERVICE_URL`, `LLM_MODE`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL`, `RAG_TOP_K`.
- Internal trust: `INTERNAL_SERVICE_TOKEN`, `INTERNAL_CALLBACK_URL`.
- Browser-safe: chỉ các key thực sự public mang prefix `NEXT_PUBLIC_`; không expose secret hoặc internal URL.
- Deploy: hostname, container port, Docker network, droplet path và health-check keys theo convention `devops-config`.

## File structure

- `frontend/` - Next.js App Router, dashboard pages, auth client, SSE client và component tests.
- `backend/` - NestJS REST/SSE API, Prisma schema/migrations, authorization, audit và tests.
- `ai-service/` - FastAPI/LangGraph graph, agents, tools, RAG, evaluation, mock mode và Python tests.
- `knowledge/seed/` - tài liệu ngân hàng mô phỏng có metadata và citation IDs ổn định.
- `test/e2e/` - Playwright journeys và cross-stack fixtures.
- `infra/keycloak/` - realm/client/role template hoặc reconciliation script cho Keycloak có sẵn, không chứa password thật.
- `docker-compose.yml` - frontend, backend và AI service kết nối external dependencies qua env.
- `docker-compose.prod.yml` - production overrides cho ba application service, không quản lý PostgreSQL/Keycloak.
- `.env.example` - local configuration contract.
- `.env.production.example` - production key contract, toàn bộ secret được redacted.
- `.github/workflows/ci.yml` - verification workflow.
- `.github/workflows/deploy.yml` - caller workflow cho `devops-config`.
- `docs/` - architecture, demo script, data sources, security assumptions và deployment guide.
- `product/`, `design/`, `.sdcorejs/` - requirement, design handoff, traceability và approved artifacts.
- `ReadMe.md` - thay mô tả router tám agent bằng scope multi-agent đã duyệt.
- `C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/projects/startflow-agent/` - runtime env examples và Nginx config riêng.
- `C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/.github/workflows/deploy-startflow-agent.yml` - reusable deploy workflow.
- `C:/Users/nghiatt15_onemount/Documents/github-local-solution/devops-config/scripts/deploy-startflow-agent.sh` - remote deployment orchestration.

## Verification strategy

- TDD cho planner routing, decision matrix, financial calculator, compliance hard-stop, checklist, approval concurrency và event idempotency.
- Integration tests cho NestJS auth/role/API/SSE, Prisma persistence, FastAPI graph và pgvector retrieval.
- E2E tối thiểu cho login, tạo hồ sơ, xem ba agent chạy, xem citation, approve action và comparison.
- External LLM, KYC/AML và clock được mock trong CI; smoke test có thể bật provider thật qua protected environment.
- Docker verification gồm config validation, ba application image build, external-dependency preflight, health checks và một demo journey bằng mock mode.

## Acceptance criteria

- AC-001 - Với env hợp lệ, `docker compose up --build` khởi động frontend, backend và AI service; readiness xác nhận kết nối PostgreSQL 18 và Keycloak có sẵn mà không tạo container mới cho hai dependency này.
- AC-002 - Analyst đăng nhập qua Keycloak và truy cập dashboard; người chưa đăng nhập bị chuyển tới login.
- AC-003 - Backend trả 401 cho token thiếu/không hợp lệ và 403 khi role không đủ cho endpoint được bảo vệ.
- AC-004 - Analyst tạo được case từ fixture và dữ liệu được lưu với nhãn demo cùng immutable run snapshot.
- AC-005 - Khi tạo run, Planner sinh đúng ba task Credit, Compliance, Operations với dependency và trạng thái quan sát được.
- AC-006 - Mỗi specialist agent tạo ít nhất một tool hoặc retrieval event có latency và output tóm tắt đã lọc.
- AC-007 - Credit result chứa các tỷ lệ từ calculator, risk band và ít nhất một citation chính sách.
- AC-008 - Compliance result chứa kết quả mock KYC/AML, hard-stop/condition và citation quy định.
- AC-009 - Operations result chứa checklist hồ sơ, danh sách tài liệu thiếu và proposed action.
- AC-010 - Synthesizer hợp nhất ba kết quả, phát hiện conflict và chỉ trả một trong ba decision status đã quy định.
- AC-011 - Nếu một agent lỗi, run vẫn kết thúc với partial-result marker, confidence không tăng và UI nêu rõ agent bị lỗi.
- AC-012 - SSE hiển thị event theo thứ tự, reconnect bằng `Last-Event-ID` không tạo duplicate và refresh trang dựng lại được timeline.
- AC-013 - Citation trên UI liên kết tới đúng knowledge document, section/chunk và excerpt được lưu.
- AC-014 - Dashboard không hiển thị chain-of-thought, raw secret, Authorization header hoặc trường đã đánh dấu nhạy cảm.
- AC-015 - Analyst không thể tạo Action Ticket trực tiếp; approver approve/reject được với reason và audit identity.
- AC-016 - Hai approval cạnh tranh chỉ có một thao tác thành công; thao tác còn lại nhận conflict response và không tạo ticket trùng.
- AC-017 - Comparison dùng cùng case snapshot và hiển thị single-agent/multi-agent theo sáu metric đã xác định.
- AC-018 - Mock mode chạy cùng fixture cho kết quả ổn định, không cần LLM API key và hoàn tất demo journey tự động.
- AC-019 - Admin ingest được knowledge seed; non-admin bị từ chối; retrieval trả citation cho ít nhất một câu hỏi kiểm thử mỗi domain.
- AC-020 - Unit, integration và E2E tests trọng yếu chạy trong CI; không có test bị skip để làm xanh pipeline.
- AC-021 - `.env.example` và `.env.production.example` chứa đủ key contract, không chứa credential hoặc secret thật.
- AC-022 - Pull request CI chạy lint, typecheck, tests, builds và Docker Compose validation với lockfile reproducible.
- AC-023 `[Manual]` - GitHub Actions deploy ba application service từ branch được phép lên app droplet, không ảnh hưởng `enterprise-platform` hoặc restart PostgreSQL/Keycloak có sẵn, chạy migration và health smoke thành công khi env/secrets/domain đã được cấp.
- AC-024 `[Manual]` - Demo script hoàn tất trong tối đa 10 phút: login, tạo case, theo dõi ba agent, xem tool/citation, xem final decision, approve action và mở comparison.

## Risks & mitigations

- **Risk:** Full stack quá lớn cho 48 giờ. -> **Mitigation:** khóa một use case, ba agent, bốn tool và một dashboard journey; mọi mở rộng khác bị defer.
- **Risk:** Provider LLM/embedding lỗi trong demo. -> **Mitigation:** mock mode deterministic là luồng dự phòng bắt buộc và dùng trong CI.
- **Risk:** Agent hallucinate tool usage hoặc citation. -> **Mitigation:** tool/citation chỉ được ghi từ execution event thật; synthesizer nhận structured result, không nhận claim tự do.
- **Risk:** Shared droplet thiếu RAM hoặc xung đột cổng. -> **Mitigation:** unique Compose project/container/port, resource limits, preflight và health rollback trong deploy script.
- **Risk:** PostgreSQL 18 có sẵn chưa bật pgvector hoặc app role thiếu quyền migration. -> **Mitigation:** preflight extension/quyền trước deploy, fail trước khi đổi container và ghi rõ lệnh chuẩn bị database cho operator.
- **Risk:** Callback event bị gửi lặp hoặc sai thứ tự. -> **Mitigation:** idempotency key, monotonic sequence per run và unique database constraint.
- **Risk:** Lộ secret qua dashboard/log. -> **Mitigation:** allowlist event schema, centralized redaction, secret scanning và negative tests.
- **Risk:** Actual droplet smoke chưa thể chạy trong môi trường local. -> **Mitigation:** tách AC manual, validate workflow/script tĩnh và cung cấp checklist secrets trước deploy.

## Out of scope (deferred)

- Thêm Product, Insurance, Card hoặc Customer Support Agent - chỉ sau khi demo credit workflow đạt đủ acceptance criteria.
- Core banking, CIC, eKYC hoặc AML vendor integration - chỉ khi có sandbox contract và security approval.
- Provision hoặc thay đổi vòng đời PostgreSQL/Keycloak có sẵn - chỉ thực hiện trong repository hạ tầng sở hữu hai dịch vụ đó và có phê duyệt riêng.
- Langfuse/OpenTelemetry full stack - chỉ khi dashboard trace nội bộ ổn định và còn ngân sách droplet.
- Real-time distributed queue và retry workers - chỉ khi cần chịu tải hoặc khôi phục run sau process restart.
- Fine-tuning, evaluation dataset quy mô lớn và model governance - chỉ sau hackathon.
- HA, autoscaling, backup automation và incident runbook - thuộc giai đoạn production readiness riêng.


## Decisions captured during review

- Người dùng xác nhận PostgreSQL 18 và Keycloak đã có sẵn; toàn bộ connection/issuer/client information được cấp qua environment variables.
- Docker Compose và GitHub Actions chỉ quản lý ba application service, không provision, chạy thêm hoặc restart PostgreSQL/Keycloak.
- Approved on the first spec review response with the clarification above.

## Skill provenance

sdcorejs-spec (approved on attempt 1 / 3)
