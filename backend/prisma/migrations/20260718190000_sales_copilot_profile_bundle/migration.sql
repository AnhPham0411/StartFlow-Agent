-- StartFlow Sales Copilot profile bundle.
-- Sanitized from the legacy demo schema: no external auth data or external extensions.
-- Keycloak remains the only authentication and authorization source.

-- ============================================================================
-- SHB NBA ENGINE — CANONICAL SCHEMA v1.1 (schema goc + geo delta, da test)
-- ============================================================================

-- ============================== ENUM ==========================================
CREATE TYPE product_enum      AS ENUM ('the','vay','dautu','baohiem','taikhoan');
CREATE TYPE txn_direction     AS ENUM ('in','out');
CREATE TYPE user_role         AS ENUM ('sale','manager','admin');
CREATE TYPE feedback_status   AS ENUM ('success','rejected','no_contact','callback');
CREATE TYPE feedback_source   AS ENUM ('checkbox','voice');          -- voice: Phase 3, chừa sẵn (D13)
CREATE TYPE rec_source        AS ENUM ('nightly','mini');            -- batch đêm | trigger đột biến
CREATE TYPE run_type          AS ENUM ('nightly','mini');
CREATE TYPE run_status        AS ENUM ('running','done','failed');
CREATE TYPE tag_status        AS ENUM ('draft','approved','retired'); -- cửa precision >= 90%
CREATE TYPE account_type      AS ENUM ('casa','saving');
CREATE TYPE product_status    AS ENUM ('active','closed');

-- ============================================================================
-- NHÓM 1 · NGƯỜI DÙNG NỘI BỘ
-- ============================================================================
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    username        TEXT NOT NULL UNIQUE,
    full_name       TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'sale',
    branch          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- NHÓM 2 · DỮ LIỆU NGUỒN (mock core banking — interface chuẩn hóa để thay thật)
