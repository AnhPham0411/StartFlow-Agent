import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import { NbaApiService } from '../../../core/api/nba-api.service';
import type {
  NbaAssessmentResult,
  NbaCustomerDetail,
  NbaRecommendationAudit,
} from '../../../core/api/nba.models';
import { NbaCustomerDetailComponent } from './nba-customer-detail.component';

describe('NbaCustomerDetailComponent', () => {
  let api: jasmine.SpyObj<NbaApiService>;
  let notify: jasmine.SpyObj<SdNotifyService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<NbaApiService>('NbaApiService', [
      'getCustomer',
      'getAssessment',
      'getNotes',
      'getRecommendationAudit',
      'submitFeedback',
      'saveNote',
    ]);
    notify = jasmine.createSpyObj<SdNotifyService>('SdNotifyService', ['success', 'error']);
    api.getCustomer.and.resolveTo(customerDetail());
    api.getAssessment.and.resolveTo(assessmentResult());
    api.getNotes.and.resolveTo([
      {
        id: 7,
        customer_id: 42,
        sale_id: 2,
        note_text: 'Khách muốn tìm hiểu thêm về lãi suất.',
        created_at: '2026-07-19T01:00:00.000Z',
        sale_name: 'Sale Demo',
      },
    ]);
    api.getRecommendationAudit.and.resolveTo(recommendationAudit());
    api.submitFeedback.and.resolveTo({ ok: true, suppressed: false });
    api.saveNote.and.resolveTo({ ok: true, noteId: 8 });

    await TestBed.configureTestingModule({
      imports: [NbaCustomerDetailComponent],
      providers: [
        provideRouter([]),
        { provide: NbaApiService, useValue: api },
        { provide: SdNotifyService, useValue: notify },
      ],
    }).compileComponents();
  });

  it('renders recommendation, staleness, 3/6-month assessment and audit from live endpoints', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Nguyễn Demo An');
    expect(text).toContain('Dữ liệu đã thay đổi');
    expect(text).toContain('Gói vay linh hoạt');
    expect(text).toContain('Đánh giá 3/6 tháng');
    expect(text).toContain('rule-based');
    expect(fixture.nativeElement.querySelectorAll('sd-table').length).toBeGreaterThanOrEqual(2);
    expect(api.getRecommendationAudit).toHaveBeenCalledWith('123');
  });

  it('requires a rejection reason before sending feedback', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.componentInstance.feedbackStatus.set('rejected');
    fixture.componentInstance.rejectReason.set('');

    await fixture.componentInstance.submitFeedback();

    expect(api.submitFeedback).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Vui lòng nhập lý do từ chối.');
  });

  it('submits feedback against the displayed recommendation', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.componentInstance.feedbackStatus.set('success');
    fixture.componentInstance.feedbackProduct.set('vay');
    fixture.componentInstance.feedbackNote.set('Khách đồng ý nhận tư vấn.');

    await fixture.componentInstance.submitFeedback();

    expect(api.submitFeedback).toHaveBeenCalledWith({
      rec_id: '123',
      product: 'vay',
      status: 'success',
      note: 'Khách đồng ý nhận tư vấn.',
    });
    expect(notify.success).toHaveBeenCalledWith('Đã ghi nhận kết quả tư vấn.');
  });

  it('saves a trimmed call note and reloads note history', async () => {
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.componentInstance.noteText.set('  Hẹn gọi lại sáng thứ Hai.  ');

    await fixture.componentInstance.saveNote();

    expect(api.saveNote).toHaveBeenCalledWith(42, 'Hẹn gọi lại sáng thứ Hai.');
    expect(api.getNotes).toHaveBeenCalledTimes(2);
    expect(notify.success).toHaveBeenCalledWith('Đã lưu ghi chú cuộc gọi.');
  });

  it('shows a recoverable error when the customer cannot be loaded', async () => {
    api.getCustomer.and.rejectWith(new Error('not found'));
    const fixture = createFixture();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Không mở được khách hàng');
    expect(fixture.nativeElement.querySelector('app-error-state')).not.toBeNull();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(NbaCustomerDetailComponent);
    fixture.componentRef.setInput('customerId', '42');
    fixture.detectChanges();
    return fixture;
  }
});

