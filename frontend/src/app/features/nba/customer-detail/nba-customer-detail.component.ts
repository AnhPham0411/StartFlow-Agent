import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SdBadge } from '@sdcorejs/angular/components/badge';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SD_TAB, SdTabComponent } from '@sdcorejs/angular/components/tab-router';
import { SdTable, type SdTableOption } from '@sdcorejs/angular/components/table';
import { SdView } from '@sdcorejs/angular/components/view';
import { SdSelect } from '@sdcorejs/angular/forms/select';
import { SdTextarea } from '@sdcorejs/angular/forms/textarea';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import { NbaApiService } from '../../../core/api/nba-api.service';
import type {
  NbaAssessmentResult,
  NbaCallNote,
  NbaCustomerDetail,
  NbaFeedbackInput,
  NbaFeedbackStatus,
  NbaPackageAssessment,
  NbaProduct,
  NbaRecommendationAudit,
  NbaRecommendationVersion,
} from '../../../core/api/nba.models';
import { CoreFormAccessibilityDirective } from '../../../shared/a11y/core-form-accessibility.directive';
import { formatCurrency, formatDateTime, formatPercent } from '../../../shared/formatters';
import { EmptyStateComponent } from '../../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state.component';

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface RecommendationSlot {
  rank: 1 | 2;
  product: NbaProduct;
  productLabel: string;
  hook: string;
  explanation: string;
}

interface PackageRow extends NbaPackageAssessment {
  product_label: string;
  criteria_summary: string;
  blocked_summary: string;
}

const PRODUCT_LABELS: Record<NbaProduct, string> = {
  the: 'Thẻ',
  vay: 'Vay',
  dautu: 'Đầu tư',
  baohiem: 'Bảo hiểm',
  taikhoan: 'Tài khoản',
};