-- ============================================================================
CREATE TABLE customers (
    id                  BIGSERIAL PRIMARY KEY,
    cif_code            TEXT NOT NULL UNIQUE,
    full_name           TEXT NOT NULL,               -- PII: không bao giờ đưa vào prompt scripting
    dob                 DATE NOT NULL,               -- ETL tự tính age; không lưu age tĩnh
    cif_married         BOOLEAN,                     -- nullable: CIF thật trống ~40% (G2 rủi ro)
    cif_occupation      TEXT,
    cif_occupation_risk BOOLEAN,                     -- map từ mã nghề → nhóm rủi ro (feature BH)
    monthly_income      NUMERIC(18,2) CHECK (monthly_income IS NULL OR monthly_income >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    acct_type       account_type NOT NULL,
    balance         NUMERIC(18,2) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_customer ON accounts(customer_id);

CREATE TABLE loans (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    loan_type       TEXT NOT NULL,                   -- 'oto','the_chap_nha','tieu_dung'...
    principal       NUMERIC(18,2) NOT NULL CHECK (principal > 0),
    outstanding     NUMERIC(18,2) NOT NULL CHECK (outstanding >= 0),
    monthly_payment NUMERIC(18,2) NOT NULL DEFAULT 0,-- ETL tính DTI
    is_overdue      BOOLEAN NOT NULL DEFAULT false,  -- R2
    is_mortgage     BOOLEAN NOT NULL DEFAULT false,  -- feature has_mortgage (BH v2)
    opened_at       DATE NOT NULL
);
CREATE INDEX idx_loans_customer ON loans(customer_id);

CREATE TABLE credit_bureau (                          -- CIC mock
    customer_id     BIGINT PRIMARY KEY REFERENCES customers(id),
    cic_group       SMALLINT NOT NULL CHECK (cic_group BETWEEN 1 AND 5),  -- R1: >=2 chặn vay/thẻ
    as_of           DATE NOT NULL
);

CREATE TABLE customer_products (                      -- SP đang nắm giữ: R4, has_card/has_loan, outcome join
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    product         product_enum NOT NULL,
    package         TEXT,
    tier            TEXT,
    status          product_status NOT NULL DEFAULT 'active',
    opened_at       DATE NOT NULL,
    closed_at       DATE,
    CHECK (closed_at IS NULL OR closed_at >= opened_at)
);
CREATE INDEX idx_custprod_customer ON customer_products(customer_id, product, status);

CREATE TABLE transactions (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    ts              TIMESTAMPTZ NOT NULL,
    amount          NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    direction       txn_direction NOT NULL,
    counterparty    TEXT,                             -- tên người nhận/merchant — input Extraction
    content         TEXT,                             -- nội dung CK — input Extraction (PII, chỉ LLM local đọc)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_customer_ts ON transactions(customer_id, ts DESC);
CREATE INDEX idx_txn_ts ON transactions(ts);          -- batch quét "giao dịch mới T-1"

-- ============================================================================
-- NHÓM 3 · TAXONOMY & TAG (đầu ra Extraction — B3.A1b, C1)
-- ============================================================================
CREATE TABLE tag_taxonomy (
    tag             TEXT PRIMARY KEY,                 -- 'tag_hocphi', 'tag_dong_phi_bh'...
    description     TEXT NOT NULL,
    detect_hint     TEXT,                             -- gợi ý nhận diện đưa vào prompt
    target_products product_enum[] NOT NULL DEFAULT '{}',
    is_negative     BOOLEAN NOT NULL DEFAULT false,   -- vd tag_dong_phi_bh (R11)
    status          tag_status NOT NULL DEFAULT 'draft',
    precision_score NUMERIC(4,3) CHECK (precision_score IS NULL OR precision_score BETWEEN 0 AND 1),
    CHECK (status <> 'approved' OR precision_score >= 0.90)   -- cửa duyệt tag cứng trong DB
);

CREATE TABLE txn_tags (                               -- tag mức GIAO DỊCH (raw từ LLM)
    id              BIGSERIAL PRIMARY KEY,
    txn_id          BIGINT NOT NULL REFERENCES transactions(id),
    tag             TEXT NOT NULL REFERENCES tag_taxonomy(tag),
    confidence      NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    evidence        TEXT,                             -- "VINSCHOOL HOC PHI T9"
    batch_run_id    BIGINT,                           -- FK thêm sau khi có batch_runs
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (txn_id, tag)
);
-- confidence < 0.7 bị discard ở tầng ứng dụng trước khi insert (B3.A1b)

CREATE TABLE customer_tags (                          -- tag mức KHÁCH (>=2 giao dịch/90 ngày)
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    tag             TEXT NOT NULL REFERENCES tag_taxonomy(tag),
    first_seen      DATE NOT NULL,
    last_seen       DATE NOT NULL,
    txn_count       INT NOT NULL CHECK (txn_count >= 1),
    avg_confidence  NUMERIC(4,3) NOT NULL CHECK (avg_confidence BETWEEN 0 AND 1),
    UNIQUE (customer_id, tag),
    CHECK (last_seen >= first_seen)
);
CREATE INDEX idx_ctags_customer ON customer_tags(customer_id);

CREATE TABLE tag_reviews (                            -- màn duyệt precision (E4)
    id              BIGSERIAL PRIMARY KEY,
    tag             TEXT NOT NULL REFERENCES tag_taxonomy(tag),
    txn_id          BIGINT NOT NULL REFERENCES transactions(id),
    llm_tagged      BOOLEAN NOT NULL,
    human_verdict   BOOLEAN,                          -- null = chưa chấm
    reviewer_id     BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- NHÓM 4 · PIPELINE BATCH (profiles → scores → recommendations)
-- ============================================================================
CREATE TABLE batch_runs (
    id              BIGSERIAL PRIMARY KEY,
    run_type        run_type NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    status          run_status NOT NULL DEFAULT 'running',
    stats           JSONB NOT NULL DEFAULT '{}'::jsonb  -- {n_customers, n_llm_calls, cost_usd,...}
);
ALTER TABLE txn_tags ADD CONSTRAINT fk_txntags_run
    FOREIGN KEY (batch_run_id) REFERENCES batch_runs(id);

CREATE TABLE profiles (                               -- output A1 (ETL + tag merge)
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    batch_run_id    BIGINT NOT NULL REFERENCES batch_runs(id),
    as_of_date      DATE NOT NULL,
    features        JSONB NOT NULL,                   -- feature cứng đã tính (C3)
    version         INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_id, as_of_date, version)
);

CREATE TABLE model_weights (                          -- registry trọng số (D2, B6)
    id              BIGSERIAL PRIMARY KEY,
    product         product_enum NOT NULL,
    version         INT NOT NULL,
    filename        TEXT NOT NULL,                    -- weights_baohiem_v2.json
    n_samples       INT NOT NULL,
    n_positive      INT NOT NULL,
    auc_holdout     NUMERIC(4,3) NOT NULL,
    lift_at_10      NUMERIC(4,2) NOT NULL,
    gates           JSONB NOT NULL,                   -- {auc:PASS, lift:PASS, calibration:PASS, baseline:PASS}
    is_production   BOOLEAN NOT NULL DEFAULT false,
    trained_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product, version)
);
-- Mỗi sản phẩm chỉ 1 bản production (D8: version độc lập từng gói)
CREATE UNIQUE INDEX uq_weights_production ON model_weights(product) WHERE is_production;

CREATE TABLE scores (                                 -- output A2 (toàn bộ khách, kể cả ngoài call list)
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    batch_run_id    BIGINT NOT NULL REFERENCES batch_runs(id),
    product         product_enum NOT NULL,
    score           NUMERIC(6,5) NOT NULL CHECK (score BETWEEN 0 AND 1),
    weights_version TEXT NOT NULL,
    as_of_date      DATE NOT NULL,
    UNIQUE (customer_id, product, batch_run_id)
);
CREATE INDEX idx_scores_run ON scores(batch_run_id, product, score DESC);  -- BI + chọn call list

CREATE TABLE call_lists (                             -- A4: manager assign T+1
    id                  BIGSERIAL PRIMARY KEY,
    list_date           DATE NOT NULL,
    customer_id         BIGINT NOT NULL REFERENCES customers(id),
    assigned_sale_id    BIGINT NOT NULL REFERENCES users(id),
    created_by          BIGINT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (list_date, customer_id)                   -- R7: 1 khách 1 sale/ngày
);
CREATE INDEX idx_calllist_date_sale ON call_lists(list_date, assigned_sale_id);

CREATE TABLE recommendations (                        -- output A7 · APPEND-ONLY
    id                  BIGSERIAL PRIMARY KEY,
    customer_id         BIGINT NOT NULL REFERENCES customers(id),
    batch_run_id        BIGINT NOT NULL REFERENCES batch_runs(id),
    version             INT NOT NULL,                 -- tăng dần theo khách; mini-run không ghi đè (B5)
    source              rec_source NOT NULL DEFAULT 'nightly',
    product_rank1       product_enum NOT NULL,
    score_rank1         NUMERIC(6,5) NOT NULL,
    hook1               TEXT NOT NULL,
    explain1            TEXT NOT NULL,
    slots_used1         JSONB NOT NULL DEFAULT '[]'::jsonb,
    product_rank2       product_enum,                 -- có thể null nếu chỉ còn 1 gói qua ranker
    score_rank2         NUMERIC(6,5),
    hook2               TEXT,
    explain2            TEXT,
    slots_used2         JSONB NOT NULL DEFAULT '[]'::jsonb,
    rules_applied       TEXT[] NOT NULL DEFAULT '{}', -- ['R2','R11','R12'] — audit + explainability
    weights_versions    JSONB NOT NULL,               -- {"the":"v1","baohiem":"v2",...}
    input_snapshot      JSONB NOT NULL,               -- feature + tag tại thời điểm quyết định
    input_snapshot_hash CHAR(64) NOT NULL,            -- sha256 — truy vết G4
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_id, version),
    CHECK (product_rank2 IS NULL OR product_rank2 <> product_rank1)
);
CREATE INDEX idx_rec_customer_ver ON recommendations(customer_id, version DESC);

CREATE TABLE validator_log (                          -- A6: mọi reject phải có vết
    id              BIGSERIAL PRIMARY KEY,
    batch_run_id    BIGINT NOT NULL REFERENCES batch_runs(id),
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    product         product_enum NOT NULL,
    attempt         SMALLINT NOT NULL CHECK (attempt BETWEEN 1 AND 3),  -- 2 regenerate + 1 fallback
    pattern_group   TEXT NOT NULL,                    -- 'cam_ket','hanh_dong_chua_xay_ra','so_lieu','template','pii'
    reason          TEXT NOT NULL,
    draft_hook      TEXT NOT NULL,                    -- bản bị chặn (phục vụ tinh chỉnh prompt)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- NHÓM 5 · VẬN HÀNH BAN NGÀY & VÒNG HỌC (Luồng B, C)
-- ============================================================================
CREATE TABLE feedback (
    id              BIGSERIAL PRIMARY KEY,
    rec_id          BIGINT NOT NULL REFERENCES recommendations(id),
    sale_id         BIGINT NOT NULL REFERENCES users(id),
    product         product_enum NOT NULL,            -- gói nào trong Top 2 được phản hồi
    status          feedback_status NOT NULL,
    reject_reason   TEXT,                             -- dropdown; bắt buộc khi rejected (trigger dưới)
    note            TEXT,
    source          feedback_source NOT NULL DEFAULT 'checkbox',  -- 'voice' = Phase 3
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status <> 'rejected' OR reject_reason IS NOT NULL)
);
CREATE INDEX idx_feedback_rec ON feedback(rec_id);

CREATE TABLE suppressions (                           -- R5 (90 ngày) + R6/R7 dùng chung
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    product         product_enum,                     -- NULL = hoãn toàn bộ khách (R6)
    until_date      DATE NOT NULL,
    reason          TEXT NOT NULL,
    from_feedback_id BIGINT REFERENCES feedback(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppr_customer ON suppressions(customer_id, product, until_date);

CREATE TABLE outcomes (                               -- ground truth từ core (D6) — label retrain
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    product         product_enum NOT NULL,
    contacted_at    DATE NOT NULL,
    opened_at       DATE,                             -- ngày mở SP thật trong core; NULL = chưa mở
    window_days     INT NOT NULL DEFAULT 30,
    label           SMALLINT NOT NULL CHECK (label IN (0,1)),
    CHECK (label = 0 OR opened_at IS NOT NULL),
    CHECK (opened_at IS NULL OR opened_at >= contacted_at)
);
CREATE INDEX idx_outcomes_product ON outcomes(product, contacted_at);

CREATE TABLE audit_log (                              -- APPEND-ONLY
    id              BIGSERIAL PRIMARY KEY,
    actor           TEXT NOT NULL,                    -- 'sale:12' | 'system:batch' | 'manager:3'
    action          TEXT NOT NULL,                    -- 'view_rec','feedback','retrain','kpi_update'...
    entity          TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    payload_hash    CHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);

-- ============================================================================
-- NHÓM 6 · CẤU HÌNH NGHIỆP VỤ
-- ============================================================================
CREATE TABLE product_catalog (                        -- nguồn slot filling DUY NHẤT (D. validator lớp 2)
    id              BIGSERIAL PRIMARY KEY,
    product         product_enum NOT NULL,
    package         TEXT NOT NULL,                    -- 'Cashback Platinum','TK Online 6T'...
    tier            TEXT,
    rate            NUMERIC(6,3),                     -- %/năm (lãi suất hoặc cashback)
    fee             NUMERIC(18,2),
    limit_min       NUMERIC(18,2),
    limit_max       NUMERIC(18,2),
    min_balance     NUMERIC(18,2),                    -- R9
    age_min         SMALLINT,
    age_max         SMALLINT,                         -- R10
    active          BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (product, package)
);

CREATE TABLE kpi_weights (                            -- R12: config từ màn quản lý
    id              BIGSERIAL PRIMARY KEY,
    month           CHAR(7) NOT NULL,                 -- '2026-07'
    product         product_enum NOT NULL,
    multiplier      NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (multiplier BETWEEN 0.80 AND 1.50),
    updated_by      BIGINT REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (month, product)
);

-- ============================================================================
-- TRIGGER
-- ============================================================================
-- T1. Append-only: cấm UPDATE/DELETE trên recommendations và audit_log (B3.A7, D1)
CREATE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % not allowed', TG_TABLE_NAME, TG_OP;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rec_append_only  BEFORE UPDATE OR DELETE ON recommendations
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER trg_audit_append_only BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- T2. Feedback 'rejected' → tự sinh suppression 90 ngày (R5, Luồng C)
CREATE FUNCTION auto_suppression() RETURNS trigger AS $$
BEGIN
    IF current_setting('startflow.profile_seed_mode', true) = 'on' THEN
        RETURN NEW;
    END IF;
    IF NEW.status = 'rejected' THEN
        INSERT INTO suppressions(customer_id, product, until_date, reason, from_feedback_id)
        SELECT r.customer_id, NEW.product, (NEW.created_at::date + 90), NEW.reject_reason, NEW.id
        FROM recommendations r WHERE r.id = NEW.rec_id;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feedback_suppression AFTER INSERT ON feedback
    FOR EACH ROW EXECUTE FUNCTION auto_suppression();

-- ============================================================================
-- VIEW
-- ============================================================================
-- Đề xuất mới nhất mỗi khách (dashboard đọc view này)
CREATE VIEW v_latest_recommendation AS
SELECT DISTINCT ON (customer_id) *
FROM recommendations
ORDER BY customer_id, version DESC;

-- Suppression đang hiệu lực (Ranker JOIN view này)
CREATE VIEW v_active_suppressions AS
SELECT customer_id, product, until_date, reason
FROM suppressions
WHERE until_date >= CURRENT_DATE;

-- Precision từng tag từ màn duyệt (E4)
CREATE VIEW v_tag_precision AS
SELECT tag,
       count(*) FILTER (WHERE human_verdict IS NOT NULL)            AS n_reviewed,
       round(avg((llm_tagged = human_verdict)::int) FILTER (WHERE human_verdict IS NOT NULL), 3)
                                                                    AS precision_observed
FROM tag_reviews
GROUP BY tag;

-- ========================== GEO EXTENSION (v1.1) ==========================
\set ON_ERROR_STOP on
CREATE TYPE zone_type AS ENUM ('lang_nghe','khu_xuong','kcn','cho_dau_moi');
CREATE TYPE geo_match_method AS ENUM ('ward_match','llm_normalized','manual');

ALTER TABLE customers
  ADD COLUMN address_raw   TEXT,
  ADD COLUMN ward_code     TEXT,
  ADD COLUMN district_code TEXT;

CREATE TABLE zone_registry (
  id            BIGSERIAL PRIMARY KEY,
  zone_code     TEXT NOT NULL UNIQUE,
  zone_type     zone_type NOT NULL,
  name          TEXT NOT NULL,
  trade         TEXT,
  ward_code     TEXT NOT NULL,
  district_code TEXT NOT NULL,
  province_code TEXT NOT NULL,
  source        TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_zone_ward ON zone_registry(ward_code) WHERE active;

CREATE TABLE customer_geo (
  customer_id  BIGINT PRIMARY KEY REFERENCES customers(id),
  zone_id      BIGINT REFERENCES zone_registry(id),
  zone_type    zone_type,
  match_method geo_match_method NOT NULL,
  confidence   NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  matched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (zone_id IS NULL OR zone_type IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS call_notes (
  id          BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  sale_id     BIGINT NOT NULL REFERENCES users(id),
  note_text   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_notes_customer
  ON call_notes(customer_id, created_at DESC);


CREATE TABLE profile_seed_manifest (
    version         TEXT PRIMARY KEY,
    checksum_sha256 CHAR(64) NOT NULL,
    table_counts    JSONB NOT NULL,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
