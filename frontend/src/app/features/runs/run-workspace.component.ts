import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { SdBadge } from '@sdcorejs/angular/components/badge';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdView } from '@sdcorejs/angular/components/view';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import type { AgentResult } from '@startflow/contracts';
import type { RunDetail } from '../../core/api/models';
import { formatCurrency, formatDateTime, formatPercent } from '../../shared/formatters';
import { ErrorStateComponent } from '../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../shared/states/loading-state.component';
import { statusPresentation } from '../../shared/status-presentation';
import { AgentLaneComponent } from './agent-lane.component';
import { ApprovalPanelComponent } from './approval-panel.component';
import { EvidencePanelComponent } from './evidence-panel.component';
import { RunFacade } from './run.facade';
import { RunTimelineComponent } from './timeline.component';

const SPECIALIST_AGENTS = ['CREDIT', 'COMPLIANCE', 'OPERATIONS'] as const;
const AGENT_LABELS: Record<AgentResult['agent'], string> = {
  CREDIT: 'Tín dụng',
  COMPLIANCE: 'Tuân thủ',
  OPERATIONS: 'Vận hành',
};

interface SpecialistLane {
  agent: AgentResult['agent'];
  task: RunDetail['plan'][number] | null;
  result: AgentResult | null;
}

@Component({
  selector: 'app-run-workspace',
  imports: [
    SdBadge,
    SdInform,
    SdSection,
    SdView,
    SdPageComponent,
    ErrorStateComponent,
    LoadingStateComponent,
    AgentLaneComponent,
    ApprovalPanelComponent,
    EvidencePanelComponent,
    RunTimelineComponent,
  ],
  providers: [RunFacade],
  templateUrl: './run-workspace.component.html',
  styleUrl: './run-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunWorkspaceComponent {
  readonly facade = inject(RunFacade);

  readonly runId = input.required<string>();

  readonly header = computed(() => {
    const run = this.facade.run();
    if (!run) {
      return {
        title: 'Không gian phân tích đa tác nhân',
        description: 'Đang tải ảnh chụp lượt đánh giá và kết nối dòng sự kiện.',
      };
    }
    const company = run.caseSnapshot?.companyName ?? `Hồ sơ #${run.caseId.slice(0, 8)}`;
    const request = run.caseSnapshot
      ? `${formatCurrency(run.caseSnapshot.requestedAmount)} · ${run.caseSnapshot.purpose}`
      : `Lượt đánh giá #${run.id.slice(0, 8)}`;
    return { title: company, description: request };
  });

  readonly runStatus = computed(() => {
    const run = this.facade.run();
    return run ? statusPresentation(run.status) : null;
  });

  readonly plannerTasks = computed(() =>
    (this.facade.run()?.plan ?? []).map((task) => ({
      ...task,
      statusView: statusPresentation(task.status),
      agentLabel: AGENT_LABELS[task.agent],
    })),
  );

  readonly specialistLanes = computed<SpecialistLane[]>(() => {
    const run = this.facade.run();
    return SPECIALIST_AGENTS.map((agent) => ({
      agent,
      task: run?.plan.find((task) => task.agent === agent) ?? null,
      result: run?.agentResults.find((result) => result.agent === agent) ?? null,
    }));
  });

  readonly partialDescription = computed(() => {
    const failed = this.facade.failedAgents();
    if (failed.length === 0) {
      return 'Hệ thống chỉ tổng hợp được một phần dữ liệu; các kết quả hợp lệ vẫn được giữ nguyên.';
    }
    return `Chuyên gia chưa hoàn tất: ${failed.map((agent) => AGENT_LABELS[agent]).join(', ')}. Các lane thành công vẫn có hiệu lực.`;
  });

  readonly streamNotice = computed(() => {
    const fatal = this.facade.fatalStreamError();
    if (fatal) {
      return {
        color: 'error' as const,
        title: fatal.kind === 'auth' ? 'Phiên trực tiếp đã hết hạn' : 'Dòng sự kiện đã dừng',
        description: `${fatal.message} Ảnh chụp đã tải vẫn được giữ lại; hãy tải lại trang sau khi xử lý.`,
      };
    }
    if (this.facade.connection() === 'reconnecting' || this.facade.streamError()?.retryable) {
      return {
        color: 'warning' as const,
        title: 'Đang kết nối lại dòng sự kiện',
        description:
          'Timeline tạm thời có thể chậm; dữ liệu REST và sự kiện đã nhận vẫn được giữ lại.',
      };
    }
    if (this.facade.connection() === 'connecting') {
      return {
        color: 'info' as const,
        title: 'Đang kết nối dòng sự kiện',
        description:
          'Ảnh chụp ban đầu đã sẵn sàng; cập nhật trực tiếp sẽ bắt đầu ngay khi kết nối hoàn tất.',
      };
    }
    return null;
  });

  readonly decision = computed(() => {
    const finalDecision = this.facade.run()?.finalDecision;
    if (!finalDecision) return null;
    return {
      ...finalDecision,
      statusView: statusPresentation(finalDecision.status),
      confidenceDisplay: formatPercent(finalDecision.confidence),
      conflictsDisplay: finalDecision.conflicts.join(' · '),
    };
  });

  readonly approval = computed(() => {
    const approval = this.facade.run()?.approval;
    if (!approval) return null;
    return {
      ...approval,
      decisionLabel: approval.decision === 'APPROVE' ? 'Đã phê duyệt' : 'Đã từ chối',
      decisionColor: approval.decision === 'APPROVE' ? ('success' as const) : ('error' as const),
      createdAtDisplay: formatDateTime(approval.createdAt),
    };
  });

  constructor() {
    effect(() => void this.facade.load(this.runId()));
  }

  reload(): void {
    void this.facade.reload();
  }

  applyApprovalSnapshot(snapshot: RunDetail): void {
    this.facade.applySnapshot(snapshot);
  }
}
