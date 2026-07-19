# SHB Layout and Navigation Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Core UI tab routing with standard Angular routing, add responsive page padding, group the sidebar into two useful levels, and display the supplied SHB logo.

**Architecture:** `MainLayoutComponent` remains the single portal shell and projects a standard `RouterOutlet` into `SdLayoutComponent`. Core UI continues to own the sidebar, permission filtering, and responsive frame; application code supplies two grouped menu trees, SHB branding, and a padded scrolling content boundary. Page components lose tab-only metadata while preserving their route behavior and business logic.

**Tech Stack:** Angular 20 standalone components, Angular Router, `@sdcorejs/angular` layout/permission modules, Jasmine/Karma, Node test runner, SCSS.

---

## File map

- `frontend/src/app/layout/main-layout.component.{ts,html,scss}` — shell routing, grouped navigation, responsive content boundary.
- `frontend/src/app/layout/main-layout.component.spec.ts` — shell outlet, hierarchy, and accessibility regression tests.
- `frontend/src/app/layout/layout.configuration.ts` — SHB logo, title, and brand palette.
- `frontend/src/app/layout/layout.configuration.spec.ts` — sidebar configuration regression test.
- `frontend/src/app/features/{dashboard,cases,comparisons,knowledge,runs}/**/*.component.ts` — remove obsolete tab-router metadata only.
- `test/contracts/frontend-shell.test.mjs` — static guarantee that the tab-router dependency does not return and shell spacing/logo assets remain present.
- `frontend/public/logo.png` — user-supplied SHB logo; track without modifying its bytes.

### Task 1: Add failing shell and tab-removal regression tests

**Files:**
- Modify: `frontend/src/app/layout/main-layout.component.spec.ts`
- Create: `frontend/src/app/layout/layout.configuration.spec.ts`
- Create: `test/contracts/frontend-shell.test.mjs`

- [ ] **Step 1: Replace the outlet and menu assertions with the desired shell behavior**

In `main-layout.component.spec.ts`, replace the current outlet test with:

```ts
it('renders the Core UI layout through the standard router outlet', () => {
  const fixture = TestBed.createComponent(MainLayoutComponent);
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('sd-layout')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('sd-tab-router-outlet')).toBeNull();
  expect(fixture.nativeElement.querySelector('main')?.classList).toContain('app-route-content');
});
```

Replace the flat-menu test with:

```ts
it('groups permission-aware routes into business and AI navigation', () => {
  const fixture = TestBed.createComponent(MainLayoutComponent);
  const groups = fixture.componentInstance.menus.map((group) => ({
    id: group.id,
    title: group.title,
    paths:
      'children' in group
        ? (group.children ?? []).flatMap((child) => ('path' in child ? [child.path] : []))
        : [],
  }));

  expect(groups).toEqual([
    {
      id: 'business',
      title: 'Nghiệp vụ',
      paths: ['/dashboard', '/cases'],
    },
    {
      id: 'ai-data',
      title: 'AI & Dữ liệu',
      paths: ['/comparisons', '/knowledge'],
    },
  ]);
});
```

- [ ] **Step 2: Add a focused sidebar branding spec**

Create `layout.configuration.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { AuthStateService } from '../core/auth/auth-state.service';
import { LayoutConfiguration } from './layout.configuration';

describe('LayoutConfiguration', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LayoutConfiguration,
        {
          provide: AuthStateService,
          useValue: {
            user: () => ({ username: 'admin', name: 'SHB Admin' }),
            logout: () => Promise.resolve(),
          },
        },
      ],
    });
  });

  it('uses the supplied SHB logo and palette', () => {
    const configuration = TestBed.inject(LayoutConfiguration);

    expect(configuration.sidebar).toEqual({
      version: 1,
      brandColor: '#f37021',
      brandLightColor: '#fff3e8',
      logoUrl: '/logo.png',
      defaultTitle: 'SHB StartFlow',
      pin: { enabled: true },
    });
  });
});
```

- [ ] **Step 3: Add the static shell contract**

