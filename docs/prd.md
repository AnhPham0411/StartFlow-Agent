TÀI LIỆU TỔNG HỢP CHI TIẾT
SHB Next Best Action Engine — AI Sales Copilot
Phiên bản: 3.0 (bản chi tiết đầy đủ) · Ngày: 17/07/2026 Sự kiện: Vietnam AI Challenge 2026, đề #33 — track Ngân hàng & Tài chính Quan hệ tài liệu: đây là bản chi tiết triển khai của MASTER_PLAN v2.1. Scope, timeline, decision log lấy theo v2.1; tài liệu này bổ sung đặc tả kỹ thuật và nghiệp vụ đến mức code được.

MỤC LỤC
Phần A — Bối cảnh, mục tiêu, phạm vi
Phần B — Kiến trúc & đặc tả kỹ thuật chi tiết
Phần C — Đặc tả nghiệp vụ (taxonomy, rule, feature, agent)
Phần D — Dữ liệu, schema, API
Phần E — Kế hoạch 30 giờ, demo, nghiệm thu
Phần F — Tầm nhìn dài hạn & quản trị
Phần G — Decision log, rủi ro, câu hỏi mở

PHẦN A — BỐI CẢNH, MỤC TIÊU, PHẠM VI
A1. Vấn đề
Sale kênh quầy bán chéo theo cảm tính: tự đoán nhu cầu, chào theo KPI tháng. Hệ quả đo được: tỷ lệ chốt thấp; khách bị chào sản phẩm xung đột (vừa mời gửi tiết kiệm vừa nhắc nợ thẻ); khách bị chào lặp gói đã từ chối; kinh nghiệm người giỏi không tích lũy lại được.
Dữ liệu để trả lời "khách này cần gì lúc này" đã nằm sẵn trong hệ thống — đặc biệt là tên người nhận (merchant) + nội dung chuyển khoản, nguồn tín hiệu hành vi/life event giàu nhất nhưng chưa ai khai thác vì (1) cần LLM đọc hiểu tiếng Việt tự nhiên và (2) ràng buộc PII không cho gửi dữ liệu này ra ngoài.
A2. Giải pháp một câu
Chạy toàn bộ AI vào ban đêm, tính sẵn Top 2 sản phẩm + kịch bản chốt cho từng khách trong call list ngày mai; ban ngày sale chỉ đọc; kết quả thật từ core banking khép vòng học liên tục.
A3. Mục tiêu & thước đo
#
Mục tiêu
Thước đo
Ngưỡng
G1
Tăng tỷ lệ chốt/cuộc gọi
Win-rate uplift vs control (pilot thật)
≥ +30% tương đối
G2
Tập trung nguồn lực đúng khách
Lift@10% của propensity model
≥ 2.0x
G3
Không xung đột, không spam
Ca vi phạm lọt qua Ranker
= 0
G4
Giải trình được
Đề xuất truy vết đủ version + snapshot + rule
100%
G5
Chi phí tỷ lệ giá trị
% khách qua tầng LLM
≤ 15%

A4. Non-goals (cố ý ngoài phạm vi)
Không phê duyệt tín dụng bằng AI — chỉ gợi ý bán; phê duyệt là quy trình con người.
Không retrain/fine-tune LLM — vòng học = Dynamic RAG + retrain propensity model.
Không voice trong MVP (D13) — voice intelligence là Phase 3 của vision; schema đã chừa hook.
Không real-time recommendation — pre-computed có chủ đích; trigger đột biến là ngoại lệ có kiểm soát.
Không chatbot cho khách hàng cuối — người dùng là sale nội bộ (D9).
Không tích hợp core banking thật trong MVP — mock có chủ đích, interface chuẩn hóa để thay sau.
A5. Personas
Sale kênh quầy (chính): xem đề xuất, gọi khách, ghi feedback.
Quản lý chi nhánh: assign call list T+1, chỉnh hệ số KPI, xem trace.
Data team: retrain trọng số, duyệt qua 4 cửa tự động.
Compliance/Audit: truy vết đề xuất bất kỳ về version + snapshot + rule.

