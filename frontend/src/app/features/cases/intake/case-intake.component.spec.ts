import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import type { CaseInput } from '@startflow/contracts';
import type { CaseDetail } from '../../../core/api/models';
import { StartFlowApiService } from '../../../core/api/startflow-api.service';
import { CaseIntakeComponent } from './case-intake.component';

describe('CaseIntakeComponent', () => {
  let api: jasmine.SpyObj<StartFlowApiService>;
  let notify: jasmine.SpyObj<SdNotifyService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<StartFlowApiService>('StartFlowApiService', ['createCase']);
    notify = jasmine.createSpyObj<SdNotifyService>('SdNotifyService', [
      'success',
      'warning',
      'error',
    ]);
    api.createCase.and.callFake(async (input) => createdCase(input));

    await TestBed.configureTestingModule({
      imports: [CaseIntakeComponent],
      providers: [
        provideRouter([]),
        { provide: StartFlowApiService, useValue: api },
        { provide: SdNotifyService, useValue: notify },
      ],
    }).compileComponents();
  });

  it('renders the three Core intake sections and a sticky summary', () => {
    const fixture = TestBed.createComponent(CaseIntakeComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Doanh nghiệp và khoản vay');
    expect(text).toContain('Ảnh chụp tài chính');
    expect(text).toContain('Tài liệu đã nộp');
    expect(text).toContain('Tóm tắt trước khi lưu');
    expect(fixture.nativeElement.querySelectorAll('sd-section').length).toBe(5);
  });

  it('keeps Core text and number controls exposed to assistive technology', async () => {
    const fixture = TestBed.createComponent(CaseIntakeComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const controls: Array<[string, string]> = [
      ['sd-input', ':scope > .sd-input-container[aria-hidden="true"], input[aria-hidden="true"]'],
      ['sd-input-number', ':scope > div[aria-hidden="true"], input[aria-hidden="true"]'],
      [
        'sd-textarea',
        ':scope > .sd-textarea-container[aria-hidden="true"], textarea[aria-hidden="true"]',
      ],
    ];
    for (const [selector, hiddenEditableSelector] of controls) {
      const control = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
      expect(control).withContext(`${selector} should render`).not.toBeNull();
      expect(control?.querySelector(hiddenEditableSelector))
        .withContext(`${selector} must not hide its editable control`)
        .toBeNull();
    }
  });

  it('uses caseInputSchema and exposes Vietnamese errors before calling the API', async () => {
    const fixture = TestBed.createComponent(CaseIntakeComponent);
    fixture.detectChanges();
    fixture.componentInstance.input.update((current) => ({
      ...current,
      companyName: '',
      requestedAmount: 0,
      financials: { ...current.financials, ebitda: -10 },
    }));

    await fixture.componentInstance.submit();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.createCase).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errors()['companyName']).toContain('Tên doanh nghiệp');
    expect(fixture.componentInstance.errors()['requestedAmount']).toContain('lớn hơn 0');
    expect(fixture.componentInstance.errors()['financials.ebitda']).toBeUndefined();
    expect(notify.warning).toHaveBeenCalled();
    const summary = fixture.nativeElement.querySelector(
      '[data-testid="validation-summary"]',
    ) as HTMLElement | null;
    expect(summary).not.toBeNull();
    expect(document.activeElement).toBe(summary);
  });

  it('creates the case and navigates to its detail route', async () => {
    const fixture = TestBed.createComponent(CaseIntakeComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    await fixture.componentInstance.submit();

    expect(api.createCase).toHaveBeenCalledWith(
      jasmine.objectContaining({ companyName: 'Công ty Cổ phần Sao Việt Demo', demoData: true }),
    );
    expect(notify.success).toHaveBeenCalledWith('Đã tạo hồ sơ demo thành công.');
    expect(navigateSpy).toHaveBeenCalledWith(['/cases', 'case-created']);
  });

  it('switches fixture and updates the document checklist immutably', () => {
    const fixture = TestBed.createComponent(CaseIntakeComponent);
    fixture.componentInstance.selectFixture('compliance-blocked');
    expect(fixture.componentInstance.input().registrationNumber).toBe('DEMO-AML-88');

    fixture.componentInstance.toggleDocument('Báo cáo tài chính kiểm toán', true);
    expect(fixture.componentInstance.input().submittedDocuments).toContain(
      'Báo cáo tài chính kiểm toán',
    );
    expect(fixture.componentInstance.selectedFixtureId()).toBeNull();
  });
});

function createdCase(input: CaseInput): CaseDetail {
  return {
    id: 'case-created',
    ...input,
    createdBy: 'analyst-demo',
    createdAt: '2026-07-18T08:00:00.000Z',
    latestRun: null,
    runCount: 0,
    runs: [],
  };
}
