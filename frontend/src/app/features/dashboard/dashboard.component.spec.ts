import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import type { CaseSummary } from '../../core/api/models';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let api: jasmine.SpyObj<StartFlowApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<StartFlowApiService>('StartFlowApiService', ['listCases']);
    api.listCases.and.resolveTo(dashboardCases());

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), { provide: StartFlowApiService, useValue: api }],
    }).compileComponents();
  });

  it('renders four operational KPIs, recent runs and the next-action queue', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Hồ sơ demo');
    expect(text).toContain('Đang phân tích');
    expect(text).toContain('Chờ phê duyệt');
    expect(text).toContain('Đã có kết luận');
    expect(fixture.componentInstance.metrics()).toEqual({
      cases: 3,
      active: 1,
      approvals: 1,
      completed: 1,
    });
    expect(fixture.nativeElement.querySelector('sd-table')).not.toBeNull();
    expect(text).toContain('Xem yêu cầu phê duyệt');
  });

  it('renders a recoverable error state when the dashboard request fails', async () => {
    api.listCases.and.rejectWith(new Error('offline'));
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Không tải được tổng quan');
    expect(fixture.nativeElement.querySelector('app-error-state')).not.toBeNull();
  });

  it('keeps a stable loading state while the dashboard request is pending', () => {
    api.listCases.and.returnValue(new Promise(() => undefined));
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Đang tổng hợp hàng đợi');
    expect(fixture.nativeElement.querySelector('app-loading-state')).not.toBeNull();
    fixture.destroy();
  });

  it('offers case creation when the dashboard is empty', async () => {
    api.listCases.and.resolveTo([]);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chưa có hồ sơ');
    expect(fixture.nativeElement.textContent).toContain('Tạo hồ sơ demo');
  });

  it('navigates to the selected next action', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.openNextAction(fixture.componentInstance.nextActions()[0]!);
    expect(navigateSpy).toHaveBeenCalledWith(['/runs', 'run-approval']);
  });

  it('opens the NBA mini-run demo journey from the dashboard', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    fixture.componentInstance.openNbaDemo();

    expect(navigateSpy).toHaveBeenCalledWith(['/nba/operations']);
  });
});

function dashboardCases(): CaseSummary[] {
  return [
    caseSummary('case-approval', 'Sao Việt', 'AWAITING_APPROVAL', 'run-approval'),
    caseSummary('case-running', 'Mộc An', 'RUNNING', 'run-running'),
    caseSummary('case-complete', 'Hải Đăng', 'COMPLETED', 'run-complete'),
  ];
}

function caseSummary(
  id: string,
  companyName: string,
  status: NonNullable<CaseSummary['latestRun']>['status'],
  runId: string,
): CaseSummary {
  return {
    id,
    companyName,
    registrationNumber: `DEMO-${id}`,
    requestedAmount: 5_000_000_000,
    purpose: 'Bổ sung vốn lưu động cho doanh nghiệp demo.',
    createdAt: '2026-07-18T08:00:00.000Z',
    runCount: 1,
    latestRun: {
      id: runId,
      caseId: id,
      status,
      createdAt: '2026-07-18T09:00:00.000Z',
      completedAt: status === 'COMPLETED' ? '2026-07-18T09:05:00.000Z' : null,
      finalDecisionStatus: status === 'COMPLETED' ? 'RECOMMEND' : null,
    },
  };
}
