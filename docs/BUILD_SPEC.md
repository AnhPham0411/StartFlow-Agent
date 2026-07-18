# BUILD SPEC — BẢN THIẾT KẾ TRIỂN KHAI CHO AI CODING AGENT
# SHB Next Best Action Engine

**Phiên bản:** 1.0 · **Ngày:** 18/07/2026
**Đối tượng đọc:** Claude Code (hoặc dev). Tài liệu này KHÔNG lặp lại logic nghiệp vụ — logic đã chốt trong bộ tài liệu nguồn. Đây là bản ánh xạ: logic đó nằm ở file nào, hàm nào, ký hiệu gì, thứ tự code, và nghiệm thu bằng lệnh nào.

## 0 · NGUỒN CHÂN LÝ & CÁCH DÙNG

Đọc theo thứ tự trước khi code:
1. `docs/AGENT_SPEC.md` — contract input/output, tham số, các bước xử lý từng module (M1–M13, AG1–AG6). **Code làm đúng theo đây.**
2. `docs/SCHEMA_SPEC.md` + `db/schema_v1_1.sql` — 27 bảng, ai đọc/ai ghi. **Không tự thêm bảng/cột; cần field mới → vào `profiles.features` JSONB.**
3. `docs/PRD_NGHIEP_VU.md` — chi tiết A1 (ETL/Extraction/Geo).
4. `docs/MASTER_PLAN.md` — scope; thứ gì không có trong scope thì KHÔNG code.

Khi mâu thuẫn: MASTER_PLAN (scope) → PRD_NGHIEP_VU (A1+geo) → AGENT_SPEC (contract/tham số) → tài liệu này (mapping code). Tài liệu này thua mọi tài liệu trên về nghiệp vụ, chỉ thắng về tên file/hàm/thứ tự.

## 1 · LUẬT CỨNG KHI CODE (vi phạm = fail review, không thương lượng)

| # | Luật | Cơ chế ép trong code |
|---|------|----------------------|
| L1 | LLM không bao giờ chấm điểm/xếp hạng (D2, D7) | `scoring/`, `ranker/` CẤM import từ `llm/`. Test `test_import_guard.py` quét AST, fail CI nếu vi phạm |
| L2 | `recommendations`, `audit_log` append-only | Repository layer KHÔNG có hàm update/delete cho 2 bảng này; DB trigger là lớp 2 |
| L3 | PII boundary: chỉ `extraction/` được đọc `transactions.content/counterparty`; contract sang AG2..6 không chứa tên khách, số tài khoản, nội dung CK thô | Hàm duy nhất build contract: `scripting/contract.py::build_contract()` — có test khẳng định output không chứa các trường cấm |
| L4 | Mọi con số trong hook đến từ `slots_used` → catalog | Validator V2 là chốt chặn; agent tự check trước (Self-check) |
| L5 | Geo không xuất hiện trong ranker | `ranker/rules.py` không đọc `customer_geo`; test khẳng định `rules_applied` toàn batch không có mã geo |
| L6 | Tham số tập trung 1 file `core/config.py`, giá trị mặc định = bảng AGENT_SPEC §12 | Không hardcode số ở module; mọi ngưỡng đọc từ Settings |
| L7 | Orchestrator fail-fast: stage lỗi sau retry → run failed, không ghi recommendation nửa vời | `batch/orchestrator.py` |
| L8 | Scoring chỉ load weights `is_production=true`; mean/std đọc từ file weights, không tính lại | `scoring/loader.py` |
| L9 | Mỗi task xong phải pass acceptance của nó rồi mới sang task sau | Lệnh test ghi ở từng task §5 |
| L10 | LLM gọi qua interface `LLMProvider`; có `StubProvider` deterministic để test/demo offline | `llm/provider.py` |

## 2 · CÂY REPO (tạo đúng cấu trúc này)

