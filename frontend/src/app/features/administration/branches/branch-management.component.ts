import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdModal } from '@sdcorejs/angular/components/modal';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdTabComponent } from '@sdcorejs/angular/components/tab-router';
import { SdTable, type SdTableOption } from '@sdcorejs/angular/components/table';
import { SdInput } from '@sdcorejs/angular/forms/input';
import { SdSelect } from '@sdcorejs/angular/forms/select';
import { SdSwitch } from '@sdcorejs/angular/forms/switch';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import { SdPermissionService } from '@sdcorejs/angular/modules/permission';
import { SdConfirmService } from '@sdcorejs/angular/services/confirm';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import type { Branch } from '@startflow/contracts';
import { AdminApiService } from '../../../core/api/admin-api.service';
import { STARTFLOW_PERMISSIONS } from '../../../core/auth/permission-map';
import { EmptyStateComponent } from '../../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state.component';

type ActiveFilter = '' | 'true' | 'false';

interface BranchDraft {
  id: number | null;
  code: string;
  name: string;
  active: boolean;
}

const ACTIVE_OPTIONS: Array<{ value: ActiveFilter; label: string }> = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'true', label: 'Đang hoạt động' },
  { value: 'false', label: 'Đã ngừng' },
];

@Component({
  selector: 'app-branch-management',
  imports: [
    ReactiveFormsModule,
    SdButton,
    SdInform,
    SdInput,
    SdModal,
    SdPageComponent,
    SdSection,
    SdSelect,
    SdSwitch,
    SdTable,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './branch-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@SdTabComponent({
  component: BranchManagementComponent,
  name: 'Quản lý chi nhánh',
  icon: 'account_tree',
  color: 'primary',
})
export class BranchManagementComponent {
  readonly #api = inject(AdminApiService);
  readonly #confirm = inject(SdConfirmService);
  readonly #notify = inject(SdNotifyService);
  readonly #permission = inject(SdPermissionService);
  readonly table = viewChild<SdTable<Branch>>(SdTable);
  readonly editorModal = viewChild<SdModal>('editorModal');

  readonly branches = signal<Branch[]>([]);
  readonly canManage = this.#permission.hasPermission(STARTFLOW_PERMISSIONS.branchManage);
  readonly query = signal('');
  readonly activeFilter = signal<ActiveFilter>('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editingBranchId = signal<number | null>(null);
  readonly editingBranchCode = signal('');
  readonly activeOptions = ACTIVE_OPTIONS;
  readonly editorTitle = computed(() =>
    this.editingBranchId() === null ? 'Thêm chi nhánh' : `Cập nhật ${this.editingBranchCode()}`,
  );
  readonly isEditing = computed(() => this.editingBranchId() !== null);

  readonly form = new FormGroup({});
  draft: BranchDraft = emptyBranchDraft();

  readonly tableOption: SdTableOption<Branch> = {
    type: 'local',
    key: 'startflow.administration.branches',
    items: () => this.branches(),
    columns: [
      {
        field: 'code',
        title: 'Mã chi nhánh',
        type: 'string',
        width: '160px',
        fixed: true,
        sortable: true,
        cell: { copiable: true },
      },
      {
        field: 'name',
        title: 'Tên chi nhánh',
        type: 'string',
        minWidth: '260px',
        sortable: true,
        cell: { truncate: { enable: true, type: 'tooltip' } },
      },
      {
        field: 'account_count',
        title: 'Số tài khoản',
        type: 'number',
        width: '140px',
        align: 'right',
        sortable: true,
      },
      {
        field: 'active',
        title: 'Trạng thái',
        type: 'boolean',
        width: '150px',
        useBadge: (value) => ({
          type: 'round',
          color: value ? 'success' : 'secondary',
          title: value ? 'Hoạt động' : 'Đã ngừng',
        }),
      },
    ],
    command: {
      align: 'right',
      commands: [
        {
          icon: 'edit',
          title: 'Chỉnh sửa',
          color: 'primary',
          hidden: !this.canManage,
          click: (row) => this.startEdit(row),
        },
        {
          icon: 'block',
          title: 'Ngừng hoạt động',
          color: 'error',
          hidden: (row) => !this.canManage || !row.active,
          click: (row) => void this.deactivate(row),
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
      const active = this.activeFilter() === '' ? undefined : this.activeFilter() === 'true';
      this.branches.set(await this.#api.listBranches({ q: this.query(), active }));
      queueMicrotask(() => void this.table()?.reload(true, false));
    } catch {
      this.error.set('Không tải được danh sách chi nhánh. Vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  updateQuery(value: unknown): void {
    this.query.set(typeof value === 'string' ? value : '');
  }

  updateActiveFilter(value: unknown): void {
    this.activeFilter.set(value === 'true' || value === 'false' ? value : '');
  }

  startCreate(): void {
    this.draft = emptyBranchDraft();
    this.editingBranchId.set(null);
    this.editingBranchCode.set('');
    this.form.reset();
    this.editorModal()?.open();
  }

  startEdit(branch: Branch): void {
    this.draft = {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      active: branch.active,
    };
    this.editingBranchId.set(branch.id);
    this.editingBranchCode.set(branch.code);
    this.form.reset();
    this.editorModal()?.open();
  }

  closeEditor(): void {
    this.editorModal()?.close();
  }

  async save(): Promise<void> {
    const code = this.draft.code.trim().toUpperCase();
    const name = this.draft.name.trim();
    if (!code || !name || !/^[A-Z0-9-]+$/.test(code)) {
      this.form.markAllAsTouched();
      this.#notify.warning('Vui lòng nhập đúng mã và tên chi nhánh.');
      return;
    }

    this.saving.set(true);
    try {
      if (this.draft.id === null) {
        await this.#api.createBranch({ code, name });
        this.#notify.success('Đã tạo chi nhánh mới.');
      } else {
        await this.#api.updateBranch(this.draft.id, { name, active: this.draft.active });
        this.#notify.success('Đã cập nhật chi nhánh.');
      }
      this.closeEditor();
      await this.load();
    } catch (error) {
      this.#notify.error(error instanceof Error ? error.message : 'Không lưu được chi nhánh.');
    } finally {
      this.saving.set(false);
    }
  }

  async deactivate(branch: Branch): Promise<void> {
    try {
      await this.#confirm.confirm(
        `Ngừng hoạt động chi nhánh ${branch.code}? Chi nhánh có tài khoản đang hoạt động sẽ không thể ngừng.`,
        {
          title: 'Xác nhận ngừng chi nhánh',
          yesTitle: 'Ngừng hoạt động',
          yesButtonColor: 'error',
        },
      );
    } catch {
      return;
    }

    try {
      await this.#api.deactivateBranch(branch.id);
      this.#notify.success('Đã ngừng hoạt động chi nhánh.');
      await this.load();
    } catch (error) {
      this.#notify.error(error instanceof Error ? error.message : 'Không thể ngừng chi nhánh.');
    }
  }
}

function emptyBranchDraft(): BranchDraft {
  return { id: null, code: '', name: '', active: true };
}