function customerDetail(): NbaCustomerDetail {
  return {
    customer_id: 42,
    full_name: 'Nguyễn Demo An',
    cif_code: 'CIF-00042',
    recommendation: {
      id: '123',
      version: 3,
      source: 'rules',
      created_at: '2026-07-18T23:00:00.000Z',
      product_rank1: 'vay',
      hook1: 'Gói vay linh hoạt theo dòng tiền',
      explain1: 'Dòng tiền vào ổn định và tỷ lệ nợ phù hợp.',
      product_rank2: 'the',
      hook2: 'Thẻ hoàn tiền cho chi tiêu thường xuyên',
      explain2: 'Tần suất giao dịch cao trong ba tháng gần nhất.',
      rules_applied: ['R1', 'R4'],
      weights_versions: { vay: '2026-07' },
      input_snapshot: { features: { casa_avg: 10_000_000 } },
      input_snapshot_hash: 'hash-demo-123',
    },
    versions: [
      { version: 3, created_at: '2026-07-18T23:00:00.000Z', source: 'rules' },
      { version: 2, created_at: '2026-07-17T23:00:00.000Z', source: 'rules' },
    ],
    staleness: { flag: true, fields: ['casa_avg'] },
  };
}

function assessmentResult(): NbaAssessmentResult {
  const window = {
    from_date: '2026-04-19',
    to_date: '2026-07-19',
    total_in: 120_000_000,
    total_out: 90_000_000,
    net_flow: 30_000_000,
    txn_count: 48,
    txn_per_month: 16,
    max_txn_amount: 20_000_000,
    active_months: 3,
    spend_tags: [{ tag: 'shopping', txn_count: 14 }],
    loans_opened: 0,
    products_opened: 1,
  };

  return {
    customer_id: 42,
    as_of: '2026-07-19',
    current: {
      casa_avg: 12_500_000,
      casa_accounts: 1,
      total_debt: 25_000_000,
      monthly_payment: 2_500_000,
      monthly_income: 20_000_000,
      dti: 0.125,
      has_overdue: false,
      cic_group: 1,
      age: 34,
    },
    window_3m: { ...window, months: 3 },
    window_6m: {
      ...window,
      months: 6,
      from_date: '2026-01-19',
      total_in: 220_000_000,
      total_out: 170_000_000,
      net_flow: 50_000_000,
      txn_count: 88,
      txn_per_month: 14.7,
      active_months: 6,
    },
    trend: {
      net_flow_pct: 0.2,
      txn_count_pct: 0.1,
      total_in_pct: 0.15,
      direction: 'up',
    },
    relationship: {
      held_products: [{ product: 'taikhoan', tier: 'standard', since: '2024-01-01' }],
      suppressed: [],
      last_contact_days: 30,
      last_feedback: null,
      note_count: 1,
    },
    customer_blocks: [],
    packages: [
      {
        product: 'vay',
        package: 'Vay linh hoạt',
        tier: 'gold',
        eligible: true,
        criteria: [
          {
            code: 'DTI',
            label: 'Tỷ lệ nợ trên thu nhập',
            passed: true,
            actual: '12.5%',
            required: '< 50%',
            source: 'catalog',
            blocking: true,
          },
        ],
        multiplier: 1,
        blocked_by: [],
      },
    ],
    drift: [
      {
        product: 'vay',
        package: 'Vay linh hoạt',
        code: 'CASA',
        label: 'Số dư CASA',
        was: true,
        now: false,
      },
    ],
    explanation: {
      mode: 'rules',
      evidence: ['Dòng tiền vào 3 tháng đạt 120 triệu đồng.'],
      narrative: null,
      degraded_reason: null,
    },
  };
}

function recommendationAudit(): NbaRecommendationAudit {
  return {
    id: '123',
    customer_id: 42,
    version: 3,
    source: 'rules',
    created_at: '2026-07-18T23:00:00.000Z',
    input_snapshot_hash: 'hash-demo-123',
    rules_applied: ['R1', 'R4'],
    feedback: [],
  };
}