```
shb-nba-engine/
├── CLAUDE.md                      # bản rút gọn §1 + trỏ tới docs (nội dung ở §10)
├── docs/                          # 5 tài liệu nguồn (đã có, copy vào)
├── db/
│   ├── schema_v1_1.sql            # đã có, chạy nguyên trạng
│   └── test_schema.sql            # đã có — nghiệm thu DB: 7/7 PASS
├── docker-compose.yml             # postgres16+pgvector, langfuse, redis(optional-off)
├── apps/ai/                       # FastAPI · Python 3.11 · uv
│   ├── pyproject.toml
│   └── src/
│       ├── main.py                # FastAPI app, mount routers
│       ├── core/
│       │   ├── config.py          # Settings(BaseSettings) — TOÀN BỘ tham số §12 AGENT_SPEC
│       │   ├── db.py              # asyncpg pool + helper
│       │   └── tracing.py         # Langfuse init + decorator @traced(stage)
│       ├── llm/
│       │   ├── provider.py        # class LLMProvider(Protocol); LocalProvider, ApiProvider, StubProvider
│       │   └── stubs/             # fixture JSON cho StubProvider (extraction + scripting)
│       ├── etl/engine.py          # M1: compute_features(customer_id, asof) -> dict  [E1..E10]
│       ├── extraction/
│       │   ├── preprocessor.py    # AG1.1: batch20, amount_band, counterparty_kind
│       │   ├── tagger.py          # AG1.2: prompt + gọi provider
│       │   ├── guard.py           # AG1.3: parse, lọc conf, chặn tag lạ
│       │   ├── promote.py         # txn_tags -> customer_tags (>=2/90d, PERIODIC_GAP, tag hợp thành)
│       │   └── taxonomy.py        # load tag approved từ DB
│       ├── geo/matcher.py         # M2: match ward -> zone; cờ geo_x_kinhdoanh
│       ├── profiling/merger.py    # M3: merge 3 nhánh -> profiles
│       ├── scoring/
│       │   ├── loader.py          # M4: load weights production + mean/std
│       │   └── engine.py          # score_all(run_id) -> ghi scores (numpy vectorized)
│       ├── ranker/
│       │   ├── rules.py           # R1..R12 — mỗi rule 1 hàm thuần (profile, ctx) -> RuleHit|None
│       │   └── engine.py          # M5: apply order hardblock->multiplier->top2
│       ├── calllist/filter.py     # M6
│       ├── scripting/
│       │   ├── contract.py        # build_contract() — CHỐT PII (L3)
│       │   ├── agents.py          # AG2..6: 1 class DomainAgent + 5 config nghiệp vụ
│       │   ├── prompts/           # 5 file prompt .md theo AGENT_SPEC §7
│       │   ├── tools.py           # catalog_lookup, loan/interest/fee_calculator, tier_checker
│       │   └── rag.py             # rag_retrieval (pgvector cosine, k=2, min_cases=30)
│       ├── validator/
│       │   ├── patterns.py        # V1 regex nhóm cấm (FULL_SPEC C5)
│       │   ├── slots.py           # V2 đối chiếu số -> slots_used -> catalog
│       │   ├── template.py        # V3 similarity template BH/đầu tư
│       │   └── engine.py          # M7: chain V1->V2->V3, regen<=2, fallback, ghi validator_log
│       ├── batch/
│       │   ├── orchestrator.py    # M0: run_nightly(), run_mini(customer_id)
│       │   └── sink.py            # M8: insert recommendations (version+1, snapshot hash)
│       ├── feedback/
│       │   ├── outcome.py         # M11: join core mock -> outcomes
│       │   └── ragwriter.py       # M13
│       ├── training/
│       │   ├── train.py           # M12: train logistic per product
│       │   └── gates.py           # 4 cửa: auc/lift/calibration/baseline -> gates dict
│       ├── api/routes.py          # §6 FastAPI endpoints
│       └── seed/
│           ├── generator.py       # 1.000 khách + 90 ngày txn (quy tắc §7)
│           └── fixtures/          # zones.json (12 zone), catalog.json (20 gói), taxonomy.json (15 tag), rag_seed.json (30 case), templates/
├── apps/api/                      # Nest.js (bỏ nếu kích hoạt đường cắt C1)
│   └── src/{auth,nba,feedback,admin,audit}/   # §6 endpoints, staleness trong nba.service
└── apps/web/                      # Next.js 14 App Router
    └── app/{login,calllist,customer/[id],admin,tags}/ + components §8
```