Create `test/contracts/frontend-shell.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeSources = [
  'frontend/src/app/layout/main-layout.component.ts',
  'frontend/src/app/layout/main-layout.component.html',
  'frontend/src/app/features/dashboard/dashboard.component.ts',
  'frontend/src/app/features/cases/list/case-list.component.ts',
  'frontend/src/app/features/cases/intake/case-intake.component.ts',
  'frontend/src/app/features/cases/detail/case-detail.component.ts',
  'frontend/src/app/features/runs/run-workspace.component.ts',
  'frontend/src/app/features/comparisons/comparison.component.ts',
  'frontend/src/app/features/knowledge/knowledge.component.ts',
];

test('SHB shell owns responsive spacing and a valid PNG logo', async () => {
  const styles = await readFile('frontend/src/app/layout/main-layout.component.scss', 'utf8');
  assert.match(styles, /padding:\s*24px/);
  assert.match(styles, /@media\s*\(max-width:\s*767px\)[\s\S]*padding:\s*16px/);

  const logo = await readFile('frontend/public/logo.png');
  assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('routed pages no longer depend on the Core tab router', async () => {
  for (const path of routeSources) {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(
      source,
      /@sdcorejs\/angular\/components\/tab-router|SdTabComponent|SD_TAB|sd-tab-router-outlet/,
      `${path} still contains tab-router integration`,
    );
  }
});
```

- [ ] **Step 4: Run both test layers and confirm RED**

Run:

```powershell
corepack pnpm --filter @startflow/frontend exec ng test --watch=false --browsers=ChromeHeadless --include='src/app/layout/*.spec.ts'
node --test test/contracts/frontend-shell.test.mjs
```

Expected: the Angular run reports three failing expectations (standard outlet, grouped menus, SHB configuration); the Node run reports both tests failing because the SCSS file is absent and tab-router references remain.

- [ ] **Step 5: Commit the regression tests**

```powershell
git add -- frontend/src/app/layout/main-layout.component.spec.ts frontend/src/app/layout/layout.configuration.spec.ts test/contracts/frontend-shell.test.mjs
git commit -m "test(ui): cover SHB shell navigation refresh"
```

### Task 2: Implement the standard router shell, grouped menus, spacing, and SHB branding

**Files:**
- Modify: `frontend/src/app/layout/main-layout.component.ts`
- Modify: `frontend/src/app/layout/main-layout.component.html`
- Create: `frontend/src/app/layout/main-layout.component.scss`
- Modify: `frontend/src/app/layout/layout.configuration.ts`
- Add: `frontend/public/logo.png`

- [ ] **Step 1: Switch `MainLayoutComponent` to `RouterOutlet` and grouped menu data**

Replace `main-layout.component.ts` with:

```ts
import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  type ElementRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SdLayoutComponent, type SdLayoutMenu } from '@sdcorejs/angular/modules/layout';
import { filter } from 'rxjs';
import { STARTFLOW_PERMISSIONS } from '../core/auth/permission-map';

@Component({
  selector: 'app-main-layout',
  imports: [SdLayoutComponent, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent {
  readonly #router = inject(Router);
  readonly #liveAnnouncer = inject(LiveAnnouncer);
  private readonly routeMain = viewChild<ElementRef<HTMLElement>>('routeMain');
  #hasCompletedNavigation = this.#router.navigated;

  readonly menus: SdLayoutMenu[] = [
    {
      id: 'business',
      title: 'Nghiệp vụ',
      icon: 'account_balance',
      children: [
        {
          id: 'dashboard',
          path: '/dashboard',
          title: 'Tổng quan',
          icon: 'dashboard',
          permission: STARTFLOW_PERMISSIONS.dashboardView,
        },
        {
          id: 'cases',
          path: '/cases',
          title: 'Hồ sơ tín dụng',
          icon: 'folder_open',
          permission: STARTFLOW_PERMISSIONS.caseView,
        },
      ],
    },
    {
      id: 'ai-data',
      title: 'AI & Dữ liệu',
      icon: 'auto_awesome',
      children: [
        {
          id: 'comparisons',
          path: '/comparisons',
          title: 'So sánh mô hình',
          icon: 'compare_arrows',
          permission: STARTFLOW_PERMISSIONS.comparisonView,
        },
        {
          id: 'knowledge',
          path: '/knowledge',
          title: 'Kho tri thức',
          icon: 'menu_book',
          permission: STARTFLOW_PERMISSIONS.knowledgeView,
        },
      ],
    },
  ];

  constructor() {
    this.#router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => {
        const shouldMoveFocus = this.#hasCompletedNavigation;
        this.#hasCompletedNavigation = true;
        const title = activeRouteTitle(this.#router);
        void this.#liveAnnouncer.announce(`Đã chuyển đến trang ${title}.`, 'polite');
        if (shouldMoveFocus) {
          queueMicrotask(() => this.routeMain()?.nativeElement.focus());
        }
      });
  }
}

function activeRouteTitle(router: Router): string {
  let route = router.routerState.snapshot.root;
  while (route.firstChild) route = route.firstChild;
  return typeof route.title === 'string' ? route.title : 'StartFlow';
}
```

- [ ] **Step 2: Replace the tab outlet with the standard outlet**