PHẦN B — KIẾN TRÚC & ĐẶC TẢ KỸ THUẬT
B1. Sơ đồ tổng
━━━ LUỒNG A · BATCH ĐÊM (cron 00:00 / nút "Run nightly" khi demo) ━━━
 A1 Master Profiling
    ├─ ETL deterministic  ──┐
    └─ LLM local extraction ┴─→ profile JSON (merge)
 A2 Propensity Scoring (weights_{sp}_v{n}.json — KHÔNG LLM)
 A3 Rule Ranker (12 rule + suppression + KPI) → Top 2/khách
 A4 Lọc call list T+1 (150/1000) — điểm cắt chi phí LLM
 A5 LLM Scripting (5 domain agents + slot filling + RAG 30 case)
 A6 Compliance Validator (pattern + template + fallback)
 A7 Sink: PostgreSQL append-only (+ version, weights_ver, snapshot hash)

━━━ LUỒNG B · BAN NGÀY (read-only) ━━━
 Next.js ─→ Nest.js (JWT · audit · staleness check) ─→ PostgreSQL
 Trigger đột biến → mini-pipeline → version mới (không ghi đè)

━━━ LUỒNG C · FEEDBACK & HỌC ━━━
 Outcome join core mock (N=30 ngày) → label retrain
 Checkbox sale → lý do từ chối + suppression 90 ngày
 Retrain → 4 cửa duyệt → weights v{n+1} (CHƯA ĐẠT không thay)
 (Voice: Phase 3 — bảng feedback có cột source, pgvector có schema case)

B2. Stack & phân vai service
Service
Công nghệ
Trách nhiệm
KHÔNG làm
apps/web
Next.js 14 App Router
Dashboard sale, màn quản lý, màn duyệt tag
Gọi thẳng DB, giữ business logic
apps/api
Nest.js + Prisma
JWT auth, phân quyền sale/manager, audit append-only, staleness check, proxy sang AI
Chạy ML, gọi LLM
apps/ai
FastAPI, Python 3.11, sklearn
Batch orchestrator, ETL, extraction, scoring, ranker, scripting, validator, retrain
Auth, session
DB
PostgreSQL 16 + pgvector
Source of truth + vector case
—
Observability
Langfuse self-host
Trace batch từng khách, cost
—

LLM: local model cho extraction (nội dung CK + merchant không rời hạ tầng — D4); API model cho scripting (input đã masking, chỉ chứa tag + số liệu catalog, không PII).
B3. Đặc tả từng bước batch
A1a — ETL (deterministic, tái lập tuyệt đối). Input: bảng transactions, accounts, loans, cif. Output các feature cứng (danh sách đầy đủ ở C3). Cấm mọi lời gọi LLM trong module này. Mọi phép tính có unit test với giá trị kỳ vọng cố định.
A1b — Extraction (LLM local). Input: giao dịch mới T-1 (không quét lại lịch sử — chi phí O(giao dịch mới)). Mỗi giao dịch → 0..n tag từ taxonomy đóng (C1). Output JSON strict:
{"txn_id": "T123", "tags": [{"tag": "tag_hocphi", "confidence": 0.93, "evidence": "VINSCHOOL HOC PHI T9"}]}