## 3 · CONFIG TRUNG TÂM

`core/config.py`: một class `Settings(BaseSettings)` chứa ĐÚNG bảng tham số AGENT_SPEC §12 (EXTRACT_BATCH_SIZE=20, CONF_MIN=0.70, TAG_MIN_TXN=2, TAG_WINDOW_D=90, PERIODIC_GAP_MIN/MAX=25/35, GEO_NORM_CONF_MIN=0.80, BIZ_INFLOW_MIN=15, BIZ_PARTNER_MIN=8, SALARY_*, SUPPRESSION_DAYS=90, CONTACT_COOLDOWN_D=14, LOCK_DAYS=30, TOP_N=2, SCRIPT_TIMEOUT_S=30, MAX_REGEN=2, RAG_K=2, RAG_MIN_CASES=30, TEMPLATE_SIM_MIN=0.75, STALE_CASA_PCT=20, STALE_DEBT_PCT=15, BIG_EVENT_VND=5e8, OUTCOME_WINDOW_D=30, AUC_MIN=0.70, LIFT10_MIN=2.0, CALIB_BIN_MAX_PCT=5, TEMP_EXTRACT=0.0, TEMP_SCRIPT=0.4) + `LLM_MODE=stub|local|api`, `LOCAL_LLM_URL`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `LANGFUSE_*`.
`.env.example` liệt kê đủ, default chạy được với `LLM_MODE=stub` (không cần key nào).

## 4 · LLM PROVIDER (L10)

```python
class LLMProvider(Protocol):
    async def complete_json(self, system: str, user: str, temperature: float,
                            timeout_s: int) -> dict: ...
```
- `StubProvider`: trả fixture theo hash(input) — deterministic; extraction stub phủ đủ 15 tag; scripting stub trả hook hợp lệ VÀ 1 fixture cố ý vi phạm ("cam kết") để test validator.
- `LocalProvider` (extraction + geo normalize — L3), `ApiProvider` (scripting). Router theo `LLM_MODE`; extraction KHÔNG BAO GIỜ dùng ApiProvider kể cả khi LLM_MODE=api (ép trong code).

## 5 · TASK BREAKDOWN (code theo đúng thứ tự; acceptance = lệnh phải pass)

