import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { SdBadge } from '@sdcorejs/angular/components/badge';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SD_TAB, SdTabComponent } from '@sdcorejs/angular/components/tab-router';
import { SdTable, type SdTableOption } from '@sdcorejs/angular/components/table';
import { SdView } from '@sdcorejs/angular/components/view';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import { SdPermissionDirective, SdPermissionService } from '@sdcorejs/angular/modules/permission';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import type { CaseDetail, RunSummary } from '../../../core/api/models';
import { StartFlowApiService } from '../../../core/api/startflow-api.service';
import { STARTFLOW_PERMISSIONS } from '../../../core/auth/permission-map';
import { formatCurrency, formatDateTime } from '../../../shared/formatters';
import { EmptyStateComponent } from '../../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state.component';
import { statusPresentation } from '../../../shared/status-presentation';

interface SnapshotFieldViewModel {
  key: string;
  label: string;
  display: string;
}

@Component({
  selector: 'app-case-detail',
  imports: [
    SdBadge,
    SdButton,
    SdInform,
    SdSection,
    SdTable,
    SdView,
    SdPageComponent,
    SdPermissionDirective,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './case-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@SdTabComponent({
  component: CaseDetailComponent,
  name: ({ params }) => `Hồ sơ #${params['caseId'] ?? '—'}`,
  icon: 'folder_open',
  color: 'primary',
})
export class CaseDetailComponent {
  readonly #api = inject(StartFlowApiService);
  readonly #router = inject(Router);
  readonly #notify = inject(SdNotifyService);
  readonly #permission = inject(SdPermissionService);
  readonly #tab = inject(SD_TAB, { optional: true });

  readonly caseId = input.required<string>();
  readonly data = signal<CaseDetail | null>(null);
  readonly loading = signal(true);
  readonly starting = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly permissions = STARTFLOW_PERMISSIONS;
  readonly canStart = this.#permission.hasPermission(STARTFLOW_PERMISSIONS.runStart);

  readonly header = computed(() => {
    const item = this.data();
    return item
      ? {
          title: item.companyName,
          description: `${formatCurrency(item.requestedAmount)} · ${item.purpose}`,
          registrationNumber: item.registrationNumber,
          createdAt: formatDateTime(item.createdAt),
        }
      : {
          title: 'Chi tiết hồ sơ tín dụng',
          description: 'Đang tải ảnh chụp hồ sơ demo.',
          registrationNumber: '—',
          createdAt: '—',
        };
  });

  readonly financialSnapshot = computed<SnapshotFieldViewModel[]>(() => {
    const financials = this.data()?.financials;
    if (!financials) return [];
    return [
      { key: 'revenue', label: 'Doanh thu', display: formatCurrency(financials.revenue) },
      { key: 'ebitda', label: 'EBITDA', display: formatCurrency(financials.ebitda) },
      { key: 'totalDebt', label: 'Tổng nợ', display: formatCurrency(financials.totalDebt) },
      { key: 'equity', label: 'Vốn chủ sở hữu', display: formatCurrency(financials.equity) },
      {
        key: 'currentAssets',
        label: 'Tài sản ngắn hạn',
        display: formatCurrency(financials.currentAssets),
      },
      {
        key: 'currentLiabilities',
        label: 'Nợ ngắn hạn',
        display: formatCurrency(financials.currentLiabilities),
      },
    ];
  });

  readonly runHistoryTable: SdTableOption<RunSummary> = {
    type: 'local',
    key: 'startflow.cases.detail.run-history',
    items: () => this.data()?.runs ?? [],
    columns: [
      {
        field: 'id',
        title: 'Lượt chạy',
        type: 'string',
        minWidth: '180px',
        cell: { copiable: true },
        transform: (value) => `#${String(value).slice(0, 8)}`,
      },
      {
        field: 'status',
        title: 'Trạng thái',
        type: 'string',
        width: '180px',
        useBadge: (value) => {
          const presentation = statusPresentation(String(value));
          return { type: 'round', color: presentation.color, title: presentation.label };
        },
      },
      {
        field: 'finalDecisionStatus',
        title: 'Kết luận',
        type: 'string',
        width: '190px',
        useBadge: (value) => {
          if (!value) return { type: 'round', color: 'secondary', title: 'Chưa có kết luận' };
          const presentation = statusPresentation(String(value));
          return { type: 'round', color: presentation.color, title: presentation.label };
        },
      },
      {
        field: 'createdAt',
        title: 'Khởi tạo',
        type: 'string',
        width: '160px',
        transform: (value) => formatDateTime(String(value)),
      },
      {
        field: 'completedAt',
        title: 'Hoàn tất',
        type: 'string',
        width: '160px',
        transform: (value) => (value ? formatDateTime(String(value)) : '—'),
      },
    ],
    command: {
      align: 'right',
      commands: [
        {
          icon: 'arrow_forward',
          title: 'Mở lượt đánh giá',
          click: (row) => this.openRun(row),
        },
      ],
    },
    index: { enabled: true, title: 'STT', width: '64px' },
    paginate: { hidden: true },
    style: { shadow: false },
  };

  constructor() {
    effect(() => {
      const currentCaseId = this.caseId();
      void this.load(currentCaseId);
    });
  }

  async load(currentCaseId = this.caseId()): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);
    try {
      const item = await this.#api.getCase(currentCaseId);
      this.data.set(item);
      this.#tab?.tabInfoChanges.next({
        name: item.companyName,
        icon: 'folder_open',
        tooltip: `Hồ sơ ${item.registrationNumber}`,
        color: 'primary',
      });
    } catch {
      this.data.set(null);
      this.loadError.set('Không tìm thấy hồ sơ hoặc bạn không có quyền truy cập.');
    } finally {
      this.loading.set(false);
    }
  }

  async startRun(): Promise<void> {
    if (!this.canStart) {
      this.#notify.error('Bạn không có quyền bắt đầu lượt đánh giá cho hồ sơ này.');
      return;
    }
    if (this.starting()) return;
    this.starting.set(true);
    this.actionError.set(null);
    try {
      const result = await this.#api.createRun(this.caseId());
      this.#notify.info('Đã khởi tạo lượt đánh giá đa tác nhân.');
      await this.#router.navigate(['/runs', result.runId]);
    } catch {
      const message =
        'Không thể bắt đầu đánh giá. Vui lòng kiểm tra trạng thái backend và thử lại.';
      this.actionError.set(message);
      this.#notify.error(message);
    } finally {
      this.starting.set(false);
    }
  }

  openRun(run: RunSummary): void {
    void this.#router.navigate(['/runs', run.id]);
  }
}
