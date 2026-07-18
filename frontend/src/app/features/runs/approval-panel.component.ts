import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdTextarea } from '@sdcorejs/angular/forms/textarea';
import { SdPermissionService } from '@sdcorejs/angular/modules/permission';
import { SdConfirmService } from '@sdcorejs/angular/services/confirm';
import { SdNotifyService } from '@sdcorejs/angular/services/notify';
import type { ApprovalRequest } from '@startflow/contracts';
import type { RunDetail } from '../../core/api/models';
import { ApiError, StartFlowApiService } from '../../core/api/startflow-api.service';
import { STARTFLOW_PERMISSIONS } from '../../core/auth/permission-map';
import { CoreFormAccessibilityDirective } from '../../shared/a11y/core-form-accessibility.directive';

@Component({
  selector: 'app-approval-panel',
  imports: [SdButton, SdInform, SdTextarea, CoreFormAccessibilityDirective],
  templateUrl: './approval-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalPanelComponent {
  readonly #api = inject(StartFlowApiService);
  readonly #confirm = inject(SdConfirmService);
  readonly #notify = inject(SdNotifyService);
  readonly #permission = inject(SdPermissionService);

  readonly run = input.required<RunDetail>();
  readonly snapshotUpdated = output<RunDetail>();
  readonly submitting = signal(false);
  readonly reasonError = signal<string | undefined>(undefined);
  readonly reasonControl = viewChild(SdTextarea);
  readonly canApprove = this.#permission.hasPermission(STARTFLOW_PERMISSIONS.runApprove);
  reason = '';

  updateReason(value: unknown): void {
    this.reason = String(value ?? '');
    this.reasonError.set(undefined);
  }

  /** Confirms and records one optimistic approval decision against the displayed version. */
  async submit(decision: ApprovalRequest['decision']): Promise<void> {
    if (!this.canApprove) {
      this.#notify.error('Bạn không có quyền phê duyệt lượt đánh giá này.');
      return;
    }

    const reason = this.reason.trim();
    if (reason.length < 5) {
      const message = 'Lý do cần ít nhất 5 ký tự.';
      this.reasonError.set(message);
      this.reasonControl()?.formControl.markAsTouched();
      this.reasonControl()?.focus();
      this.#notify.error(message);
      return;
    }
    this.reasonError.set(undefined);

    const actionLabel = decision === 'APPROVE' ? 'phê duyệt' : 'từ chối';
    const run = this.run();
    const proposedAction = run.finalDecision?.proposedAction?.title ?? 'hành động đề xuất';
    try {
      await this.#confirm.confirm(`Xác nhận ${actionLabel} “${proposedAction}”?`, {
        title: decision === 'APPROVE' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối',
        yesTitle: decision === 'APPROVE' ? 'Phê duyệt' : 'Từ chối',
        noTitle: 'Hủy',
        yesButtonColor: decision === 'APPROVE' ? 'success' : 'error',
        noButtonColor: 'secondary',
      });
    } catch {
      return;
    }

    this.submitting.set(true);
    try {
      const updated = await this.#api.submitApproval(run.id, {
        decision,
        reason,
        expectedVersion: run.version,
      });
      this.reason = '';
      this.reasonError.set(undefined);
      this.snapshotUpdated.emit(updated);
      this.#notify.success(
        decision === 'APPROVE'
          ? 'Đã phê duyệt hành động đề xuất.'
          : 'Đã từ chối hành động đề xuất.',
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await this.#handleConflict(run.id);
      } else {
        this.#notify.error('Không thể ghi nhận quyết định. Vui lòng thử lại.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  async #handleConflict(runId: string): Promise<void> {
    try {
      const latest = await this.#api.getRun(runId);
      this.snapshotUpdated.emit(latest);
      this.#notify.warning(
        'Lượt đánh giá đã được xử lý ở nơi khác. Dữ liệu mới nhất đã được tải lại.',
      );
    } catch {
      this.#notify.warning(
        'Lượt đánh giá đã được xử lý ở nơi khác. Vui lòng tải lại dữ liệu mới nhất.',
      );
    }
  }
}
