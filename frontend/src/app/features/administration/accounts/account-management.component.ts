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
import { SdRadio } from '@sdcorejs/angular/forms/radio';
import { SdSelect } from '@sdcorejs/angular/forms/select';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import { SdPermissionService } from '@sdcorejs/angular/modules/permission';
import { SdConfirmService } from '@sdcorejs/angular/services/confirm';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import type { Account, Branch, UserRole } from '@startflow/contracts';
import { AdminApiService } from '../../../core/api/admin-api.service';
import { STARTFLOW_PERMISSIONS } from '../../../core/auth/permission-map';
import { EmptyStateComponent } from '../../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state.component';

type ActiveFilter = '' | 'true' | 'false';
type RoleFilter = '' | UserRole;

interface AccountDraft {
  id: number | null;
  username: string;
  full_name: string;
  role: UserRole;
  branch_id: number | null;
}

type AccountRow = Account & { branch_name: string };

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];

const ROLE_FILTER_OPTIONS: Array<{ value: RoleFilter; label: string }> = [
  { value: '', label: 'Tất cả vai trò' },
  ...ROLE_OPTIONS,
];

const ACTIVE_OPTIONS: Array<{ value: ActiveFilter; label: string }> = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'true', label: 'Đang hoạt động' },
  { value: 'false', label: 'Đã khóa' },
];

