import { TestBed } from '@angular/core/testing';
import { SdPermissionService } from '@sdcorejs/angular/modules/permission';
import { SdConfirmService } from '@sdcorejs/angular/services/confirm';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import { AdminApiService } from '../../../core/api/admin-api.service';
import { AccountManagementComponent } from './account-management.component';

describe('AccountManagementComponent', () => {
  let api: jasmine.SpyObj<AdminApiService>;
  let confirm: jasmine.SpyObj<SdConfirmService>;
  let notify: jasmine.SpyObj<SdNotifyService>;
  let permission: jasmine.SpyObj<SdPermissionService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', [
      'listBranches',
      'listAccounts',
      'createAccount',
      'updateAccount',
      'enableAccount',
      'disableAccount',
      'resetPassword',
    ]);
    api.listBranches.and.resolveTo([
      { id: 1, code: 'HN-HK', name: 'Hà Nội - Hoàn Kiếm', active: true, account_count: 3 },
    ]);
    api.listAccounts.and.resolveTo([
      {
        id: 6,
        username: 'user006',
        full_name: 'Quản lý Hoàn Kiếm',
        role: 'manager',
        active: true,
        branch: { id: 1, code: 'HN-HK', name: 'Hà Nội - Hoàn Kiếm' },
        identity_synced: true,
      },
    ]);
    api.createAccount.and.resolveTo({
      id: 31,
      username: 'demo.employee',
      full_name: 'Nhân viên Demo',
      role: 'employee',
      active: true,
      branch: { id: 1, code: 'HN-HK', name: 'Hà Nội - Hoàn Kiếm' },
      identity_synced: true,
    });
    api.updateAccount.and.callFake(async (id, payload) => ({
      id,
      username: 'demo.employee',
      active: true,
      identity_synced: true,
      branch: payload.branch_id
        ? { id: payload.branch_id, code: 'HN-HK', name: 'Hà Nội - Hoàn Kiếm' }
        : null,
      ...payload,
    }));
    api.enableAccount.and.resolveTo();
    api.disableAccount.and.resolveTo();
    api.resetPassword.and.resolveTo();
    confirm = jasmine.createSpyObj<SdConfirmService>('SdConfirmService', ['confirm']);
    confirm.confirm.and.resolveTo(true);
    notify = jasmine.createSpyObj<SdNotifyService>('SdNotifyService', [
      'success',
      'error',
      'warning',
    ]);
    permission = jasmine.createSpyObj<SdPermissionService>('SdPermissionService', ['hasPermission']);
    permission.hasPermission.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [AccountManagementComponent],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: SdConfirmService, useValue: confirm },
        { provide: SdNotifyService, useValue: notify },
        { provide: SdPermissionService, useValue: permission },
      ],
    }).compileComponents();
  });

  it('shows a manager the account list without management actions', async () => {
    permission.hasPermission.and.returnValue(false);
    const fixture = TestBed.createComponent(AccountManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.canManage).toBeFalse();
    expect(fixture.componentInstance.tableOption.command?.commands?.every((command) =>
      typeof command.hidden === 'function'
        ? command.hidden(fixture.componentInstance.accounts()[0]!) === true
        : command.hidden === true,
    )).toBeTrue();
    expect(fixture.nativeElement.querySelector('[autoid="account-create"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Thêm tài khoản');
  });

  it('loads account, role, branch and identity status columns', async () => {
    const fixture = TestBed.createComponent(AccountManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.accounts().length).toBe(1);
    expect(fixture.componentInstance.tableOption.columns.map((column) => column.field)).toEqual([
      'username',
      'full_name',
      'role',
      'branch_name',
      'active',
      'identity_synced',
    ]);
  });

  it('requires exactly one branch for employee and no branch for admin', async () => {
    const fixture = TestBed.createComponent(AccountManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.startCreate();
    fixture.componentInstance.draft.username = 'demo.employee';
    fixture.componentInstance.draft.full_name = 'Nhân viên Demo';
    fixture.componentInstance.draft.role = 'employee';
    await fixture.componentInstance.save();
    expect(api.createAccount).not.toHaveBeenCalled();

    fixture.componentInstance.draft.branch_id = 1;
    await fixture.componentInstance.save();
    expect(api.createAccount).toHaveBeenCalledWith({
      username: 'demo.employee',
      full_name: 'Nhân viên Demo',
      role: 'employee',
      branch_id: 1,
    });

    fixture.componentInstance.draft.role = 'admin';
    fixture.componentInstance.onRoleChange('admin');
    expect(fixture.componentInstance.draft.branch_id).toBeNull();
  });
});