Ràng buộc: tag ngoài taxonomy → discard + log; confidence < 0.7 → discard; batch 20 giao dịch/lời gọi để tiết kiệm token. Tag mức khách hàng = tồn tại ≥ 2 giao dịch mang tag trong 90 ngày (chống nhiễu một lần).
A2 — Scoring. score(khách, sp) = sigmoid(intercept + Σ wᵢ·xᵢ_chuẩn_hóa) với w từ weights_{sp}_v{n}.json. Chạy toàn bộ 1.000 khách × 5 sản phẩm < 1 giây (vectorized numpy). Không lời gọi mạng.
A3 — Ranker. Áp 12 rule (C2) theo thứ tự: rule chặn (hard block) → rule hạ ưu tiên (multiplier) → hệ số KPI → sort → Top 2. Mỗi quyết định ghi lại danh sách rule đã kích hoạt (phục vụ audit + explainability).
A4 — Lọc call list. JOIN với bảng call_lists (ngày = T+1). Khách ngoài list: dừng ở A3, vẫn lưu điểm (phục vụ BI), không tốn token.
A5 — Scripting. Mỗi khách trong list → gọi đúng 2 domain agent tương ứng Top 2. Prompt nhận: tag khách (không PII), điểm + lý do rule, slot từ catalog, 1–2 case RAG gần nhất (cùng cụm tag, ưu tiên 1 chốt + 1 trượt). Output JSON: {hook, explain, slots_used[]}.
A6 — Validator. 3 lớp: (1) regex pattern cấm (C5); (2) đối chiếu slot: mọi con số trong hook phải khớp slots_used → khớp catalog; (3) riêng BH/đầu tư: fuzzy-match với template duyệt sẵn, độ lệch quá ngưỡng → reject. Reject → regenerate tối đa 2 lần → fallback template chuẩn (điền slot, không LLM). Mọi reject ghi validator_log.
A7 — Sink. Ghi recommendations append-only. Không UPDATE, không DELETE. Mini-pipeline ban ngày tạo bản ghi mới version+1.
B4. Staleness check (Nest.js)
Khi GET đề xuất: so 3 chỉ số neo trong snapshot với "core" mock hiện tại — casa_avg (lệch > 20% → cờ), total_debt (lệch > 15% → cờ), product_flags (khác → ẩn đề xuất liên quan). Trả về kèm staleness: {flag, fields[]}. SLA < 300ms (1 query so sánh).
B5. Trigger đột biến
Endpoint demo POST /simulate/big-txn bơm giao dịch > 500tr → event → FastAPI chạy mini-pipeline (A1→A7 cho riêng khách đó) → bản ghi version mới. UI hiển thị cả 2 version, đánh dấu bản mới nhất.
B6. Retrain & 4 cửa duyệt
POST /admin/retrain?product=baohiem → join recommendations × outcomes (label = mở SP trong 30 ngày) → train logistic → chạy eval → sinh weights_{sp}_v{n+1}.json + báo cáo 4 cửa:
Cửa
Ngưỡng
Trượt thì
AUC holdout
≥ 0.70
KHÔNG thay production, giữ v cũ
Lift@10%
≥ 2.0x
như trên
Calibration
lệch bin ≤ 5 điểm %
như trên
So baseline
> rule xếp theo CASA
như trên

File weights có metadata: {version, product, trained_on, n_samples, n_positive, auc, lift10, base_rate, feature_list, intercept, weights{}}. Số feature tối đa ≈ n_positive ÷ 15.

