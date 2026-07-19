import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SdHistoryItem } from '@sdcorejs/angular/components/history';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import type { Color } from '@sdcorejs/utils/models';
import type { RunEvent } from '@startflow/contracts';
import { formatDateTime } from '../../shared/formatters';

const EVENT_PRESENTATION: Record<RunEvent['type'], { title: string; icon: string; color: Color }> =
  {
    'run.started': { title: 'Bắt đầu lượt đánh giá', icon: 'play_arrow', color: 'info' },
    'plan.created': { title: 'Planner công bố kế hoạch', icon: 'account_tree', color: 'info' },
    'agent.started': { title: 'Chuyên gia bắt đầu', icon: 'smart_toy', color: 'info' },
    'tool.completed': { title: 'Công cụ hoàn tất', icon: 'build', color: 'success' },
    'citation.added': { title: 'Bổ sung trích dẫn', icon: 'library_books', color: 'success' },
    'agent.completed': { title: 'Chuyên gia hoàn tất', icon: 'task_alt', color: 'success' },
    'synthesis.completed': { title: 'Hoàn tất tổng hợp', icon: 'hub', color: 'success' },
    'approval.required': { title: 'Yêu cầu phê duyệt', icon: 'approval', color: 'warning' },
    'run.completed': { title: 'Lượt đánh giá hoàn tất', icon: 'done_all', color: 'success' },
    'run.failed': { title: 'Lượt đánh giá gặp lỗi', icon: 'error', color: 'error' },
  };

const AGENT_LABELS: Record<NonNullable<RunEvent['agent']>, string> = {
  PLANNER: 'Planner',
  CREDIT: 'Tín dụng',
  COMPLIANCE: 'Tuân thủ',
  OPERATIONS: 'Vận hành',
  SYNTHESIZER: 'Synthesizer',
};

export interface RunTimelineItem {
  sequence: number;
  title: string;
  status: { title: string; color: Color; icon: string };
  date: string;
  actor: string;
  source: string;
  description: string;
}

export function buildTimelineItems(events: readonly RunEvent[]): RunTimelineItem[] {
  return [...events]
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => {
      const presentation = EVENT_PRESENTATION[event.type];
      const source = event.agent ? AGENT_LABELS[event.agent] : 'Hệ thống';
      const payloadSummary = event.payload['summary'];
      return {
        sequence: event.sequence,
        title: presentation.title,
        status: {
          title: `Sự kiện #${event.sequence}`,
          color: presentation.color,
          icon: presentation.icon,
        },
        date: formatDateTime(event.occurredAt),
        actor: source,
        source,
        description:
          typeof payloadSummary === 'string'
            ? payloadSummary
            : `Đã ghi nhận sự kiện ${event.type}.`,
      };
    });
}

@Component({
  selector: 'app-run-timeline',
  imports: [SdHistoryItem, SdInform, SdSection],
  template: `
    <section aria-labelledby="run-timeline-title">
      <h2 id="run-timeline-title" class="d-none">Dòng thời gian</h2>
      <sd-section title="Dòng thời gian" [subTitle]="items().length + ' sự kiện'" icon="history">
        @if (items().length === 0) {
          <div class="p-16">
            <sd-inform
              info
              title="Chưa có sự kiện"
              description="Sự kiện từ Planner và các chuyên gia sẽ xuất hiện tại đây."
            ></sd-inform>
          </div>
        } @else {
          <div class="p-16">
            <sd-history [items]="items()"></sd-history>
          </div>
        }
      </sd-section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunTimelineComponent {
  readonly events = input<readonly RunEvent[]>([]);
  readonly items = computed(() => buildTimelineItems(this.events()));
}
