import { TestBed } from '@angular/core/testing';
import { SdPermissionService } from '@sdcorejs/angular/modules/permission';
import { SdConfirmService } from '@sdcorejs/angular/services/confirm';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import { AdminApiService } from '../../../core/api/admin-api.service';
import { BranchManagementComponent } from './branch-management.component';

describe('BranchManagementComponent', () => {
  let api: jasmine.SpyObj<AdminApiService>;
  let confirm: jasmine.SpyObj<SdConfirmService>;
  let notify: jasmine.SpyObj<SdNotifyService>;
  let permission: jasmine.SpyObj<SdPermissionService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', [
      'listBranches',
      'createBranch',
      'updateBranch',
      'deactivateBranch',
    ]);
    api.listBranches.and.resolveTo([
      { id: 1, code: 'HN-HK', name: 'Hà Nội - Hoàn Kiếm', active: true, account_count: 3 },
    ]);
    api.createBranch.and.resolveTo({
      id: 2,
      code: 'DN',
      name: 'Đà Nẵng',
      active: true,
      account_count: 0,
    });
    api.updateBranch.and.resolveTo({
      id: 1,
      code: 'HN-HK',
      name: 'Hà Nội - Hoàn Kiếm',
      active: true,
      account_count: 3,
    });
    api.deactivateBranch.and.resolveTo();
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
      imports: [BranchManagementComponent],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: SdConfirmService, useValue: confirm },
        { provide: SdNotifyService, useValue: notify },
        { provide: SdPermissionService, useValue: permission },
      ],
    }).compileComponents();
  });

  it('shows a manager the branch list without management actions', async () => {
    permission.hasPermission.and.returnValue(false);
    const fixture = TestBed.createComponent(BranchManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.canManage).toBeFalse();
    expect(fixture.componentInstance.tableOption.command?.commands?.every((command) =>
      typeof command.hidden === 'function'
        ? command.hidden(fixture.componentInstance.branches()[0]!) === true
        : command.hidden === true,
    )).toBeTrue();
    expect(fixture.nativeElement.querySelector('[autoid="branch-create"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Thêm chi nhánh');
  });

  it('loads branches and presents operational columns', async () => {
    const fixture = TestBed.createComponent(BranchManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.branches().length).toBe(1);
    expect(fixture.componentInstance.tableOption.columns.map((column) => column.field)).toEqual([
      'code',
      'name',
      'account_count',
      'active',
    ]);
  });

  it('enforces required branch fields before creation', async () => {
    const fixture = TestBed.createComponent(BranchManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.startCreate();
    await fixture.componentInstance.save();

    expect(api.createBranch).not.toHaveBeenCalled();
    expect(notify.warning).toHaveBeenCalled();

    fixture.componentInstance.draft.code = 'DN';
    fixture.componentInstance.draft.name = 'Đà Nẵng';
    await fixture.componentInstance.save();

    expect(api.createBranch).toHaveBeenCalledWith({ code: 'DN', name: 'Đà Nẵng' });
    expect(notify.success).toHaveBeenCalled();
  });
});
