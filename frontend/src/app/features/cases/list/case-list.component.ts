import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdTabComponent } from '@sdcorejs/angular/components/tab-router';
import { SdTable, type SdTableOption } from '@sdcorejs/angular/components/table';
import { SdInput } from '@sdcorejs/angular/forms/input';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import type { CaseSummary } from '../../../core/api/models';
import { StartFlowApiService } from '../../../core/api/startflow-api.service';
import { CoreFormAccessibilityDirective } from '../../../shared/a11y/core-form-accessibility.directive';
import { formatCurrency, formatDateTime } from '../../../shared/formatters';
import { EmptyStateComponent } from '../../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state.component';
import { statusPresentation } from '../../../shared/status-presentation';

type CaseListRow = CaseSummary & { latestStatus: string };

@Component({
  selector: 'app-case-list',
  imports: [
    SdButton,
    SdInput,
    CoreFormAccessibilityDirective,
    SdSection,
    SdTable,
    SdPageComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './case-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@SdTabComponent({
  component: CaseListComponent,
  name: 'Hồ sơ tín dụng',
  icon: 'folder_open',
  color: 'primary',
})
export class CaseListComponent {
  readonly #api = inject(StartFlowApiService);
  readonly #router = inject(Router);
  readonly table = viewChild<SdTable<CaseListRow>>(SdTable);

  readonly cases = signal<CaseSummary[]>([]);
  readonly query = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly filteredCases = computed<CaseListRow[]>(() => {
    const normalizedQuery = this.query().trim().toLocaleLowerCase('vi');
    return this.cases()
      .filter((item) =>
        normalizedQuery
          ? `${item.companyName} ${item.registrationNumber}`
              .toLocaleLowerCase('vi')
              .includes(normalizedQuery)
          : true,
      )
      .map((item) => ({
        ...item,
        latestStatus: item.latestRun?.status ?? 'NOT_STARTED',
      }));
  });

  readonly emptyState = computed(() =>
    this.cases().length
      ? {
          title: 'Không tìm thấy hồ sơ phù hợp',
          description: 'Thử một tên doanh nghiệp hoặc mã đăng ký khác.',
          actionLabel: 'Xóa tìm kiếm',
        }
      : {
          title: 'Chưa có hồ sơ',
          description: 'Tạo hồ sơ demo để bắt đầu luồng đánh giá.',
          actionLabel: 'Tạo hồ sơ demo',
        },
  );

  readonly tableOption: SdTableOption<CaseListRow> = {
    type: 'local',
    key: 'startflow.cases.list',
    items: () => this.filteredCases(),
    columns: [
      {
        field: 'companyName',
        title: 'Doanh nghiệp',
        type: 'string',
        minWidth: '240px',
        sortable: true,
        cell: { copiable: true, truncate: { enable: true, type: 'tooltip' } },
        click: (_, row) => this.openCase(row),
      },
      {
        field: 'registrationNumber',
        title: 'Mã đăng ký',
        type: 'string',
        width: '160px',
        sortable: true,
        cell: { copiable: true },
      },
      {
        field: 'requestedAmount',
        title: 'Số tiền đề nghị',
        type: 'number',
        width: '180px',
        align: 'right',
        transform: (value) => formatCurrency(Number(value)),
      },
      {
        field: 'latestStatus',
        title: 'Trạng thái',
        type: 'string',
        width: '180px',
        useBadge: (value) => {
          if (value === 'NOT_STARTED') {
            return { type: 'round', color: 'secondary', title: 'Chưa đánh giá' };
          }
          const presentation = statusPresentation(String(value));
          return { type: 'round', color: presentation.color, title: presentation.label };
        },
      },
      {
        field: 'runCount',
        title: 'Số lượt chạy',
        type: 'number',
        width: '120px',
        align: 'right',
      },
      {
        field: 'createdAt',
        title: 'Ngày tạo',
        type: 'string',
        width: '160px',
        transform: (value) => formatDateTime(String(value)),
      },
    ],
    command: {
      align: 'right',
      commands: [
        {
          icon: 'visibility',
          title: 'Xem hồ sơ',
          click: (row) => this.openCase(row),
        },
      ],
    },
    index: { enabled: true, title: 'STT', width: '64px' },
    paginate: { pageSize: 20, pages: [10, 20, 50] },
    sort: { enable: true },
    reload: { visible: true, onReload: () => this.refreshFromTable() },
    config: { visible: true, resizable: true },
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
      this.error.set('Không tải được danh sách hồ sơ. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  async refreshFromTable(): Promise<void> {
    this.error.set(null);
    try {
      this.cases.set(await this.#api.listCases());
    } catch {
      this.error.set('Không tải được danh sách hồ sơ. Vui lòng kiểm tra kết nối và thử lại.');
    }
  }

  updateQuery(value: unknown): void {
    this.query.set(typeof value === 'string' ? value : '');
    queueMicrotask(() => void this.table()?.reload(true, false));
  }

  resetQuery(): void {
    this.updateQuery('');
  }

  handleEmptyAction(): void {
    if (this.cases().length) this.resetQuery();
    else this.createCase();
  }

  createCase(): void {
    void this.#router.navigate(['/cases/new']);
  }

  openCase(item: CaseSummary): void {
    void this.#router.navigate(['/cases', item.id]);
  }
}