@Component({
  selector: 'app-nba-customer-detail',
  imports: [
    SdBadge,
    SdButton,
    SdInform,
    SdSection,
    SdTable,
    SdView,
    SdSelect,
    SdTextarea,
    CoreFormAccessibilityDirective,
    SdPageComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './nba-customer-detail.component.html',
  styleUrl: './nba-customer-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@SdTabComponent({
  component: NbaCustomerDetailComponent,
  name: ({ params }) => `Khách hàng #${params['customerId'] ?? '—'}`,
  icon: 'person_search',
  color: 'primary',
})
export class NbaCustomerDetailComponent {
  readonly #api = inject(NbaApiService);
  readonly #route = inject(ActivatedRoute, { optional: true });
  readonly #notify = inject(SdNotifyService);
  readonly #tab = inject(SD_TAB, { optional: true });
  readonly tables = viewChildren(SdTable);

  readonly customerId = input<string>();
  readonly customer = signal<NbaCustomerDetail | null>(null);
  readonly assessment = signal<NbaAssessmentResult | null>(null);
  readonly notes = signal<NbaCallNote[]>([]);
  readonly audit = signal<NbaRecommendationAudit | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly feedbackStatus = signal<NbaFeedbackStatus>('success');
  readonly feedbackProduct = signal<NbaProduct | null>(null);
  readonly rejectReason = signal('');
  readonly feedbackNote = signal('');
  readonly submittingFeedback = signal(false);
  readonly noteText = signal('');
  readonly savingNote = signal(false);

  readonly feedbackStatusOptions: SelectOption<NbaFeedbackStatus>[] = [
    { value: 'success', label: 'Tư vấn thành công' },
    { value: 'callback', label: 'Hẹn gọi lại' },
    { value: 'no_contact', label: 'Không liên hệ được' },
    { value: 'rejected', label: 'Khách từ chối' },
  ];

  readonly productOptions: SelectOption<NbaProduct>[] = Object.entries(PRODUCT_LABELS).map(
    ([value, label]) => ({ value: value as NbaProduct, label }),
  );

  readonly recommendationSlots = computed<RecommendationSlot[]>(() => {
    const recommendation = this.customer()?.recommendation;
    if (!recommendation) return [];
    const slots: RecommendationSlot[] = [];
    if (recommendation.product_rank1) {
      slots.push({
        rank: 1,
        product: recommendation.product_rank1,
        productLabel: productLabel(recommendation.product_rank1),
        hook: recommendation.hook1 ?? 'Chưa có câu mở đầu.',
        explanation: recommendation.explain1 ?? 'Chưa có giải thích.',
      });
    }
    if (recommendation.product_rank2) {
      slots.push({
        rank: 2,
        product: recommendation.product_rank2,
        productLabel: productLabel(recommendation.product_rank2),
        hook: recommendation.hook2 ?? 'Chưa có câu mở đầu.',
        explanation: recommendation.explain2 ?? 'Chưa có giải thích.',
      });
    }
    return slots;
  });

  readonly packageRows = computed<PackageRow[]>(() =>
    (this.assessment()?.packages ?? []).map((item) => ({
      ...item,
      product_label: productLabel(item.product),
      criteria_summary: `${item.criteria.filter((criterion) => criterion.passed).length}/${item.criteria.length}`,
      blocked_summary: item.blocked_by.join(', ') || 'Không',
    })),
  );

  readonly stalenessDescription = computed(() => {
    const fields = this.customer()?.staleness.fields ?? [];
    return fields.length
      ? `Các chỉ số thay đổi so với snapshot: ${fields.map(stalenessLabel).join(', ')}. Hãy kiểm tra lại trước khi tư vấn.`
      : 'Các chỉ số neo chưa vượt ngưỡng thay đổi so với snapshot đề xuất.';
  });

  readonly explanationMode = computed(() => {
    const mode = this.assessment()?.explanation.mode;
    return mode === 'rules' ? 'rule-based' : (mode ?? '—');
  });

  readonly packageTable: SdTableOption<PackageRow> = {
    type: 'local',
    key: 'startflow.nba.customer.packages',
    items: () => this.packageRows(),
    columns: [
      { field: 'product_label', title: 'Sản phẩm', type: 'string', width: '130px' },
      {
        field: 'package',
        title: 'Gói',
        type: 'string',
        minWidth: '190px',
        cell: { truncate: { enable: true, type: 'tooltip' } },
      },
      {
        field: 'eligible',
        title: 'Kết quả',
        type: 'string',
        width: '130px',
        useBadge: (value) => ({
          type: 'round',
          color: value ? 'success' : 'error',
          title: value ? 'Phù hợp' : 'Không phù hợp',
        }),
      },
      {
        field: 'criteria_summary',
        title: 'Tiêu chí đạt',
        type: 'string',
        width: '120px',
        align: 'right',
      },
      {
        field: 'multiplier',
        title: 'Hệ số',
        type: 'number',
        width: '100px',
        align: 'right',
        transform: (value) => `×${Number(value).toFixed(2)}`,
      },
      {
        field: 'blocked_summary',
        title: 'Chặn bởi',
        type: 'string',
        minWidth: '170px',
        cell: { truncate: { enable: true, type: 'tooltip' } },
      },
    ],
    paginate: { hidden: true },
    style: { shadow: false },
  };

  readonly versionTable: SdTableOption<NbaRecommendationVersion> = {
    type: 'local',
    key: 'startflow.nba.customer.versions',
    items: () => this.customer()?.versions ?? [],
    columns: [
      {
        field: 'version',
        title: 'Phiên bản',
        type: 'number',
        width: '110px',
        transform: (value) => `v${value}`,
      },
      { field: 'source', title: 'Nguồn', type: 'string', width: '130px' },
      {
        field: 'created_at',
        title: 'Thời điểm tạo',
        type: 'string',
        minWidth: '170px',
        transform: (value) => formatDateTime(String(value)),
      },
    ],
    paginate: { hidden: true },
    style: { shadow: false },
  };

  readonly noteTable: SdTableOption<NbaCallNote> = {
    type: 'local',
    key: 'startflow.nba.customer.notes',
    items: () => this.notes(),
    columns: [
      {
        field: 'created_at',
        title: 'Thời điểm',
        type: 'string',
        width: '170px',
        transform: (value) => formatDateTime(String(value)),
      },
      { field: 'sale_name', title: 'Người ghi', type: 'string', width: '150px' },
      {
        field: 'note_text',
        title: 'Nội dung',
        type: 'string',
        minWidth: '280px',
        cell: { truncate: { enable: true, type: 'tooltip' } },
      },
    ],
    paginate: { pageSize: 10, pages: [10, 20, 50] },
    style: { shadow: false },
  };

  readonly formatCurrency = formatCurrency;
  readonly formatPercent = formatPercent;
  readonly formatDateTime = formatDateTime;

  constructor() {
    effect(() => {
      const id = this.#resolvedCustomerId();
      if (!id) return;
      void this.load(id);
    });
  }

  async load(rawCustomerId = this.#resolvedCustomerId()): Promise<void> {
    const id = Number(rawCustomerId);
    this.loading.set(true);
    this.loadError.set(null);
    if (!Number.isInteger(id) || id < 1) {
      this.loadError.set('Mã khách hàng không hợp lệ.');
      this.loading.set(false);
      return;
    }

    try {
      const customer = await this.#api.getCustomer(id);
      const [assessment, notes, audit] = await Promise.all([
        this.#api.getAssessment(id),
        this.#api.getNotes(id),
        customer.recommendation
          ? this.#api.getRecommendationAudit(customer.recommendation.id)
          : Promise.resolve(null),
      ]);
      this.customer.set(customer);
      this.assessment.set(assessment);
      this.notes.set(notes);
      this.audit.set(audit);
      this.feedbackProduct.set(customer.recommendation?.product_rank1 ?? null);
      this.#tab?.tabInfoChanges.next({
        name: customer.full_name,
        icon: 'person_search',
        tooltip: `Khách hàng ${customer.cif_code}`,
        color: 'primary',
      });
    } catch {
      this.customer.set(null);
      this.assessment.set(null);
      this.notes.set([]);
      this.audit.set(null);
      this.loadError.set('Không tìm thấy khách hàng hoặc bạn không có quyền truy cập.');
    } finally {
      this.loading.set(false);
    }
  }

  #resolvedCustomerId(): string | null | undefined {
    return this.customerId() ?? this.#route?.snapshot.paramMap.get('customerId');
  }

  setFeedbackStatus(value: unknown): void {
    if (
      typeof value === 'string' &&
      this.feedbackStatusOptions.some((item) => item.value === value)
    ) {
      this.feedbackStatus.set(value as NbaFeedbackStatus);
      if (value !== 'rejected') this.rejectReason.set('');
    }
  }

  setFeedbackProduct(value: unknown): void {
    if (typeof value === 'string' && value in PRODUCT_LABELS) {
      this.feedbackProduct.set(value as NbaProduct);
    }
  }

  async submitFeedback(): Promise<void> {
    if (this.submittingFeedback()) return;
    const recommendation = this.customer()?.recommendation;
    const product = this.feedbackProduct();
    if (!recommendation || !product) {
      this.#notify.error('Khách hàng chưa có đề xuất để ghi feedback.');
      return;
    }

    const rejectReason = this.rejectReason().trim();
    if (this.feedbackStatus() === 'rejected' && !rejectReason) {
      this.#notify.error('Vui lòng nhập lý do từ chối.');
      return;
    }

    const payload: NbaFeedbackInput = {
      rec_id: recommendation.id,
      product,
      status: this.feedbackStatus(),
    };
    if (rejectReason) payload.reject_reason = rejectReason;
    const note = this.feedbackNote().trim();
    if (note) payload.note = note;

    this.submittingFeedback.set(true);
    try {
      await this.#api.submitFeedback(payload);
      this.#notify.success('Đã ghi nhận kết quả tư vấn.');
      this.feedbackNote.set('');
      this.rejectReason.set('');
      const [assessment, audit] = await Promise.all([
        this.#api.getAssessment(this.customer()!.customer_id),
        this.#api.getRecommendationAudit(recommendation.id),
      ]);
      this.assessment.set(assessment);
      this.audit.set(audit);
      this.reloadTables();
    } catch {
      this.#notify.error('Không ghi được kết quả tư vấn. Vui lòng thử lại.');
    } finally {
      this.submittingFeedback.set(false);
    }
  }

  async saveNote(): Promise<void> {
    if (this.savingNote()) return;
    const note = this.noteText().trim();
    if (!note) {
      this.#notify.error('Vui lòng nhập nội dung ghi chú.');
      return;
    }

    const id = this.customer()?.customer_id;
    if (!id) return;
    this.savingNote.set(true);
    try {
      await this.#api.saveNote(id, note);
      this.noteText.set('');
      this.notes.set(await this.#api.getNotes(id));
      this.#notify.success('Đã lưu ghi chú cuộc gọi.');
      this.reloadTables();
    } catch {
      this.#notify.error('Không lưu được ghi chú. Vui lòng thử lại.');
    } finally {
      this.savingNote.set(false);
    }
  }

  updateRejectReason(value: unknown): void {
    this.rejectReason.set(typeof value === 'string' ? value : '');
  }

  updateFeedbackNote(value: unknown): void {
    this.feedbackNote.set(typeof value === 'string' ? value : '');
  }

  updateNoteText(value: unknown): void {
    this.noteText.set(typeof value === 'string' ? value : '');
  }

  auditValue(field: string): string {
    const value = this.audit()?.[field];
    if (value === null || value === undefined || value === '') return '—';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  private reloadTables(): void {
    queueMicrotask(() => {
      for (const table of this.tables()) void table.reload(true, false);
    });
  }
}

function productLabel(product: NbaProduct): string {
  return PRODUCT_LABELS[product];
}

function stalenessLabel(field: string): string {
  const labels: Record<string, string> = {
    casa_avg: 'số dư CASA',
    total_debt: 'tổng dư nợ',
    product_flags: 'sản phẩm đang sở hữu',
  };
  return labels[field] ?? field;
}
