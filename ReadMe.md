# SHB Digital Expert Agents

> Hệ thống **multi-agent tư vấn nghiệp vụ ngân hàng** cho SHB — Vietnam AI Challenge 2026, đề #33 (track Ngân hàng & Tài chính).

Người dùng đặt câu hỏi bằng ngôn ngữ tự nhiên → **Router Agent** phân loại nghiệp vụ → chuyển đến **Expert Agent** chuyên trách → agent tra cứu tài liệu SHB (RAG), gọi tool nghiệp vụ và trả lời **có trích dẫn nguồn**.

---

## 🧠 Các Expert Agents

| # | Agent | Phạm vi |
|---|-------|---------|
| 1 | 💳 Thẻ | Tư vấn thẻ tín dụng / ghi nợ, biểu phí, ưu đãi, điều kiện mở thẻ |
| 2 | 💰 Vay vốn ⭐ | Tư vấn khoản vay, điều kiện, lãi suất, ước tính khả năng vay *(agent trọng tâm cho demo)* |
| 3 | 📈 Tiết kiệm & Đầu tư | Sản phẩm tiết kiệm, lãi suất, kỳ hạn, sản phẩm đầu tư |
| 4 | 🛡️ Bảo hiểm | Sản phẩm bancassurance, quyền lợi, điều khoản |
| 5 | 🏦 Tài khoản & Dịch vụ | Tài khoản số đẹp, gói tài khoản, combo dịch vụ |
| 6 | 🤝 Hỗ trợ chung | Đặt lịch hẹn với chuyên viên, hướng dẫn thủ tục chung |
| 7 | 📮 Khiếu nại & Hỏi đáp | Tiếp nhận khiếu nại, tra cứu trạng thái, FAQ |
| 8 | 👋 Khách hàng mới | Onboarding, mở tài khoản lần đầu, KYC cơ bản |

---

## 🏗️ Kiến trúc

```
                        ┌──────────────────────────┐
                        │   apps/web  (Next.js)    │
                        │  Chat UI · Citation view │
                        │  Agent status · Booking  │
                        └────────────┬─────────────┘
                                     │ REST / SSE
                        ┌────────────▼─────────────┐
                        │   apps/api  (Nest.js)    │
                        │  Auth · Session · Rate   │
                        │  limit · Business logic  │
                        │  Booking · Audit log     │
                        └────────────┬─────────────┘
                                     │ HTTP (internal)
                        ┌────────────▼─────────────┐
                        │  apps/ai  (FastAPI)      │
                        │  Router Agent            │
                        │  ├─ 8 Expert Agents      │
                        │  ├─ RAG (tài liệu SHB)   │
                        │  ├─ Tools (tính lãi,     │
                        │  │   đặt lịch, tra cứu…) │
                        │  └─ AI Tracing (Langfuse)│
                        └────────────┬─────────────┘
                            ┌────────┴────────┐
                            │ PostgreSQL      │  users, sessions, bookings
                            │ Vector DB       │  embeddings tài liệu SHB
                            │ (pgvector)      │
                            └─────────────────┘
```

**Luồng chính:** câu hỏi → Nest.js (auth, session) → FastAPI Router Agent phân loại → Expert Agent tương ứng → retrieval từ knowledge base SHB → sinh câu trả lời kèm citation → stream về UI qua SSE.

**Vì sao tách Nest.js và FastAPI?**
- **Nest.js** giữ toàn bộ nghiệp vụ "ngân hàng truyền thống": auth, phân quyền, audit log, booking — nơi cần type-safety và cấu trúc chặt.
- **FastAPI** là AI service thuần: hệ sinh thái Python (LangChain/LangGraph, embeddings) mạnh hơn hẳn cho agentic workflow, và có thể scale độc lập khi tải AI tăng.

---

## 📁 Cấu trúc thư mục

```
shb-expert-agents/
├── apps/
│   ├── web/                  # Next.js 14+ (App Router)
│   │   ├── app/              # routes: /chat, /booking, /admin
│   │   ├── components/       # ChatWindow, CitationCard, AgentBadge…
│   │   └── lib/              # api client, SSE hook
│   ├── api/                  # Nest.js
│   │   └── src/
│   │       ├── auth/         # JWT auth, guards
│   │       ├── chat/         # session, message history
│   │       ├── booking/      # đặt lịch chuyên viên
│   │       └── ai-proxy/     # gọi sang FastAPI, stream passthrough
│   └── ai/                   # FastAPI (Python 3.11+)
│       └── src/
│           ├── router/       # Router Agent — phân loại intent
│           ├── agents/       # 8 expert agents (card, loan, savings…)
│           ├── rag/          # ingest, chunking, retrieval, citation
│           ├── tools/        # loan_calculator, booking_tool, product_lookup
│           ├── safety/       # grounding check, fallback, disclaimer
│           └── observability/ # AI tracing, log middleware, cost tracking
├── docs/
│   ├── architecture.md       # quyết định thiết kế (cho giám khảo)
│   └── data-sources.md       # nguồn tài liệu SHB đã ingest
├── docker-compose.yml        # postgres + pgvector + 3 services
├── .env.example
└── README.md
```

