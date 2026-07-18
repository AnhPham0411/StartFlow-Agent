-- 002_call_notes.sql — bảng ghi chú cuộc gọi của sale (ngoài schema_v1_1).
-- Áp dụng trực tiếp lên Postgres NBA (không do Prisma quản lý).

CREATE TABLE IF NOT EXISTS call_notes (
  id          BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  sale_id     BIGINT NOT NULL REFERENCES users(id),
  note_text   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_notes_customer
  ON call_notes(customer_id, created_at DESC);
