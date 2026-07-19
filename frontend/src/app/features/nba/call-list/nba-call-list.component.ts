import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdTabComponent } from '@sdcorejs/angular/components/tab-router';
import { SdTable, type SdTableOption } from '@sdcorejs/angular/components/table';
import { SdDate } from '@sdcorejs/angular/forms/date';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import { NbaApiService } from '../../../core/api/nba-api.service';
import type { NbaCallListEntry, NbaProduct } from '../../../core/api/nba.models';
import { EmptyStateComponent } from '../../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state.component';

const PRODUCT_LABELS: Record<NbaProduct, string> = {
  the: 'Thẻ',
  vay: 'Vay',
  dautu: 'Đầu tư',
  baohiem: 'Bảo hiểm',
  taikhoan: 'Tài khoản',
};

@Component({
  selector: 'app-nba-call-list',
  imports: [
    SdButton,
    SdDate,
    SdInform,
    SdSection,
    SdTable,
    SdPageComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './nba-call-list.component.html',
  styleUrl: './nba-call-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@SdTabComponent({
  component: NbaCallListComponent,
  name: 'Danh sách gọi NBA',
  icon: 'support_agent',
  color: 'primary',
})
export class NbaCallListComponent {
  readonly #api = inject(NbaApiService);
  readonly #router = inject(Router);
  readonly selectedDate = signal(todayInVietnam());
  readonly items = signal<NbaCallListEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly tableOption: SdTableOption<NbaCallListEntry> = {
    type: 'local',
    key: 'startflow.nba.call-list',
    items: () => this.items(),
    columns: [
      {
        field: 'name',
        title: 'Khách hàng',
        type: 'string',
        minWidth: '220px',
        fixed: true,
        sortable: true,
        cell: { copiable: true, truncate: { enable: true, type: 'tooltip' } },
        click: (_, row) => this.openCustomer(row),
      },
      {
        field: 'cif_code',
        title: 'CIF',
        type: 'string',
        width: '140px',
        sortable: true,
        cell: { copiable: true },
      },
      {
        field: 'product_rank1',
        title: 'Ưu tiên 1',
        type: 'string',
        width: '140px',
        useBadge: (value) => ({
          type: 'round',
          color: 'primary',
          title: productLabel(value),
        }),
      },
      {
        field: 'score_rank1',
        title: 'Điểm 1',
        type: 'string',
        width: '96px',
        align: 'right',
        transform: (value) => formatScore(value),
      },
      {
        field: 'product_rank2',
        title: 'Ưu tiên 2',
        type: 'string',
        width: '140px',
        useBadge: (value) => ({
          type: 'round',
          color: 'secondary',
          title: productLabel(value),
        }),
      },
      {
        field: 'score_rank2',
        title: 'Điểm 2',
        type: 'string',
        width: '96px',
        align: 'right',
        transform: (value) => formatScore(value),
      },
      {
        field: 'rec_version',
        title: 'Phiên bản',
        type: 'number',
        width: '100px',
        align: 'right',
        transform: (value) => (value === null || value === undefined ? '—' : `v${value}`),
      },
    ],
    command: {
      align: 'right',
      commands: [
        {
          icon: 'visibility',
          title: 'Mở khách hàng',
          click: (row) => this.openCustomer(row),
        },
      ],
    },
    index: { enabled: true, title: 'STT', width: '64px' },
    paginate: { pageSize: 20, pages: [10, 20, 50] },
    sort: { enable: true },
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
      this.items.set(await this.#api.getCallList(toApiDate(this.selectedDate())));
    } catch {
      this.error.set('Không tải được danh sách gọi. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  async changeDate(value: unknown): Promise<void> {
    if (typeof value !== 'string' || !value.trim()) return;
    this.selectedDate.set(value);
    await this.load();
  }

  openCustomer(item: NbaCallListEntry): void {
    void this.#router.navigate(['/nba/customers', item.customer_id]);
  }
}

function productLabel(value: unknown): string {
  return typeof value === 'string' && value in PRODUCT_LABELS
    ? PRODUCT_LABELS[value as NbaProduct]
    : 'Chưa có';
}

function formatScore(value: unknown): string {
  const score = Number(value);
  return Number.isFinite(score) ? `${Math.round(score * 100)}%` : '—';
}

function toApiDate(value: string): string {
  return value.replaceAll('/', '-');
}

function todayInVietnam(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
