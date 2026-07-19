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
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdTabComponent } from '@sdcorejs/angular/components/tab-router';
import { SdTable, type SdTableOption } from '@sdcorejs/angular/components/table';
import { SdInput } from '@sdcorejs/angular/forms/input';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import type { CustomerListItem, NbaProduct } from '@startflow/contracts';
import { NbaApiService } from '../../core/api/nba-api.service';
import { EmptyStateComponent } from '../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../shared/states/loading-state.component';

const PRODUCT_LABELS: Record<NbaProduct, string> = {
  the: 'Thẻ',
  vay: 'Vay',
  dautu: 'Đầu tư',
  baohiem: 'Bảo hiểm',
  taikhoan: 'Tài khoản',
};

@Component({
  selector: 'app-customer-list',
  imports: [
    SdButton,
    SdInform,
    SdInput,
    SdPageComponent,
    SdSection,
    SdTable,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './customer-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@SdTabComponent({
  component: CustomerListComponent,
  name: 'Khách hàng',
  icon: 'groups',
  color: 'primary',
})
export class CustomerListComponent {
  readonly #api = inject(NbaApiService);
  readonly #router = inject(Router);
  readonly table = viewChild<SdTable<CustomerListItem>>(SdTable);

  readonly customers = signal<CustomerListItem[]>([]);
  readonly query = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly emptyState = computed(() =>
    this.query().trim()
      ? {
          title: 'Không tìm thấy khách hàng phù hợp',
          description: 'Thử tìm theo tên hoặc mã CIF khác.',
        }
      : {
          title: 'Chưa có khách hàng trong phạm vi phụ trách',
          description: 'Danh sách sẽ hiển thị khi dữ liệu được phân công cho tài khoản của bạn.',
        },
  );

  readonly tableOption: SdTableOption<CustomerListItem> = {
    type: 'local',
    key: 'startflow.customers.list',
    items: () => this.customers(),
    columns: [
      {
        field: 'full_name',
        title: 'Khách hàng',
        type: 'string',
        minWidth: '240px',
        fixed: true,
        sortable: true,
        cell: { copiable: true, truncate: { enable: true, type: 'tooltip' } },
        click: (_, row) => this.openCustomer(row),
      },
      {
        field: 'cif_code',
        title: 'CIF',
        type: 'string',
        width: '160px',
        sortable: true,
        cell: { copiable: true },
      },
      {
        field: 'product_rank1',
        title: 'Đề xuất ưu tiên',
        type: 'string',
        width: '180px',
        useBadge: (value) => ({
          type: 'round',
          color: value ? 'primary' : 'secondary',
          title:
            typeof value === 'string' && value in PRODUCT_LABELS
              ? PRODUCT_LABELS[value as NbaProduct]
              : 'Chưa có đề xuất',
        }),
      },
      {
        field: 'last_list_date',
        title: 'Ngày call list gần nhất',
        type: 'date',
        width: '190px',
        sortable: true,
      },
    ],
    command: {
      align: 'right',
      commands: [
        {
          icon: 'visibility',
          title: 'Xem Customer 360',
          click: (row) => this.openCustomer(row),
        },
      ],
    },
    index: { enabled: true, title: 'STT', width: '64px' },
    paginate: { pageSize: 20, pages: [10, 20, 50, 100] },
    sort: { enable: true },
    config: { visible: true, resizable: true },
    style: { shadow: false },
  };

  constructor() {
    void this.search();
  }

  async search(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.customers.set(await this.#api.searchCustomers(this.query(), 500));
      queueMicrotask(() => void this.table()?.reload(true, false));
    } catch {
      this.error.set(
        'Không tải được danh sách khách hàng. Vui lòng kiểm tra kết nối và thử lại.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  updateQuery(value: unknown): void {
    this.query.set(typeof value === 'string' ? value : '');
  }

  clearSearch(): void {
    this.query.set('');
    void this.search();
  }

  openCustomer(customer: CustomerListItem): void {
    void this.#router.navigate(['/customers', customer.customer_id]);
  }
}