Set `main-layout.component.html` to:

```html
<sd-layout [menus]="menus">
  <main #routeMain class="app-route-content" tabindex="-1" aria-label="Nội dung chính">
    <router-outlet />
  </main>
</sd-layout>
```

- [ ] **Step 3: Add the responsive content boundary**

Create `main-layout.component.scss`:

```scss
:host {
  display: block;
  height: 100%;
}

.app-route-content {
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  padding: 24px;
}

@media (max-width: 767px) {
  .app-route-content {
    padding: 16px;
  }
}
```

- [ ] **Step 4: Apply SHB sidebar branding**

Replace the `sidebar` value in `layout.configuration.ts` with:

```ts
readonly sidebar = {
  version: 1 as const,
  brandColor: '#f37021',
  brandLightColor: '#fff3e8',
  logoUrl: '/logo.png',
  defaultTitle: 'SHB StartFlow',
  pin: { enabled: true },
};
```

Do not transform `frontend/public/logo.png`; Angular already copies `frontend/public/**` to the build root.

- [ ] **Step 5: Run the shell tests**

Run:

```powershell
corepack pnpm --filter @startflow/frontend exec ng test --watch=false --browsers=ChromeHeadless --include='src/app/layout/*.spec.ts'
node --test --test-name-pattern="SHB shell owns" test/contracts/frontend-shell.test.mjs
```

Expected: five Angular layout tests pass; the selected Node shell-spacing/logo test passes.

- [ ] **Step 6: Commit the shell implementation and supplied logo**

```powershell
git add -- frontend/src/app/layout/main-layout.component.ts frontend/src/app/layout/main-layout.component.html frontend/src/app/layout/main-layout.component.scss frontend/src/app/layout/layout.configuration.ts frontend/public/logo.png
git commit -m "feat(ui): refresh SHB portal shell"
```

### Task 3: Remove obsolete page-level tab-router integration

**Files:**
- Modify: `frontend/src/app/features/dashboard/dashboard.component.ts`
- Modify: `frontend/src/app/features/cases/list/case-list.component.ts`
- Modify: `frontend/src/app/features/cases/intake/case-intake.component.ts`
- Modify: `frontend/src/app/features/cases/detail/case-detail.component.ts`
- Modify: `frontend/src/app/features/runs/run-workspace.component.ts`
- Modify: `frontend/src/app/features/comparisons/comparison.component.ts`
- Modify: `frontend/src/app/features/knowledge/knowledge.component.ts`

- [ ] **Step 1: Remove static tab metadata from five route pages**

From dashboard, case list, case intake, comparison, and knowledge components, delete the import:

```ts
import { SdTabComponent } from '@sdcorejs/angular/components/tab-router';
```

Delete these exact decorator blocks immediately before their exported component classes; keep the Angular `@Component` metadata unchanged:

```ts
@SdTabComponent({
  component: DashboardComponent,
  name: 'Tổng quan',
  icon: 'dashboard',
  color: 'primary',
})

@SdTabComponent({
  component: CaseListComponent,
  name: 'Hồ sơ tín dụng',
  icon: 'folder_open',
  color: 'primary',
})

@SdTabComponent({
  component: CaseIntakeComponent,
  name: 'Tạo hồ sơ',
  icon: 'note_add',
  color: 'primary',
})

@SdTabComponent({
  component: ComparisonComponent,
  name: 'So sánh mô hình',
  icon: 'compare_arrows',
  tooltip: 'So sánh Single-agent và Multi-agent',
  color: 'primary',
})

@SdTabComponent({
  component: KnowledgeComponent,
  name: 'Tri thức demo',
  icon: 'menu_book',
  tooltip: 'Quản lý thư viện tri thức mô phỏng',
  color: 'primary',
})
```

- [ ] **Step 2: Remove dynamic tab metadata from case detail**

Delete this import from `case-detail.component.ts`:

```ts
import { SD_TAB, SdTabComponent } from '@sdcorejs/angular/components/tab-router';
```

Delete this decorator block:

```ts
@SdTabComponent({
  component: CaseDetailComponent,
  name: ({ params }) => `Hồ sơ #${params['caseId'] ?? '—'}`,
  icon: 'folder_open',
  color: 'primary',
})
```

Delete this field:

```ts
readonly #tab = inject(SD_TAB, { optional: true });
```

and the tab update after `this.data.set(item)`:

```ts
this.#tab?.tabInfoChanges.next({
  name: item.companyName,
  icon: 'folder_open',
  tooltip: `Hồ sơ ${item.registrationNumber}`,
  color: 'primary',
});
```

Keep loading, error handling, routing, permissions, and this route-data effect unchanged:

```ts
effect(() => {
  const currentCaseId = this.caseId();
  void this.load(currentCaseId);
});
```

- [ ] **Step 3: Remove dynamic tab metadata from run workspace**

Replace the tab-router import in `run-workspace.component.ts` by deleting it entirely:

```ts
import { SD_TAB, SdTabComponent } from '@sdcorejs/angular/components/tab-router';
```

Delete this decorator block:

```ts
@SdTabComponent({
  component: RunWorkspaceComponent,
  name: ({ params }) => `Phân tích #${String(params['runId'] ?? '—').slice(0, 8)}`,
  icon: 'hub',
  tooltip: 'Không gian phân tích đa tác nhân',
  color: 'primary',
})
```

Delete this field:

```ts
readonly #tab = inject(SD_TAB, { optional: true });
```

and the second constructor effect that only updates tab information:

```ts
effect(() => {
  const run = this.facade.run();
  if (!run) return;
  this.#tab?.tabInfoChanges.next({
    name: run.caseSnapshot?.companyName ?? `Phân tích #${run.id.slice(0, 8)}`,
    icon: 'hub',
    tooltip: `Lượt đánh giá ${run.id}`,
    color: this.runStatus()?.color ?? 'primary',
  });
});
```

Keep `effect(() => void this.facade.load(this.runId()))`; it remains the route-data loading trigger.

- [ ] **Step 4: Run the tab-removal contract and frontend type checks**

Run:

```powershell
node --test --test-name-pattern="routed pages no longer" test/contracts/frontend-shell.test.mjs
corepack pnpm --filter @startflow/frontend typecheck
```

Expected: the contract test passes with no tab-router matches and Angular compilation exits 0.

- [ ] **Step 5: Commit page cleanup**

```powershell
git add -- frontend/src/app/features/dashboard/dashboard.component.ts frontend/src/app/features/cases/list/case-list.component.ts frontend/src/app/features/cases/intake/case-intake.component.ts frontend/src/app/features/cases/detail/case-detail.component.ts frontend/src/app/features/runs/run-workspace.component.ts frontend/src/app/features/comparisons/comparison.component.ts frontend/src/app/features/knowledge/knowledge.component.ts test/contracts/frontend-shell.test.mjs
git commit -m "refactor(ui): remove tab router integration"
```

### Task 4: Verify the complete UI change

**Files:**
- Verify only; do not modify unrelated NBA or `.sdcorejs` artifacts.

- [ ] **Step 1: Run formatting and diff checks for touched files**

```powershell
corepack pnpm exec prettier --check frontend/src/app/layout frontend/src/app/features/dashboard/dashboard.component.ts frontend/src/app/features/cases frontend/src/app/features/runs/run-workspace.component.ts frontend/src/app/features/comparisons/comparison.component.ts frontend/src/app/features/knowledge/knowledge.component.ts test/contracts/frontend-shell.test.mjs
git diff --check HEAD~3..HEAD
```

Expected: Prettier and diff checks exit 0.

- [ ] **Step 2: Run frontend lint and all shell contracts**

```powershell
corepack pnpm --filter @startflow/frontend lint
node --test test/contracts/frontend-shell.test.mjs
```

Expected: lint exits 0 and both Node contract tests pass.

- [ ] **Step 3: Run the complete Angular unit suite**

```powershell
corepack pnpm --filter @startflow/frontend test
```

Expected: all Angular tests pass with zero failures.

- [ ] **Step 4: Build the production frontend**

```powershell
corepack pnpm --filter @startflow/frontend build:production
```

Expected: Angular production build exits 0; existing third-party CommonJS warnings may remain, but there are no compilation or budget errors.

- [ ] **Step 5: Inspect the local portal when a browser surface is available**

Run `corepack pnpm --filter @startflow/frontend dev`, open `http://localhost:3000`, and verify desktop plus a width below 768px:

1. SHB logo and orange active color are visible.
2. `Nghiệp vụ` expands to Tổng quan/Hồ sơ tín dụng.
3. `AI & Dữ liệu` expands to So sánh mô hình/Kho tri thức.
4. Pages have 24px desktop and 16px mobile outer spacing.
5. Navigation replaces the active page instead of opening persistent tabs.

If no browser surface is connected, record this visual step as skipped and report the automated evidence instead of claiming manual visual verification.

- [ ] **Step 6: Confirm scope isolation**

```powershell
git status --short
git log -4 --oneline
```

Expected: UI commits contain only the files listed in this plan. Existing unrelated changes to NBA and `.sdcorejs` remain untouched and uncommitted by this work.