PHẦN C — ĐẶC TẢ NGHIỆP VỤ
C1. Taxonomy 15 tag (đóng — thêm tag phải qua duyệt precision)
Tag
Nguồn nhận diện
Ví dụ evidence
Dùng cho gói
tag_dining
Merchant nhà hàng/cafe
"NHA HANG SEN", "HIGHLANDS"
Thẻ
tag_kids
Merchant trẻ em/khu vui chơi
"TINIWORLD", "BIBO MART"
Bảo hiểm, Thẻ
tag_travel
Vé máy bay/khách sạn/OTA
"VIETNAM AIRLINES", "AGODA"
Thẻ
tag_petrol_auto
Xăng dầu, gara, đăng kiểm
"PETROLIMEX", "GARA THANH"
Thẻ
tag_sieuthi
Siêu thị/tạp hóa lớn
"WINMART", "COOPMART"
Thẻ
tag_thoitrang_dienmay
Thời trang, điện máy
"DIEN MAY XANH"
Thẻ
tag_thu_kinh_doanh
Nội dung CK vào: nhiều nguồn nhỏ "thanh toan don hang"
"TT don hang #4521"
Vay, Tài khoản
tag_thu_cho_thue
CK vào định kỳ "tien thue nha/phong"
"tien thue nha T9"
Đầu tư
tag_thu_luong_phu
CK vào định kỳ ngoài lương chính
"luong CTV thang 9"
Vay, Đầu tư
tag_life_muanha
"dat coc", "gop mua dat", CK sang CĐT
"dat coc can ho HH2"
Vay, Bảo hiểm
tag_life_conhoc
Suy ra từ hocphi + kids đồng thời
—
Bảo hiểm
tag_hocphi
Merchant trường + từ khóa học phí
"VINSCHOOL HOC PHI T9"
Bảo hiểm
tag_vienphi
Bệnh viện/phòng khám + "vien phi"
"BV VINMEC vien phi"
Bảo hiểm
tag_dong_phi_bh
CK định kỳ đến hãng BH
"PRUDENTIAL PHI BH"
Bảo hiểm (âm)
tag_ck_nguoithan_dinhky
CK ra cá nhân, định kỳ, nội dung gia đình
"gui me tien thang"
Bảo hiểm

Quy trình duyệt tag: mẫu 500 giao dịch/tag → LLM gán → nghiệp vụ chấm → precision ≥ 90% mới vào production; tag rớt → sửa prompt hoặc loại. Màn duyệt tag nằm trong scope MVP (chấm trên mẫu seed).
C2. 12 rule của Ranker
Hard block (chặn tuyệt đối):
#
Rule
Logic
R1
Nợ xấu nhóm 2+ → chặn Vay, Thẻ mới
cic_group >= 2
R2
Nợ thẻ quá hạn → chặn Tiết kiệm/Đầu tư
card_overdue = true (xung đột kinh điển)
R3
DTI > 60% → chặn Vay + Thẻ
dti > 0.6
R4
Đã có SP cùng hạng → chặn gói trùng
has_product(sp, tier)
R5
Từ chối gói < 90 ngày → ẩn gói
bảng suppressions
R6
Tiếp cận bất kỳ < 14 ngày → hoãn toàn bộ khách
contact policy tổng
R7
Đang được sale khác theo (lock 30 ngày) → khóa khách
bảng assignments
R8
Thiếu trường CIF bắt buộc của gói → chặn gói
vd bảo hiểm cần DOB
R9
Số dư < ngưỡng tối thiểu gói đầu tư → chặn Đầu tư
casa_avg < min_invest
R10
Tuổi ngoài dải điều kiện SP → chặn gói
từ catalog

Multiplier (hạ/nâng ưu tiên):
#
Rule
Logic
R11
tag_dong_phi_bh → điểm Bảo hiểm × 0.5
đã có BH nơi khác
R12
Hệ số KPI tháng theo SP (config từ màn quản lý, mặc định 1.0, dải 0.8–1.5)
chiến lược kinh doanh

Mọi rule kích hoạt được ghi vào recommendations.rules_applied[].
C3. Feature theo sản phẩm
Feature chung (ETL, mọi gói): age, dti, casa_avg(log), casa_trend_3m, salary_regular, has_loan, has_card, txn_per_month, days_since_big_txn, contact_count_90d.
Tag features: 15 tag ở C1 (binary mức khách hàng).
Feature riêng bảo hiểm (bộ vá v2 — đã kiểm chứng 0.59→0.78): cif_married, tag_hocphi, tag_vienphi, tag_dong_phi_bh, cif_nghe_ruiro, has_mortgage, age_trucot(30–47).
Tổng ~25 feature/gói (bảo hiểm ~30). Nguyên tắc sống của feature: vào khi tăng AUC holdout, ra khi trọng số ~0 hai kỳ liên tiếp.
C4. Đặc tả 7 agent
Agent
Model
Input
Output
Tools
Extraction
LLM local
batch 20 giao dịch (merchant + nội dung)
JSON tag + confidence + evidence
— (pure prompt, taxonomy đóng trong system prompt)
Thẻ
API
tag chi tiêu, điểm, rule log, slot thẻ, RAG case
hook + explain
catalog_lookup, fee_calculator
Vay
API
DTI, room, tag thu nhập/life event, slot vay
hook + explain
catalog_lookup, loan_calculator
Đầu tư
API
CASA, trend, tag thu cho thuê, slot TK/ĐT
hook + explain
catalog_lookup, interest_calculator
Bảo hiểm
API
tag gia đình, band tuổi, has_mortgage, template
hook + explain (bám template)
catalog_lookup
Tài khoản
API
CASA, txn freq, điều kiện hạng, slot combo
hook + explain
catalog_lookup, tier_checker
Voice Extraction
—
Phase 3 (vision)
—
—