| # | Task | Files | Ghi chú then chốt | Acceptance |
|---|------|-------|-------------------|------------|
| T01 | Hạ tầng: compose + schema + config + db.py + tracing | docker-compose, core/* | Langfuse optional (thiếu key → no-op) | `docker compose up -d db && psql -f db/schema_v1_1.sql` sạch; `psql -f db/test_schema.sql` 7/7 PASS |
| T02 | Import guard + skeleton test | tests/test_import_guard.py | L1, L5 | `pytest tests/test_import_guard.py` |
| T03 | Seed generator + fixtures | seed/* | quy tắc §7 | `python -m src.seed.generator` → đếm: 1000 khách, ≥80 trong zone, txn ~90 ngày/khách |
| T04 | LLM provider + stubs | llm/* | L10 | `pytest tests/test_provider_stub.py` (deterministic: 2 lần gọi = 1 kết quả) |
| T05 | M1 ETL | etl/engine.py | E1–E10 theo PRD §1.1; NULL ≠ 0 | `pytest tests/test_etl.py` — fixture cố định → giá trị kỳ vọng cố định, chạy 2 lần bit-identical |
| T06 | AG1 Extraction (3 sub) | extraction/* | band tiền, person→cấm merchant tag, conf<0.7 loại | `pytest tests/test_extraction.py` (chạy StubProvider) |
| T07 | Promote tags | extraction/promote.py | ≥2/90d; PERIODIC_GAP; tag_life_conhoc hợp thành | `pytest tests/test_promote.py` |
| T08 | M2 Geo | geo/matcher.py | ward_match trước, LLM normalize sau (conf≥0.8); geo_x_kinhdoanh | `pytest tests/test_geo.py` — case Bát Tràng có/không hành vi KD |
| T09 | M3+M4 Merger & Scoring | profiling/, scoring/ | L8; impute median+cờ missing; vectorized | `pytest tests/test_scoring.py`; 1000×5 < 1s |
| T10 | M5 Ranker | ranker/* | R1..R12 mỗi rule 1 hàm thuần; thứ tự cố định; 0 gói → rec rỗng | `pytest tests/test_ranker.py` — 12 case, mỗi rule 1; + test L5 không mã geo |
| T11 | M6 + Tools + RAG | calllist/, scripting/tools.py, rag.py | calculator là code thuần có test số | `pytest tests/test_tools.py` |
| T12 | AG2..6 Scripting | scripting/* | 1 class + 5 config; Self-check; contract L3 | `pytest tests/test_contract_pii.py` (output không chứa full_name/content/số TK) + `tests/test_agents_stub.py` |
| T13 | M7 Validator | validator/* | V1→V2→V3; regen≤2; fallback template; ghi log | `pytest tests/test_validator.py` — fixture "cam kết" bị chặn; số ngoài slots bị chặn |
| T14 | M0+M8 Orchestrator & Sink | batch/* | L7 fail-fast; version+1; snapshot hash | `python -m src.batch.orchestrator --nightly` trên seed: batch_runs.status='done', ≥150 recommendations, Langfuse có trace (nếu bật) |
| T15 | API FastAPI | api/routes.py | §6 | `pytest tests/test_api.py` (httpx) |
| T16 | M11+M12+M13 vòng học | feedback/, training/ | label từ core mock; 4 cửa; flip production chỉ khi PASS+tốt hơn | `python -m src.training.train --product baohiem` → in bảng 4 cửa; FAIL → is_production không đổi |
| T17 | Nest.js (auth, staleness, feedback, admin, audit) | apps/api | staleness §M9; audit mọi view | e2e: login→GET calllist→GET customer→POST feedback→suppression xuất hiện |
| T18 | Next.js UI | apps/web | §8 | chạy demo path §9 bằng tay |
| T19 | Mini-pipeline + simulate | batch/orchestrator.run_mini | version mới cạnh cũ | POST /simulate/big-txn → GET customer thấy 2 version + cờ staleness |
| T20 | E2E demo script + video path | scripts/demo_check.sh | chạy đủ 9 mục nghiệm thu FULL_SPEC E4 | `bash scripts/demo_check.sh` exit 0 |

Đường cắt (nếu chậm — theo MASTER_PLAN E2): C1 bỏ T17 (web gọi thẳng FastAPI, thêm JWT tối giản vào FastAPI); C2 bỏ T19 + mini BI.

## 6 · API CONTRACTS (đúng AGENT_SPEC; response mẫu là chuẩn nghiệm thu)

**FastAPI (internal):**
- `POST /batch/nightly` → `{run_id, status, stats}`
- `POST /batch/mini/{customer_id}` → `{run_id, new_version}`
- `POST /admin/retrain?product=` → `{version, gates:{auc,lift,calibration,baseline}, promoted:bool}`
- `POST /simulate/big-txn {customer_id, amount}` → 202
- `GET /tags/review?tag=` → mẫu chấm

**Nest.js (public):**
- `POST /auth/login {username,password}` → `{token, role}`
- `GET /nba/calllist?date=` → `[{customer_ref, staleness_flag, top:[product...]}]`
- `GET /nba/customer/:id` → `{versions:[...], latest:{product_rank1, hook1, explain1, rank2..., rules_applied, created_at}, staleness:{flag, fields[]}}`
- `POST /feedback {rec_id, product, status, reject_reason?}` → 201 (trigger DB tự sinh suppression)
- `POST /admin/calllist {date, items:[{customer_id, sale_id}]}` · `PUT /admin/kpi {month, product, multiplier}`
- `GET /audit/recommendation/:id` → `{weights_versions, input_snapshot_hash, rules_applied, version, source}`

## 7 · SEED GENERATOR — QUY TẮC (T03)

1.000 khách: tuổi N(38,9) clip 22–60; 55% lương đều (chuỗi CK "LUONG Txx" chu kỳ 30±2 ngày); 30% có vay (một nửa mortgage); 35% có thẻ; income lognormal. **Persona cài chủ đích:** ~80 khách trong 12 zone (fixtures/zones.json: Bát Tràng-gốm, Đồng Kỵ-gỗ, Vạn Phúc-lụa, La Phù-dệt, 4 khu xưởng, 2 KCN, 2 chợ đầu mối — ward_code giả lập nhất quán), 60% trong đó có dòng tiền KD (inflow ≥15 lần/tháng, ≥8 đối tác, content "TT don hang #..."); ~120 khách có tag học phí (VINSCHOOL/NGUYEN SIEU + "HOC PHI Txx" 2+ kỳ); ~90 đóng phí BH (PRUDENTIAL/MANULIFE định kỳ); ~50 thu cho thuê; 25 khách demo "xung đột" (nợ thẻ quá hạn + CASA cao — để R2 có đất diễn); 1 khách demo chính ghim id=1 đúng kịch bản demo (học phí + phí BH + nợ thẻ). Call list 150 khách cho T+1 phủ đủ persona. Mọi random dùng `seed=42`.

## 8 · FRONTEND (T18) — trang & contract

- `/login` · `/calllist`: bảng khách của sale (từ GET /nba/calllist), badge staleness. 
- `/customer/[id]`: 2 card đề xuất (product, hook, explain, badge rule R*, giờ tính), nút Feedback (dropdown lý do khi Từ chối), timeline versions, link Langfuse trace.
- `/admin`: assign call list (chọn ngày, gán sale), KPI slider 0.8–1.5, bảng retrain (nút chạy + bảng 4 cửa ĐẠT/CHƯA ĐẠT), mini BI (cost/khách, % validator reject — đọc từ batch_runs.stats).
- `/tags`: bảng v_tag_precision + chấm mẫu (50 dòng).
Không đưa full_name khách lên UI ngoài trang chi tiết (dashboard dùng customer_ref + 3 số cuối CIF).

## 9 · DEFINITION OF DONE

`bash scripts/demo_check.sh` pass đủ: (1) schema 7/7; (2) nightly run done ≥150 rec; (3) khách nợ xấu không có rec vay/tiết kiệm; (4) POST feedback rejected → gói biến mất khỏi GET (suppression); (5) fixture "cam kết" nằm trong validator_log, không nằm trong recommendations; (6) retrain baohiem in đủ 4 cửa; (7) mini-run tạo version 2, version 1 còn nguyên; (8) GET /audit trả đủ weights_versions + hash; (9) test_contract_pii + test_import_guard xanh. Toàn bộ chạy được với `LLM_MODE=stub` không cần mạng.

## 10 · NỘI DUNG `CLAUDE.md` ĐẶT Ở ROOT REPO

```markdown
# CLAUDE.md — SHB NBA Engine
Đọc docs/BUILD_SPEC.md trước khi làm bất kỳ việc gì; nghiệp vụ tra docs/AGENT_SPEC.md.
LUẬT: (1) scoring/ & ranker/ cấm import llm/; (2) không update/delete recommendations, audit_log;
(3) chỉ extraction/ đọc transactions.content — contract sang scripting phải qua build_contract();
(4) số trong hook chỉ từ slots_used; (5) geo không vào ranker; (6) mọi ngưỡng từ core/config.py;
(7) không thêm bảng/cột — field mới vào profiles.features; (8) mỗi task pass acceptance mới sang task sau;
(9) mặc định LLM_MODE=stub — mọi test phải chạy offline; (10) không mở rộng scope ngoài MASTER_PLAN.
Lệnh: uv run pytest · uv run python -m src.batch.orchestrator --nightly · bash scripts/demo_check.sh
```

---
*Tài liệu này là tầng "mapping code" — thấp nhất trong chuỗi. Nghiệp vụ không bao giờ sửa ở đây; sửa ở tài liệu nguồn rồi cập nhật mapping.*
