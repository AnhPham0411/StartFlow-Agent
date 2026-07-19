import { TestBed } from '@angular/core/testing';
import { SdPermissionService } from '@sdcorejs/angular/modules/permission';
import { SdConfirmService } from '@sdcorejs/angular/services/confirm';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import type { RunDetail } from '../../core/api/models';
import { ApiError, StartFlowApiService } from '../../core/api/startflow-api.service';
import { STARTFLOW_PERMISSIONS } from '../../core/auth/permission-map';
import { ApprovalPanelComponent } from './approval-panel.component';

describe('ApprovalPanelComponent', () => {
  let api: jasmine.SpyObj<StartFlowApiService>;
  let confirm: jasmine.SpyObj<SdConfirmService>;
  let notify: jasmine.SpyObj<SdNotifyService>;
  let permission: jasmine.SpyObj<SdPermissionService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<StartFlowApiService>('StartFlowApiService', [
      'submitApproval',
      'getRun',
    ]);
    confirm = jasmine.createSpyObj<SdConfirmService>('SdConfirmService', ['confirm']);
    notify = jasmine.createSpyObj<SdNotifyService>('SdNotifyService', [
      'success',
      'warning',
      'error',
    ]);
    permission = jasmine.createSpyObj<SdPermissionService>('SdPermissionService', [
      'hasPermission',
    ]);
    permission.hasPermission.and.returnValue(true);

    TestBed.configureTestingModule({
      imports: [ApprovalPanelComponent],
      providers: [
        { provide: StartFlowApiService, useValue: api },
        { provide: SdConfirmService, useValue: confirm },
        { provide: SdNotifyService, useValue: notify },
        { provide: SdPermissionService, useValue: permission },
      ],
    });
  });

  it('renders approval actions only for the approver permission', () => {
    permission.hasPermission.and.returnValue(false);
    const fixture = createComponent();

    expect(permission.hasPermission).toHaveBeenCalledWith(STARTFLOW_PERMISSIONS.runApprove);
    expect(fixture.nativeElement.querySelector('[data-testid="approval-actions"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Cần quyền phê duyệt');
  });

  it('requires a trimmed reason of at least five characters before confirmation', async () => {
    const fixture = createComponent();
    fixture.componentInstance.reason = ' bốn ';

    await fixture.componentInstance.submit('APPROVE');

    expect(confirm.confirm).not.toHaveBeenCalled();
    expect(api.submitApproval).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Lý do cần ít nhất 5 ký tự.');
    expect(fixture.componentInstance.reasonError()).toBe('Lý do cần ít nhất 5 ký tự.');
    expect(fixture.componentInstance.reasonControl()?.formControl.touched).toBeTrue();
  });

  it('confirms and submits both decisions with the current expectedVersion', async () => {
    for (const decision of ['APPROVE', 'REJECT'] as const) {
      const fixture = createComponent();
      const updated = runDetail({ status: 'COMPLETED', version: 8 });
      const emitted: RunDetail[] = [];
      fixture.componentInstance.snapshotUpdated.subscribe((snapshot) => emitted.push(snapshot));
      fixture.componentInstance.reason = ' Đã kiểm tra đầy đủ ';
      confirm.confirm.and.resolveTo(undefined);
      api.submitApproval.and.resolveTo(updated);

      await fixture.componentInstance.submit(decision);

      expect(api.submitApproval).toHaveBeenCalledWith(RUN.id, {
        decision,
        reason: 'Đã kiểm tra đầy đủ',
        expectedVersion: RUN.version,
      });
      expect(confirm.confirm).toHaveBeenCalledWith(
        jasmine.stringMatching(decision === 'APPROVE' ? /phê duyệt/ : /từ chối/),
        jasmine.objectContaining({
          yesTitle: decision === 'APPROVE' ? 'Phê duyệt' : 'Từ chối',
        }),
      );
      expect(notify.success).toHaveBeenCalled();
      expect(emitted).toEqual([updated]);

      api.submitApproval.calls.reset();
      confirm.confirm.calls.reset();
      notify.success.calls.reset();
    }
  });

  it('handles 409 by reloading and guiding the user to the latest snapshot', async () => {
    const fixture = createComponent();
    const latest = runDetail({ status: 'COMPLETED', version: 9 });
    const emitted: RunDetail[] = [];
    fixture.componentInstance.snapshotUpdated.subscribe((snapshot) => emitted.push(snapshot));
    fixture.componentInstance.reason = 'Đã kiểm tra đầy đủ';
    confirm.confirm.and.resolveTo(undefined);
    api.submitApproval.and.rejectWith(new ApiError('Version conflict', 409));
    api.getRun.and.resolveTo(latest);

    await fixture.componentInstance.submit('APPROVE');

    expect(api.getRun).toHaveBeenCalledOnceWith(RUN.id);
    expect(emitted).toEqual([latest]);
    expect(notify.warning).toHaveBeenCalledWith(
      'Lượt đánh giá đã được xử lý ở nơi khác. Dữ liệu mới nhất đã được tải lại.',
    );
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ApprovalPanelComponent);
    fixture.componentRef.setInput('run', RUN);
    fixture.detectChanges();
    return fixture;
  }
});

const RUN = runDetail({
  finalDecision: {
    status: 'RECOMMEND',
    summary: 'Đề xuất cấp tín dụng có điều kiện',
    rationale: ['Dòng tiền phù hợp'],
    conditions: ['Bổ sung tài sản bảo đảm'],
    conflicts: [],
    confidence: 0.82,
    requiresHumanApproval: true,
    proposedAction: {
      type: 'CREATE_ACTION_TICKET',
      title: 'Tạo phiếu theo dõi sau phê duyệt',
      description: 'Theo dõi điều kiện giải ngân.',
    },
  },
});

function runDetail(overrides: Partial<RunDetail> = {}): RunDetail {
  return {
    id: '10000000-0000-4000-8000-000000000000',
    caseId: '20000000-0000-4000-8000-000000000000',
    status: 'AWAITING_APPROVAL',
    createdAt: '2026-07-18T00:00:00.000Z',
    completedAt: null,
    finalDecisionStatus: 'RECOMMEND',
    version: 7,
    plan: [],
    agentResults: [],
    finalDecision: null,
    events: [],
    approval: null,
    actionTicket: null,
    ...overrides,
  };
}