Prompt skeleton chung cho 5 domain agent: vai trò → dữ kiện khách (tag + số đã tính, KHÔNG dữ liệu thô/PII) → gói được chọn + slot bắt buộc dùng → 1–2 case RAG → yêu cầu output JSON {hook ≤ 2 câu, explain ≤ 1 câu, slots_used[]} → điều cấm (không tự viết số, không hứa hẹn, không mô tả hành động chưa xảy ra).
C5. Validator — pattern cấm (bộ khởi điểm, mở rộng theo compliance)
Nhóm cam kết: cam kết, chắc chắn, đảm bảo (lãi|sinh lời|lợi nhuận), không rủi ro, an toàn tuyệt đối
Nhóm hành động chưa xảy ra: (em |anh )?(đã|vừa) (nâng|mở|tạo|làm lệnh|kích hoạt) khi không có transaction thật
Nhóm số liệu: mọi chuỗi số %|triệu|tr\b trong hook phải xuất hiện trong slots_used (đối chiếu máy, không regex đơn thuần)
Nhóm BH/đầu tư: similarity với template duyệt < ngưỡng → reject
Nhóm PII: tên riêng/số ID lọt vào hook → reject

PHẦN D — DỮ LIỆU, SCHEMA, API
D1. Bảng chính (PostgreSQL)
customers(id, age, cif_married, cif_nghe, created_at)
transactions(id, customer_id, ts, amount, direction, counterparty, content)
profiles(customer_id, as_of_date, features_json, version)          -- output A1
customer_tags(customer_id, tag, first_seen, txn_count, confidence)
scores(customer_id, product, score, weights_version, as_of_date)   -- output A2
call_lists(date, customer_id, assigned_sale_id)
recommendations(id, customer_id, version, created_at, product_rank1, product_rank2,
                hook1, hook2, explain1, explain2, rules_applied[], weights_versions{},
                input_snapshot_hash, source)                        -- append-only
feedback(id, rec_id, sale_id, status, reject_reason, note, source, created_at)
                                                                    -- source: 'checkbox' | 'voice'(P3)
suppressions(customer_id, product, until_date, reason)
outcomes(customer_id, product, contacted_at, opened_at, label)      -- join core mock
audit_log(id, actor, action, entity, payload_hash, created_at)      -- append-only
rag_cases(id, embedding vector, tags[], product, result, reason, script_text_masked)
product_catalog(product, package, rate, fee, limit_min, limit_max, age_min, age_max, tier)
kpi_weights(month, product, multiplier)

D2. Format weights
{
  "version": "weights_baohiem_v2",
  "product": "baohiem",
  "trained_on": "2026-07-17",
  "n_samples": 10000, "n_positive": 2690,
  "auc_holdout": 0.781, "lift_at_10": 2.5, "base_rate": 0.269,
  "gates": {"auc": "PASS", "lift": "PASS", "calibration": "PASS", "baseline": "PASS"},
  "intercept": -2.91,
  "weights": {"cif_married": 0.52, "age_trucot": 0.48, "tag_hocphi": 0.46,
              "tag_dong_phi_bh": -0.38, "has_mortgage": 0.29, "...": 0}
}