---

## 🚀 Chạy local

### Yêu cầu
- Node.js ≥ 20, pnpm ≥ 9
- Python ≥ 3.11, [uv](https://docs.astral.sh/uv/)
- Docker + Docker Compose

### Các bước

```bash
# 1. Clone
git clone https://github.com/<org>/shb-expert-agents.git
cd shb-expert-agents

# 2. Cấu hình môi trường
cp .env.example .env
# → điền ANTHROPIC_API_KEY / OPENAI_API_KEY, DATABASE_URL

# 3. Database
docker compose up -d postgres

# 4. AI service (FastAPI) — port 8000
cd apps/ai
uv sync
uv run python -m src.rag.ingest      # nạp tài liệu SHB vào vector DB (lần đầu)
uv run uvicorn src.main:app --reload --port 8000

# 5. Backend (Nest.js) — port 3001
cd apps/api
pnpm install
pnpm prisma migrate dev
pnpm start:dev

# 6. Frontend (Next.js) — port 3000
cd apps/web
pnpm install
pnpm dev
```

Mở **http://localhost:3000** → đăng nhập demo → chat với agent.

---

## 🔐 Biến môi trường chính

| Biến | Mô tả |
|------|-------|
| `ANTHROPIC_API_KEY` | Key gọi LLM cho agents |
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_SERVICE_URL` | URL FastAPI (mặc định `http://localhost:8000`) |
| `JWT_SECRET` | Secret ký token phía Nest.js |
| `EMBEDDING_MODEL` | Model embedding cho RAG |
| `LANGFUSE_HOST` | URL Langfuse self-host (mặc định `http://localhost:3002`) |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Key kết nối Langfuse |

---

## 🛡️ An toàn AI & Grounding

- **Citation bắt buộc:** mọi câu trả lời nghiệp vụ đều kèm trích dẫn từ tài liệu SHB đã ingest; UI hiển thị nguồn.
- **Fallback khi thiếu căn cứ:** nếu retrieval không đủ độ tin cậy, agent trả lời "chưa tìm thấy căn cứ" + gợi ý đặt lịch với chuyên viên thay vì bịa.
- **Disclaimer:** thông tin lãi suất/phí mang tính tham khảo, quyết định cuối cùng theo hợp đồng SHB.
- **Không lưu dữ liệu nhạy cảm:** demo không thu thập CMND/CCCD thật; dữ liệu KYC là mock.

---

## 📊 AI Logging & Observability

Mọi lượt tương tác với AI đều được ghi lại đầy đủ để **debug, đánh giá chất lượng và audit** — yêu cầu quan trọng với sản phẩm ngân hàng.

### Ghi những gì?

| Log | Nội dung | Lưu ở đâu |
|-----|----------|-----------|
| **Trace agent** | Toàn bộ chuỗi: câu hỏi → router quyết định → agent nào xử lý → tool nào được gọi → prompt/response từng bước → latency, token, cost | Langfuse (self-host qua Docker) |
| **Retrieval log** | Query embedding, top-k chunks lấy về, điểm similarity, chunk nào được dùng làm citation | Langfuse (span riêng) |
| **Conversation log** | Lịch sử hội thoại, session, feedback 👍/👎 của user | PostgreSQL (Nest.js) |
| **Audit log** | Ai hỏi gì lúc nào, agent trả lời gì, phiên bản prompt nào — phục vụ compliance | PostgreSQL, append-only |
| **App log** | Log hệ thống Nest.js (pino) và FastAPI (loguru), request id xuyên suốt 3 service | stdout / file rotation |

### Cách hoạt động

```
User hỏi ──▶ Nest.js gắn request_id ──▶ FastAPI
                                          │
                              Langfuse trace (tự động qua callback)
                              ├── span: router → chọn "loan_agent"
                              ├── span: retrieval → 5 chunks, score…
                              ├── span: tool call → loan_calculator(…)
                              └── span: generation → tokens, cost, latency
```

- FastAPI tích hợp **Langfuse callback** vào agent framework → mỗi bước agent tự sinh span, không phải log tay.
- `request_id` truyền qua header giữa 3 service → tra 1 request xuyên suốt từ UI đến LLM.
- Feedback 👍/👎 từ UI được gắn vào đúng trace → dùng để đánh giá và cải thiện prompt.

### Xem log

```bash
# Langfuse dashboard (self-host)
docker compose up -d langfuse
# → http://localhost:3002 — xem trace, cost, latency từng câu hỏi
```

> 💡 **Điểm demo cho giám khảo:** mở Langfuse cạnh demo chính → cho thấy agent "suy nghĩ" từng bước thật, không phải chatbot hộp đen. Ăn điểm cả mục *Kỹ thuật* lẫn *An toàn & Độ tin cậy*.

---

## 👥 Team & Quy trình

- Branch `main` protected — mọi thay đổi qua PR + 1 review
- Commit theo [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`…)
- CI: lint + build trên mỗi PR (GitHub Actions)
- Task board: GitHub Projects

## 📄 License

Nội bộ team — phục vụ Vietnam AI Challenge 2026.