import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SdBadge } from '@sdcorejs/angular/components/badge';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdView } from '@sdcorejs/angular/components/view';
import type { Color } from '@sdcorejs/utils/models';
import type { AgentPlanTask, AgentResult, RunEvent } from '@startflow/contracts';
import { formatPercent } from '../../shared/formatters';
import { statusPresentation } from '../../shared/status-presentation';

const AGENT_PRESENTATION: Record<
  AgentResult['agent'],
  { label: string; icon: string; emptySummary: string }
> = {
  CREDIT: {
    label: 'Tín dụng',
    icon: 'account_balance',
    emptySummary: 'Đang chờ đánh giá năng lực tài chính.',
  },
  COMPLIANCE: {
    label: 'Tuân thủ',
    icon: 'policy',
    emptySummary: 'Đang chờ kiểm tra KYC, AML và chính sách.',
  },
  OPERATIONS: {
    label: 'Vận hành',
    icon: 'fact_check',
    emptySummary: 'Đang chờ kiểm tra hồ sơ và khả năng thực thi.',
  },
};

export interface AgentLaneView {
  agent: AgentResult['agent'];
  label: string;
  icon: string;
  status: AgentPlanTask['status'];
  statusLabel: string;
  statusColor: Color;
  objective: string;
  summary: string;
  confidenceDisplay: string;
  findings: AgentResult['findings'];
  toolNames: AgentResult['toolNames'];
  eventCount: number;
  isActive: boolean;
  isFailed: boolean;
  errorCode: string | null;
  accessibleLabel: string;
}

export function buildAgentLaneView(
  task: AgentPlanTask | null,
  result: AgentResult | null,
  events: readonly RunEvent[],
  fallbackAgent?: AgentResult['agent'],
): AgentLaneView {
  const agent = task?.agent ?? result?.agent ?? fallbackAgent;
  if (!agent) throw new Error('Agent lane requires an agent kind.');

  const agentEvents = events.filter((event) => event.agent === agent);
  const hasStarted = agentEvents.some((event) => event.type === 'agent.started');
  const hasCompleted = agentEvents.some((event) => event.type === 'agent.completed');
  const status =
    result?.status ??
    task?.status ??
    (hasCompleted ? 'COMPLETED' : hasStarted ? 'RUNNING' : 'PENDING');
  const statusView = statusPresentation(status);
  const presentation = AGENT_PRESENTATION[agent];
  const isFailed = status === 'FAILED';
  const isActive = status === 'RUNNING';

  return {
    agent,
    label: presentation.label,
    icon: presentation.icon,
    status,
    statusLabel: statusView.label,
    statusColor: statusView.color,
    objective: task?.objective ?? 'Planner chưa công bố nhiệm vụ cho chuyên gia này.',
    summary: result?.summary ?? presentation.emptySummary,
    confidenceDisplay: result ? formatPercent(result.confidence) : '—',
    findings: result?.findings ?? [],
    toolNames: result?.toolNames ?? [],
    eventCount: agentEvents.length,
    isActive,
    isFailed,
    errorCode: result?.errorCode ?? null,
    accessibleLabel: `${presentation.label}: ${statusView.label}`,
  };
}

@Component({
  selector: 'app-agent-lane',
  imports: [SdBadge, SdInform, SdSection, SdView],
  templateUrl: './agent-lane.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentLaneComponent {
  readonly agent = input.required<AgentResult['agent']>();
  readonly task = input<AgentPlanTask | null>(null);
  readonly result = input<AgentResult | null>(null);
  readonly events = input<readonly RunEvent[]>([]);

  readonly view = computed(() =>
    buildAgentLaneView(this.task(), this.result(), this.events(), this.agent()),
  );
}