D3. API chính
Nest.js (public cho web):
POST /auth/login
GET  /nba/calllist?date=            → danh sách khách + trạng thái
GET  /nba/customer/:id              → đề xuất mới nhất + staleness + versions[]
POST /feedback                      → {rec_id, status, reject_reason?} (kích suppression)
POST /admin/calllist                → assign khách cho sale (manager)
PUT  /admin/kpi                     → {product, multiplier} (manager)
GET  /audit/recommendation/:id      → version + snapshot + rules

FastAPI (internal):
POST /batch/nightly                 → chạy A1→A7 (demo: nút bấm)
POST /batch/mini/:customer_id       → trigger đột biến
POST /admin/retrain?product=        → train + 4 cửa + weights mới
POST /simulate/big-txn              → bơm giao dịch demo
GET  /tags/review?tag=              → mẫu chấm precision


PHẦN E — KẾ HOẠCH 30 GIỜ, DEMO, NGHIỆM THU
E1. Timeline (6 người: ①② Data/Scoring · ③④ AI Pipeline · ⑤ FE · ⑥ Platform)
Giờ
Mốc
H0–H3
CẢ TEAM chốt contract (schema D1, API D3, format weights D2), đóng băng scope. Song song: ⑥ docker + Langfuse; ① seed 1.000 khách; ③ benchmark LLM local trên 50 giao dịch mẫu
H3–H12
Đường xuyên: ETL (①) · extraction 10 tag (③) · weights v1 (②) · ranker 6 rule lõi R1,R2,R3,R5,R9,R12 (②) · scripting 2 domain + validator regex (④) · dashboard khung (⑤) · Nest.js JWT + audit (⑥)
H12 — CHECKPOINT 1
1 khách trọn A1→A7 → dashboard, trace đủ Langfuse. Trượt → cắt C1
H12–H20
Đủ 15 tag + màn duyệt (③) · đủ 12 rule + KPI slider (②⑤) · đủ 5 domain + template + RAG seed 30 case (④) · staleness + cờ UI (⑥⑤) · màn assign call list (⑤)
H20 — CHECKPOINT 2
Batch #1 trọn 150 khách. Trượt → cắt C2
H20–H26
Feedback → suppression demo đổi ngày (②⑤) · outcome mock + retrain v2 + bảng 4 cửa (①②) · trigger đột biến (⑥) · batch #2 ra version mới (①) · mini BI (⑥)
H26–H28
ĐÓNG BĂNG. Chạy demo 3 lần; fix demo-path only; quay video dự phòng
H28–H30
Tổng duyệt pitch + Q&A drill

E2. Đường cắt định trước
Mã
Kích hoạt
Cắt (theo thứ tự)
C1
Trượt CP1
Bỏ Nest.js (FE gọi thẳng FastAPI, slide vẫn vẽ 3 tầng); 15 tag → 10; hoãn RAG
C2
Trượt CP2
Bỏ trigger đột biến; bỏ mini BI (mở Langfuse trực tiếp); 12 rule → 8; màn quản lý chỉ còn KPI slider
C3
H24 retrain chưa chạy
Retrain "đã chạy sẵn": commit weights v2 + bảng 4 cửa, demo diff v1/v2
Không bao giờ cắt
—
Extraction nội dung CK thật · 4 cửa duyệt · Ranker chặn xung đột · Langfuse trace · Explainability

