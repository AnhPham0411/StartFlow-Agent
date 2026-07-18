import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { CaseSummary } from '../../../core/api/models';
import { StartFlowApiService } from '../../../core/api/startflow-api.service';
import { CaseListComponent } from './case-list.component';

describe('CaseListComponent', () => {
  let api: jasmine.SpyObj<StartFlowApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<StartFlowApiService>('StartFlowApiService', ['listCases']);
    api.listCases.and.resolveTo(caseItems());
    await TestBed.configureTestingModule({
      imports: [CaseListComponent],
      providers: [provideRouter([]), { provide: StartFlowApiService, useValue: api }],
    }).compileComponents();
  });

  it('loads cases into the Core table with amount, status and run-count columns', async () => {
    const fixture = TestBed.createComponent(CaseListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('sd-table')).not.toBeNull();
    expect(fixture.componentInstance.tableOption.columns.map((column) => column.field)).toEqual(
      jasmine.arrayContaining(['companyName', 'requestedAmount', 'latestStatus', 'runCount']),
    );
    expect(fixture.componentInstance.filteredCases().length).toBe(2);
  });

  it('filters by company name or registration number without case sensitivity', async () => {
    const fixture = TestBed.createComponent(CaseListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.updateQuery('mộc an');
    expect(fixture.componentInstance.filteredCases().map((item) => item.id)).toEqual(['case-2']);

    fixture.componentInstance.updateQuery('DEMO-001');
    expect(fixture.componentInstance.filteredCases().map((item) => item.id)).toEqual(['case-1']);
  });

  it('opens a case through the approved detail route', async () => {
    const fixture = TestBed.createComponent(CaseListComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.openCase(caseItems()[0]!);
    expect(navigateSpy).toHaveBeenCalledWith(['/cases', 'case-1']);
  });

  it('shows a recoverable list error', async () => {
    api.listCases.and.rejectWith(new Error('offline'));
    const fixture = TestBed.createComponent(CaseListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Không tải được hồ sơ');
  });

  it('renders loading while the case request is pending', () => {
    api.listCases.and.returnValue(new Promise(() => undefined));
    const fixture = TestBed.createComponent(CaseListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Đang tải danh sách hồ sơ');
    expect(fixture.nativeElement.querySelector('app-loading-state')).not.toBeNull();
    fixture.destroy();
  });

  it('offers the primary create action when there are no cases', async () => {
    api.listCases.and.resolveTo([]);
    const fixture = TestBed.createComponent(CaseListComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chưa có hồ sơ');
    fixture.componentInstance.handleEmptyAction();
    expect(navigateSpy).toHaveBeenCalledWith(['/cases/new']);
  });
});

function caseItems(): CaseSummary[] {
  return [
    {
      id: 'case-1',
      companyName: 'Công ty Sao Việt Demo',
      registrationNumber: 'DEMO-001',
      requestedAmount: 5_000_000_000,
      purpose: 'Bổ sung vốn lưu động cho doanh nghiệp demo.',
      createdAt: '2026-07-18T08:00:00.000Z',
      runCount: 0,
      latestRun: null,
    },
    {
      id: 'case-2',
      companyName: 'Công ty Mộc An Demo',
      registrationNumber: 'DEMO-AML-88',
      requestedAmount: 8_500_000_000,
      purpose: 'Mở rộng nhà xưởng mô phỏng.',
      createdAt: '2026-07-18T09:00:00.000Z',
      runCount: 1,
      latestRun: {
        id: 'run-2',
        caseId: 'case-2',
        status: 'RUNNING',
        createdAt: '2026-07-18T09:30:00.000Z',
        completedAt: null,
        finalDecisionStatus: null,
      },
    },
  ];
}
