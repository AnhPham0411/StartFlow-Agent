# Design Spec - StartFlow Credit Assessment

## Source

- PRD: `product/prds/startflow-credit-assessment.md`
- User stories: `product/user-stories/startflow-credit-assessment.md`
- Acceptance criteria: `product/acceptance-criteria/startflow-credit-assessment.md`

## Screens

| Screen      | Route             | Purpose                       | User Stories | Acceptance Criteria |
| ----------- | ----------------- | ----------------------------- | ------------ | ------------------- |
| Dashboard   | `/dashboard`      | Queue/metrics/next action     | US-01, US-08 | AC-002, AC-024      |
| Cases       | `/cases`          | Find/open cases               | US-01        | AC-004              |
| New case    | `/cases/new`      | Safe demo intake              | US-01        | AC-004              |
| Case detail | `/cases/[caseId]` | Snapshot and runs             | US-01, US-02 | AC-004, AC-005      |
| Run detail  | `/runs/[runId]`   | Multi-agent evidence/decision | US-02..05    | AC-005..016         |
| Comparison  | `/comparisons`    | Single vs multi proof         | US-06        | AC-017              |
| Knowledge   | `/knowledge`      | Admin demo ingestion          | US-07        | AC-019              |

## Layout

- Dashboard uses a compact header, four factual metrics, `Chờ phê duyệt` queue and recent runs table.
- Case intake groups doanh nghiệp, khoản vay, tài chính and documents; live summary stays visible on desktop.
- Run detail uses: header/status -> planner strip -> three agent lanes -> event timeline/citations -> final decision gate.
- Decision panel keeps `confidence`, conflicts, conditions and proposed action visible; approval controls appear only for approver.

## Frontend Design Plan

Use the token/type/signature decisions from `design/decisions/startflow-credit-assessment.md`. Raw hex values belong in central CSS variables only. Avoid chat-first layout, oversized hero copy and decorative gradients.

## Components

| Need           | Preferred component                            | Notes                            |
| -------------- | ---------------------------------------------- | -------------------------------- |
| Shell          | `AppShell`, `SideNav`, `MobileNav`             | role-aware destinations          |
| Agent progress | `AgentLane`, `AgentCard`, `StatusBadge`        | visible labels + non-color cues  |
| Trace          | `EventTimeline`, `ToolEvent`, `CitationDrawer` | sequence/latency in utility type |
| Decision       | `DecisionGate`, `ApprovalPanel`                | confirmation and reason required |
| Data entry     | native labeled inputs + schema errors          | no placeholder-only labels       |
| Feedback       | inline banner/toast + retry action             | errors explain repair            |

## States

| Screen          | State                 | Behavior                                                  |
| --------------- | --------------------- | --------------------------------------------------------- |
| All protected   | signed out            | redirect to Keycloak, preserve return URL                 |
| Dashboard/cases | loading/empty/error   | stable skeleton; next action; retry                       |
| Run             | reconnecting          | show persisted timeline and non-blocking reconnect banner |
| Run             | partial agent failure | failed lane remains visible; final confidence reduced     |
| Approval        | permission denied     | explain required role; no disabled mystery button         |
| Knowledge       | non-admin             | explicit access denied and dashboard link                 |

## Copy

- Primary CTA: `Bắt đầu đánh giá`.
- Evidence: `Xem căn cứ`, `Công cụ đã dùng`.
- Approval: `Phê duyệt hành động`, `Từ chối và ghi lý do`.
- Partial: `Kết quả chưa đầy đủ — một chuyên gia gặp lỗi.`
- Reconnect: `Đã nối lại timeline từ sự kiện gần nhất.`

## Responsive Rules

- `>=1200px`: three agent lanes + right decision rail.
- `768-1199px`: two-column agent grid; decision below.
- `<768px`: one column, bottom nav, 44px targets, sticky approval controls, no horizontal table dependency.
- Support browser zoom 200%, keyboard focus, reduced motion and long Vietnamese labels.

## Accessibility

- Heading/order follows workflow; skip link to main content.
- Every state badge includes text; focus ring uses Trust teal and 2px offset.
- Timeline updates use a polite live region, not announce every token/event payload.
- Approval confirmation names the proposed action and provides cancel/escape.

## Open Questions

- None blocking; actual brand logo/assets are intentionally omitted until supplied.
