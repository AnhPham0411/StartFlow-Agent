# AI Sales Copilot Authorization & Call Notes Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement a 3-level authorization structure (Admin HO, Branch Manager, Sale Staff) with branch-level scoping, and introduce a call notes logging history.

**Architecture:** Use roles and branch attributes decoded from Keycloak/Mock JWT. Filter query results in backend using the logged-in user context. Persist call notes in a new `call_notes` PostgreSQL table.

**Tech Stack:** NestJS, Next.js, Prisma, PostgreSQL.

---

### Task 1: Database Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260718_add_call_notes/migration.sql`

**Step 1: Write the failing test**
We will verify database connection and schema updates via typecheck.

**Step 2: Run test to verify it fails**
Check current Prisma Schema.

**Step 3: Write minimal implementation**
1. Add `CallNote` model to `schema.prisma`:
```prisma
model CallNote {
  id          BigInt   @id @default(autoincrement())
  customerId  BigInt   @map("customer_id")
  saleId      BigInt   @map("sale_id")
  noteText    String   @map("note_text") @db.Text
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("call_notes")
}
```
2. Create migration file and apply it:
```sql
CREATE TABLE call_notes (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id),
    sale_id         BIGINT NOT NULL REFERENCES users(id),
    note_text       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Step 4: Run test to verify it passes**
Run: `npx prisma db push` or `npx prisma generate` in `backend/` directory.

**Step 5: Commit**
```bash
git add backend/prisma/schema.prisma
git commit -m "db: add call_notes table"
```

---

### Task 2: Backend Mock Role switcher Support

**Files:**
- Modify: `backend/src/modules/auth/jwt-auth.guard.ts`

**Step 1: Write the failing test**
Mock auth currently hardcodes `admin` with no branch.

**Step 2: Run test to verify it fails**
Send requests to backend and observe hardcoded user payload.

**Step 3: Write minimal implementation**
Allow custom mock header configuration (e.g. `X-Mock-Role`, `X-Mock-Branch`, `X-Mock-Id`) to overwrite default mock profile in dev.
Update `jwt-auth.guard.ts` mock bypass section:
```typescript
if (process.env.AUTH_MODE === 'mock') {
  const mockRole = req.headers['x-mock-role'] || 'admin';
  const mockBranch = req.headers['x-mock-branch'] || 'HO';
  const mockUserId = req.headers['x-mock-user-id'] || '1';
  req.user = {
    id: mockUserId,
    username: 'demo_user',
    roles: [mockRole],
    branch: mockBranch,
  };
  return true;
}
```

**Step 4: Run test to verify it passes**
Verify Jest backend tests pass: `pnpm test` in backend.

**Step 5: Commit**
```bash
git add backend/src/modules/auth/jwt-auth.guard.ts
git commit -m "auth: support mock role parameters in headers"
```

---

### Task 3: Backend Notes Endpoint

**Files:**
- Create: `backend/src/modules/nba/notes.controller.ts`
- Modify: `backend/src/modules/nba/nba.service.ts`

**Step 1: Write the failing test**
Ensure saving a note fails if the customer doesn't exist.

**Step 2: Run test to verify it fails**
Create test case in `backend/src/modules/nba/nba.service.spec.ts`.

**Step 3: Write minimal implementation**
1. Add service method:
```typescript
async saveCallNote(customerId: number, saleId: number, noteText: string) {
  return this.prisma.callNote.create({
    data: {
      customerId,
      saleId,
      noteText,
    }
  });
}
async getCallNotes(customerId: number) {
  return this.prisma.callNote.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' }
  });
}
```
2. Register endpoints:
`POST /api/nba/notes` -> `{ customerId, noteText }`
`GET /api/nba/notes/:customerId` -> lists notes.

**Step 4: Run test to verify it passes**
Run: `pnpm test` in backend.

**Step 5: Commit**
```bash
git add backend/src/modules/nba/
git commit -m "feat: add backend call notes endpoints"
```

---

### Task 4: Backend Role-based Call List Filtering

**Files:**
- Modify: `backend/src/modules/nba/nba.service.ts`
- Modify: `backend/src/modules/nba/nba.controller.ts`

**Step 1: Write the failing test**
Create test verifying that a request from a `sale` user does not return other sales' call lists.

**Step 2: Run test to verify it fails**
Run NestJS unit tests.

**Step 3: Write minimal implementation**
Update `nba.service.ts` `getCallList` query logic to apply WHERE clauses:
* If role is `sale`: `AND cl.assigned_sale_id = user.id`
* If role is `manager`: `AND cl.assigned_sale_id IN (SELECT id FROM users WHERE branch = user.branch)`
* If role is `admin`: no branch/sale filters.

**Step 4: Run test to verify it passes**
Run: `pnpm test`

**Step 5: Commit**
```bash
git add backend/src/modules/nba/
git commit -m "feat: filter call list by role and branch context"
```

---

### Task 5: Frontend Developer Role Switcher

**Files:**
- Modify: `frontend/src/auth/auth-context.tsx`
- Modify: `frontend/src/components/layout/app-shell.tsx`

**Step 1: Write the failing test**
Compile check frontend.

**Step 2: Run test to verify it fails**
Observe missing role switcher component in sidebar.

**Step 3: Write minimal implementation**
1. Add dynamic switcher state inside `auth-context.tsx` when in `mock` mode. Allow changing roles on click.
2. In `app-shell.tsx`, render a selector dropdown at the bottom of the sidebar. When a user switches roles, update headers dynamically for API client fetches.

**Step 4: Run test to verify it passes**
Build frontend: `pnpm run build`

**Step 5: Commit**
```bash
git add frontend/src/
git commit -m "feat: add developer mock role switcher to sidebar"
```

---

### Task 6: Frontend Call Notes UI

**Files:**
- Modify: `frontend/app/nba/customers/[id]/page.tsx`
- Create: `frontend/src/components/nba/call-notes.tsx`

**Step 1: Write the failing test**
Verify component renders notes input text box.

**Step 2: Run test to verify it fails**
Check vitest on frontend.

**Step 3: Write minimal implementation**
1. On the customer detail page, add a "Nhật ký cuộc gọi" component.
2. Include text input field and a "Lưu ghi chú" button.
3. Show list of past notes with creator name, date, and text.
4. Convert match rate score from recommendations data to a percentage (multiply by 100).

**Step 4: Run test to verify it passes**
Run: `pnpm test` in frontend.

**Step 5: Commit**
```bash
git add frontend/
git commit -m "feat: implement frontend call notes and percentage match rate"
```
