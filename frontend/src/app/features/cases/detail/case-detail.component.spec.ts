import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SdPermissionService } from '@sdcorejs/angular/modules/permission';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import type { CaseDetail } from '../../../core/api/models';
import { StartFlowApiService } from '../../../core/api/startflow-api.service';
import { STARTFLOW_PERMISSIONS } from '../../../core/auth/permission-map';
import { CaseDetailComponent } from './case-detail.component';

describe('CaseDetailComponent', () => {
  let api: jasmine.SpyObj<StartFlowApiService>;
  let notify: jasmine.SpyObj<SdNotifyService>;
  let permission: jasmine.SpyObj<SdPermissionService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<StartFlowApiService>('StartFlowApiService', [
      'getCase',
      'createRun',
    ]);
    notify = jasmine.createSpyObj<SdNotifyService>('SdNotifyService', ['info', 'error']);
    permission = jasmine.createSpyObj<SdPermissionService>('SdPermissionService', [
      'hasPermission',
    ]);
    permission.hasPermission.and.returnValue(true);
    api.getCase.and.resolveTo(caseDetail());
    api.createRun.and.resolveTo({ runId: 'run-new', status: 'PENDING' });

    await TestBed.configureTestingModule({
      imports: [CaseDetailComponent],
      providers: [
        provideRouter([]),
        { provide: StartFlowApiService, useValue: api },
        { provide: SdNotifyService, useValue: notify },
        { provide: SdPermissionService, useValue: permission },
      ],
    }).compileComponents();
  });

  it('renders financial and document snapshots with the Core run-history table', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Công ty Cổ phần Sao Việt Demo');
    expect(text).toContain('Ảnh chụp tài chính');
    expect(text).toContain('Báo cáo tài chính kiểm toán');
    expect(fixture.nativeElement.querySelector('sd-table')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('sd-view').length).toBe(9);
  });

  it('starts a run and navigates to the run workspace', async () => {
    const fixture = createFixture();
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    await fixture.whenStable();

    await fixture.componentInstance.startRun();

    expect(api.createRun).toHaveBeenCalledWith('case-1');
    expect(notify.info).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/runs', 'run-new']);
  });

  it('hides and blocks run creation without the run-start permission', async () => {
    permission.hasPermission.and.returnValue(false);
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(permission.hasPermission).toHaveBeenCalledWith(STARTFLOW_PERMISSIONS.runStart);
    expect(fixture.nativeElement.querySelector('[data-autoid$="case-start-run"]')).toBeNull();

    await fixture.componentInstance.startRun();

    expect(api.createRun).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(
      'Bạn không có quyền bắt đầu lượt đánh giá cho hồ sơ này.',
    );
  });

  it('shows a recoverable error when the case cannot be loaded', async () => {
    api.getCase.and.rejectWith(new Error('not found'));
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Không mở được hồ sơ');
    expect(fixture.nativeElement.querySelector('app-error-state')).not.toBeNull();
  });

  it('renders loading while the detail request is pending', () => {
    api.getCase.and.returnValue(new Promise(() => undefined));
    const fixture = createFixture();

    expect(fixture.nativeElement.textContent).toContain('Đang dựng lại hồ sơ');
    expect(fixture.nativeElement.querySelector('app-loading-state')).not.toBeNull();
    fixture.destroy();
  });

  it('offers the primary start action when run history is empty', async () => {
    api.getCase.and.resolveTo({ ...caseDetail(), latestRun: null, runCount: 0, runs: [] });
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hồ sơ chưa được đánh giá');
    expect(fixture.nativeElement.textContent).toContain('Bắt đầu đánh giá');
  });

  function createFixture() {
    const fixture = TestBed.createComponent(CaseDetailComponent);
    fixture.componentRef.setInput('caseId', 'case-1');
    fixture.detectChanges();
    return fixture;
  }
});

function caseDetail(): CaseDetail {
  return {
    id: 'case-1',
    companyName: 'Công ty Cổ phần Sao Việt Demo',
    registrationNumber: 'DEMO-01042',
    requestedAmount: 5_000_000_000,
    purpose: 'Bổ sung vốn lưu động phục vụ đơn hàng xuất khẩu trong quý tới.',
    createdAt: '2026-07-18T08:00:00.000Z',
    createdBy: 'analyst-demo',
    demoData: true,
    financials: {
      revenue: 45_000_000_000,
      ebitda: 9_000_000_000,
      totalDebt: 16_000_000_000,
      equity: 25_000_000_000,
      currentAssets: 20_000_000_000,
      currentLiabilities: 12_000_000_000,
    },
    submittedDocuments: ['Giấy đăng ký doanh nghiệp', 'Báo cáo tài chính kiểm toán'],
    latestRun: {
      id: 'run-1',
      caseId: 'case-1',
      status: 'COMPLETED',
      createdAt: '2026-07-18T09:00:00.000Z',
      completedAt: '2026-07-18T09:05:00.000Z',
      finalDecisionStatus: 'RECOMMEND',
    },
    runCount: 1,
    runs: [
      {
        id: 'run-1',
        caseId: 'case-1',
        status: 'COMPLETED',
        createdAt: '2026-07-18T09:00:00.000Z',
        completedAt: '2026-07-18T09:05:00.000Z',
        finalDecisionStatus: 'RECOMMEND',
      },
    ],
  };
}