@Component({
  selector: 'app-account-management',
  imports: [
    ReactiveFormsModule,
    SdButton,
    SdInform,
    SdInput,
    SdModal,
    SdPageComponent,
    SdRadio,
    SdSection,
    SdSelect,
    SdTable,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './account-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@SdTabComponent({
  component: AccountManagementComponent,
  name: 'Quản lý tài khoản',
  icon: 'manage_accounts',
  color: 'primary',
})
export class AccountManagementComponent {
  readonly #api = inject(AdminApiService);
  readonly #confirm = inject(SdConfirmService);
  readonly #notify = inject(SdNotifyService);
  readonly #permission = inject(SdPermissionService);
  readonly table = viewChild<SdTable<AccountRow>>(SdTable);
  readonly editorModal = viewChild<SdModal>('editorModal');

  readonly accounts = signal<AccountRow[]>([]);
  readonly canManage = this.#permission.hasPermission(STARTFLOW_PERMISSIONS.accountManage);
  readonly branches = signal<Branch[]>([]);
  readonly query = signal('');
  readonly roleFilter = signal<RoleFilter>('');
  readonly branchFilter = signal<number | null>(null);
  readonly activeFilter = signal<ActiveFilter>('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editingAccountId = signal<number | null>(null);
  readonly editingUsername = signal('');
  readonly draftRole = signal<UserRole>('employee');
  readonly roleOptions = ROLE_OPTIONS;
  readonly roleFilterOptions = ROLE_FILTER_OPTIONS;
  readonly activeOptions = ACTIVE_OPTIONS;
  readonly activeBranches = computed(() => this.branches().filter((branch) => branch.active));
  readonly isEditing = computed(() => this.editingAccountId() !== null);
  readonly isAdminDraft = computed(() => this.draftRole() === 'admin');
  readonly editorTitle = computed(() =>
    this.editingAccountId() === null ? 'Thêm tài khoản' : `Cập nhật ${this.editingUsername()}`,
  );

  readonly form = new FormGroup({});
  draft: AccountDraft = emptyAccountDraft();

  readonly tableOption: SdTableOption<AccountRow> = {
    type: 'local',
    key: 'startflow.administration.accounts',
    items: () => this.accounts(),
    columns: [
      {
        field: 'username',
        title: 'Tên đăng nhập',
        type: 'string',
        width: '170px',
        fixed: true,
        sortable: true,
        cell: { copiable: true },
      },
      {
        field: 'full_name',
        title: 'Họ và tên',
        type: 'string',
        minWidth: '220px',
        sortable: true,
        cell: { truncate: { enable: true, type: 'tooltip' } },
      },
      {
        field: 'role',
        title: 'Vai trò',
        type: 'string',
        width: '130px',
        useBadge: (value) => ({
          type: 'round',
          color: value === 'admin' ? 'primary' : value === 'manager' ? 'info' : 'secondary',
          title: roleLabel(value),
        }),
      },
      {
        field: 'branch_name',
        title: 'Chi nhánh',
        type: 'string',
        minWidth: '220px',
        transform: (value) => (typeof value === 'string' && value ? value : 'Toàn hệ thống'),
      },
      {
        field: 'active',
        title: 'Trạng thái',
        type: 'boolean',
        width: '130px',
        useBadge: (value) => ({
          type: 'round',
          color: value ? 'success' : 'secondary',
          title: value ? 'Hoạt động' : 'Đã khóa',
        }),
      },
      {
        field: 'identity_synced',
        title: 'Đồng bộ SSO',
        type: 'boolean',
        width: '150px',
        useBadge: (value) => ({
          type: 'round',
          color: value ? 'success' : 'warning',
          title: value ? 'Đã đồng bộ' : 'Chờ đồng bộ',
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
          icon: 'lock_open',
          title: 'Mở khóa',
          color: 'success',
          hidden: (row) => !this.canManage || row.active,
          click: (row) => void this.toggleActive(row),
        },
        {
          icon: 'lock',
          title: 'Khóa tài khoản',
          color: 'error',
          hidden: (row) => !this.canManage || !row.active,
          click: (row) => void this.toggleActive(row),
        },
        {
          icon: 'password',
          title: 'Đặt lại mật khẩu',
          hidden: !this.canManage,
          click: (row) => void this.resetPassword(row),
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
    void this.initialize();
  }

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [branches, accounts] = await Promise.all([
        this.#api.listBranches(),
        this.#api.listAccounts(),
      ]);
      this.branches.set(branches);
      this.accounts.set(accounts.map(toAccountRow));
    } catch {
      this.error.set('Không tải được dữ liệu tài khoản và chi nhánh. Vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadAccounts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const role = this.roleFilter() || undefined;
      const active = this.activeFilter() === '' ? undefined : this.activeFilter() === 'true';
      this.accounts.set(
        (
          await this.#api.listAccounts({
          q: this.query(),
          role,
          branch_id: this.branchFilter() ?? undefined,
          active,
          })
        ).map(toAccountRow),
      );
      queueMicrotask(() => void this.table()?.reload(true, false));
    } catch {
      this.error.set('Không tải được danh sách tài khoản. Vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  updateQuery(value: unknown): void {
    this.query.set(typeof value === 'string' ? value : '');
  }

  updateRoleFilter(value: unknown): void {
    this.roleFilter.set(isUserRole(value) ? value : '');
  }

  updateBranchFilter(value: unknown): void {
    this.branchFilter.set(typeof value === 'number' ? value : null);
  }

  updateActiveFilter(value: unknown): void {
    this.activeFilter.set(value === 'true' || value === 'false' ? value : '');
  }

  startCreate(): void {
    this.draft = emptyAccountDraft();
    this.editingAccountId.set(null);
    this.editingUsername.set('');
    this.draftRole.set('employee');
    this.form.reset();
    this.editorModal()?.open();
  }

  startEdit(account: Account): void {
    this.draft = {
      id: account.id,
      username: account.username,
      full_name: account.full_name,
      role: account.role,
      branch_id: account.branch?.id ?? null,
    };
    this.editingAccountId.set(account.id);
    this.editingUsername.set(account.username);
    this.draftRole.set(account.role);
    this.form.reset();
    this.editorModal()?.open();
  }

  onRoleChange(value: unknown): void {
    if (isUserRole(value)) {
      this.draft.role = value;
      this.draftRole.set(value);
    }
    if (this.draft.role === 'admin') this.draft.branch_id = null;
  }

  closeEditor(): void {
    this.editorModal()?.close();
  }

  async save(): Promise<void> {
    const username = this.draft.username.trim();
    const fullName = this.draft.full_name.trim();
    const needsBranch = this.draft.role !== 'admin';
    if (
      !username ||
      !fullName ||
      !/^[a-zA-Z0-9._-]+$/.test(username) ||
      (needsBranch && this.draft.branch_id === null) ||
      (!needsBranch && this.draft.branch_id !== null)
    ) {
      this.form.markAllAsTouched();
      this.#notify.warning(
        needsBranch
          ? 'Manager và Employee bắt buộc thuộc đúng một chi nhánh.'
          : 'Admin phải có phạm vi toàn hệ thống và không thuộc chi nhánh.',
      );
      return;
    }

    const assignment = {
      full_name: fullName,
      role: this.draft.role,
      branch_id: this.draft.role === 'admin' ? null : this.draft.branch_id,
    };
    this.saving.set(true);
    try {
      if (this.draft.id === null) {
        await this.#api.createAccount({ username, ...assignment });
        this.#notify.success('Đã tạo tài khoản và gửi yêu cầu đồng bộ định danh.');
      } else {
        await this.#api.updateAccount(this.draft.id, assignment);
        this.#notify.success('Đã cập nhật tài khoản.');
      }
      this.closeEditor();
      await this.loadAccounts();
    } catch (error) {
      this.#notify.error(error instanceof Error ? error.message : 'Không lưu được tài khoản.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(account: Account): Promise<void> {
    const nextAction = account.active ? 'khóa' : 'mở khóa';
    try {
      await this.#confirm.confirm(`${nextAction === 'khóa' ? 'Khóa' : 'Mở khóa'} tài khoản ${account.username}?`, {
        title: `${nextAction === 'khóa' ? 'Khóa' : 'Mở khóa'} tài khoản`,
        yesTitle: nextAction === 'khóa' ? 'Khóa tài khoản' : 'Mở khóa',
        yesButtonColor: account.active ? 'error' : 'primary',
      });
    } catch {
      return;
    }

    try {
      if (account.active) await this.#api.disableAccount(account.id);
      else await this.#api.enableAccount(account.id);
      this.#notify.success(`Đã ${nextAction} tài khoản.`);
      await this.loadAccounts();
    } catch (error) {
      this.#notify.error(error instanceof Error ? error.message : `Không thể ${nextAction} tài khoản.`);
    }
  }

  async resetPassword(account: Account): Promise<void> {
    try {
      await this.#confirm.confirm(
        `Gửi yêu cầu đặt lại mật khẩu cho ${account.username}? Mật khẩu tạm thời sẽ không hiển thị trên Portal.`,
        {
          title: 'Đặt lại mật khẩu',
          yesTitle: 'Gửi yêu cầu',
        },
      );
    } catch {
      return;
    }

    try {
      await this.#api.resetPassword(account.id);
      this.#notify.success('Đã gửi yêu cầu đặt lại mật khẩu an toàn.');
    } catch (error) {
      this.#notify.error(error instanceof Error ? error.message : 'Không thể đặt lại mật khẩu.');
    }
  }
}

function emptyAccountDraft(): AccountDraft {
  return { id: null, username: '', full_name: '', role: 'employee', branch_id: null };
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'manager' || value === 'employee';
}

function roleLabel(value: unknown): string {
  if (value === 'admin') return 'Admin';
  if (value === 'manager') return 'Manager';
  if (value === 'employee') return 'Employee';
  return 'Không xác định';
}

function toAccountRow(account: Account): AccountRow {
  return { ...account, branch_name: account.branch?.name ?? 'Toàn hệ thống' };
}