E3. Kịch bản demo 7 phút
[1'] Vision 2 slide — platform 1 trục + quản trị; "demo module đầu tiên chạy thật".
[1'] Data thô — giao dịch một khách: "VINSCHOOL HOC PHI T9", "PRUDENTIAL PHI BH".
[2'] Langfuse — tag tag_hocphi/tag_dong_phi_bh sinh ra → điểm BH tăng nhưng bị ×0.5 (R11) → ranker chặn tiết kiệm vì nợ thẻ (R2) → kịch bản sinh, số lãi từ catalog, validator PASS.
[1'] Dashboard — Top 2 + hook + explain + timestamp; bấm "Từ chối – đã có BH nơi khác" → gói biến mất (R5); bơm giao dịch lớn → cờ staleness + version mới.
[1'] Vòng học — retrain: v2 + bảng 4 cửa; bảo hiểm 0.59→0.78 nhờ 7 feature nghiệp vụ.
[1'] Chốt — nguyên tắc ↔ màn hình; voice là Phase 3 trên cùng nền (chỉ cột source). "Không thay quyền quyết định của con người — thay phần tìm kiếm, tổng hợp và lặp lại."
E4. Nghiệm thu
[ ] Batch 1.000 khách (150 qua LLM) trọn vẹn; 2 đêm → 2 version; trace đủ từng khách.
[ ] Dashboard < 2.5s; đủ Top 2 + hook + explain + timestamp + cờ staleness.
[ ] Khách nợ xấu: không tồn tại đề xuất vay/tiết kiệm trong DB (R1/R2).
[ ] Từ chối → gói ẩn 90 ngày (demo đổi ngày hệ thống).
[ ] Hook chứa "cam kết lãi" hoặc số ngoài slots_used → validator chặn, có log.
[ ] Retrain ra v2; bất kỳ cửa nào FAIL → production giữ v1.
[ ] Trigger đột biến: 2 version song song, audit đủ.
[ ] Truy 1 đề xuất bất kỳ → weights version + snapshot hash + rules_applied.
[ ] Màn duyệt tag: chấm 50 mẫu, hiển thị precision từng tag.

PHẦN F — TẦM NHÌN DÀI HẠN & QUẢN TRỊ
F1. Trục platform (module sau tái dùng ~70% nền module trước)
Phase
Module
Tái dùng từ NBA
1 (MVP)
Next Best Action — bán chéo kênh quầy
—
2
Trợ lý RM: tóm tắt Customer 360 trước cuộc gặp
profile + tag + scripting
3
Voice Intelligence: outbound tổng đài → STT tiếng Việt → masking PII → tag cảm xúc/từ khóa chốt-trượt → pgvector làm giàu RAG; sau mở rộng quầy
schema feedback (source) + pgvector đã chừa sẵn
4
Lead scoring & campaign uplift (30/60/90 ngày, incremental)
propensity + outcome pipeline
5
Cảnh báo sớm khoản vay
ETL dòng tiền + trend
6
BI điều hành + hỏi đáp có citation
outcome + audit data

Vì sao voice ở Phase 3: STT tiếng Việt thực địa + masking PII tiếng Việt + consent là ba bài toán riêng; giá trị chỉ phát huy khi tích lũy đủ cuộc gọi; vòng học MVP đã khép bằng outcome core + checkbox.
F2. Build / Integrate / Phase-sau
Mục
Quyết định
Lý do
eKYC/liveness/deepfake
Integrate vendor
Cuộc đua chuyên biệt, ngân hàng đã có
Fraud real-time, AML
Integrate engine, AI thêm lớp giải thích/ưu tiên alert
Label + streaming ngoài tầm
Voice intelligence
Build — Phase 3
Móng đã có từ MVP
OCR
Build lát mỏng (sao kê cho profiling)
Đủ cho trục
Chatbot khách cuối
Phase sau
Ngoài trục giá trị
Credit scoring/thu hồi nợ
Phase sau
Data quản chế + model risk
GPU
Vài GPU pilot → cụm theo nhu cầu; core model chung + LoRA
Chi phí không tuyến tính theo agent

F3. Tầng quản trị (MVP chứng minh bản tối giản)
Policy mặc định từ chối · agent không tự tăng quyền/thêm tool · kill switch từng agent/model/workflow · reason code + evidence · model registry + champion-challenger + rollback · giám sát drift/calibration/cost · human-in-the-loop tác vụ rủi ro cao. Ánh xạ MVP: 4 cửa duyệt = champion-challenger tối giản; append-only + snapshot = evidence; validator = policy check; ranker rule = quyền cứng.

PHẦN G — DECISION LOG, RỦI RO, CÂU HỎI MỞ
G1. Decision log (bất biến — mở lại phải mang bằng chứng mới)
#
Quyết định
Lý do
D1
Pre-computed batch đêm
Độ trễ ~0, tách tải AI khỏi vận hành
D2
Propensity model chấm điểm, không LLM
Calibrated, so chéo được, audit được
D3
LLM chỉ chạy call list T+1
Cắt ~85–90% chi phí
D4
LLM local cho extraction
Nội dung CK + người nhận là PII
D5
Dynamic RAG thay retrain LLM
Chi phí, khả thi
D6
Ground truth từ core; checkbox chỉ thu lý do
Label khách quan
D7
Ranker là rule engine
Tuân thủ tuyệt đối, test được
D8
Weights version theo sản phẩm
Vá gói yếu không đụng gói khỏe
D9
Pivot chatbot → NBA nội bộ
Giá trị đo bằng win-rate
D10
Logistic production, GBM benchmark
Giải trình được
D11
Multi-agent chuyên biệt, điều phối tất định — không supervisor
Pipeline cố định; giá trị ở chuyên biệt, không ở tự chủ
D12
Vision 96-agent = pitch material
Scope theo tài liệu này
D13
Voice hoàn toàn thuộc vision Phase 3
30h không đủ; vòng học đã khép; schema chừa hook
D14
30h + 2 checkpoint + đường cắt C1–C3 định trước
Không tranh luận giữa trận; bảo vệ điểm khác biệt

G2. Rủi ro & đối sách
Rủi ro
Mức
Đối sách
Scope creep giữa 30h
Cao
D12/D13 + parking lot; thêm = bỏ
Tích hợp vỡ
Cao
CP1 H12 + C1; đóng băng H26
LLM local tag kém tiếng Việt
Trung
Benchmark H0–H3; cửa precision 90%; tag kém loại
Demo live lỗi
Trung
Seed cố định; video dự phòng H26
"Sao ít agent?"
—
7 agent + tools + executor; scoring/ranker cố ý không là agent (D2/D7/D11)
"Voice đâu?"
—
Phase 3 + chỉ cột source: nền chừa sẵn, bật khi có dữ liệu
Số liệu bị hiểu là số thật
Trung
Luôn nói: mô phỏng chứng minh phương pháp, không phải AUC data SHB
CIF thiếu (hôn nhân ~40% trống ở data thật)
Trung (pilot)
Tag hành vi làm proxy (CK học phí đều đáng tin hơn ô trống)

G3. Câu hỏi mở
[Business — blocking pilot] Quy trình assign call list T+1 có tồn tại ở chi nhánh chưa, hay sale tự chọn khách? Ảnh hưởng trực tiếp A4.
[Data] Outcome cross-sell lịch sử join được từ core không? Quyết định cold start bằng data hay rule.
[Compliance] Template kịch bản BH/đầu tư cấp nào duyệt; xin danh sách pattern cấm chính thức thay bản draft C5.
[Tech — trả lời trong H0–H3] LLM local nào đạt precision tag ≥ 90% tiếng Việt trên hạ tầng sẵn có.
[Legal — Phase 3] Consent ghi âm outbound hiện hành có cho phép dùng băng (đã masking) vào huấn luyện nội bộ không.
G4. Parking lot
Voice realtime tại quầy · uplift modeling thay propensity · agent trái phiếu · mobile app sale · A/B control group (bắt buộc khi pilot thật) · red teaming tự động · feature store chính thức.

Bản 3.0 là tài liệu chi tiết nhất của dự án. Thứ tự ưu tiên khi mâu thuẫn: MASTER_PLAN v2.1 (scope/timeline) → bản này (đặc tả) → PROJECT_INFO v1.1 (tham khảo lịch sử).

