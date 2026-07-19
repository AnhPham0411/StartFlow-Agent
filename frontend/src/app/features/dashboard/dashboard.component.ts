import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SdBadge } from '@sdcorejs/angular/components/badge';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdTable, type SdTableOption } from '@sdcorejs/angular/components/table';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import type { CaseSummary, RunSummary } from '../../core/api/models';
import { formatDateTime } from '../../shared/formatters';
import { EmptyStateComponent } from '../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../shared/states/loading-state.component';
import { statusPresentation } from '../../shared/status-presentation';

type RecentRunRow = RunSummary & Pick<CaseSummary, 'companyName' | 'registrationNumber'>;

interface DashboardMetrics {
  cases: number;
  active: number;
  approvals: number;
  completed: number;
}

interface NextActionViewModel {
  id: string;
  runId: string | null;
  companyName: string;
  registrationNumber: string;
  formattedDate: string;
  actionLabel: string;
  status: ReturnType<typeof statusPresentation> | null;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    SdBadge,
    SdButton,
    SdSection,
    SdTable,
    SdPageComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  readonly #api = inject(StartFlowApiService);
  readonly #router = inject(Router);

  readonly cases = signal<CaseSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly metrics = computed<DashboardMetrics>(() => {
    const runs = this.cases().flatMap((item) => (item.latestRun ? [item.latestRun] : []));
    return {
      cases: this.cases().length,
      active: runs.filter((run) => ['PENDING', 'PLANNING', 'RUNNING'].includes(run.status)).length,
      approvals: runs.filter((run) => run.status === 'AWAITING_APPROVAL').length,
      completed: runs.filter((run) => ['COMPLETED', 'PARTIAL'].includes(run.status)).length,
    };
  });

  readonly recentRuns = computed<RecentRunRow[]>(() =>
    this.cases()
      .flatMap((item) =>
        item.latestRun
          ? [
              {
                ...item.latestRun,
                companyName: item.companyName,
                registrationNumber: item.registrationNumber,
              },
            ]
          : [],
      )
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 6),
  );

  readonly nextActions = computed<NextActionViewModel[]>(() =>
    [...this.cases()]
      .sort((left, right) => actionPriority(left) - actionPriority(right))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        runId: item.latestRun?.id ?? null,
        companyName: item.companyName,
        registrationNumber: item.registrationNumber,
        formattedDate: formatDateTime(item.createdAt),
        actionLabel: nextActionLabel(item),
        status: item.latestRun ? statusPresentation(item.latestRun.status) : null,
      })),
  );

  readonly recentRunsTable: SdTableOption<RecentRunRow> = {
    type: 'local',
    key: 'startflow.dashboard.recent-runs',
    items: () => this.recentRuns(),
    columns: [
      {
        field: 'companyName',
        title: 'Doanh nghiệp',
        type: 'string',
        minWidth: '220px',
        cell: { truncate: { enable: true, type: 'tooltip' } },
      },
      {
        field: 'status',
        title: 'Trạng thái',
        type: 'string',
        width: '170px',
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
        transform: (value) => (value ? String(value) : '—'),
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
    ],
    command: {
      align: 'right',
      commands: [
        {
          icon: 'arrow_forward',
          title: 'Mở lượt đánh giá',
          click: (row) => void this.#router.navigate(['/runs', row.id]),
        },
      ],
    },
    paginate: { hidden: true },
    style: { shadow: false },
  };

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.cases.set(await this.#api.listCases());
    } catch {
      this.error.set('Không thể tổng hợp dữ liệu vận hành. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  createCase(): void {
    void this.#router.navigate(['/cases/new']);
  }

  openCases(): void {
    void this.#router.navigate(['/cases']);
  }

  openNbaDemo(): void {
    void this.#router.navigate(['/nba/operations']);
  }

  openNextAction(item: NextActionViewModel): void {
    void this.#router.navigate(item.runId ? ['/runs', item.runId] : ['/cases', item.id]);
  }
}

function nextActionLabel(item: CaseSummary): string {
  switch (item.latestRun?.status) {
    case 'AWAITING_APPROVAL':
      return 'Xem yêu cầu phê duyệt';
    case 'PENDING':
    case 'PLANNING':
    case 'RUNNING':
      return 'Theo dõi đánh giá';
    default:
      return item.latestRun ? 'Xem kết quả' : 'Bắt đầu đánh giá';
  }
}

function actionPriority(item: CaseSummary): number {
  switch (item.latestRun?.status) {
    case 'AWAITING_APPROVAL':
      return 0;
    case 'PENDING':
    case 'PLANNING':
    case 'RUNNING':
      return 1;
    default:
      return item.latestRun ? 3 : 2;
  }
}
