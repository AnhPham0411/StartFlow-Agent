import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SdBadge } from '@sdcorejs/angular/components/badge';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdTab, SdTabGroup } from '@sdcorejs/angular/components/tab';
import { SdView } from '@sdcorejs/angular/components/view';
import {
  citationSchema,
  toolEventDataSchema,
  type AgentResult,
  type RunEvent,
} from '@startflow/contracts';
import { formatPercent } from '../../shared/formatters';

type Citation = AgentResult['findings'][number]['citations'][number];

export interface ToolEvidenceView {
  eventId: string;
  sequence: number;
  agent: string;
  toolName: AgentResult['toolNames'][number];
  toolLabel: string;
  latency: string;
  inputDisplay: string;
  outputDisplay: string;
}

const TOOL_LABELS: Record<AgentResult['toolNames'][number], string> = {
  financial_calculator: 'Máy tính tài chính',
  mock_kyc_aml: 'Kiểm tra KYC/AML',
  document_checklist: 'Danh mục tài liệu',
  knowledge_retrieval: 'Tra cứu tri thức',
};

const AGENT_LABELS: Record<NonNullable<RunEvent['agent']>, string> = {
  PLANNER: 'Planner',
  CREDIT: 'Tín dụng',
  COMPLIANCE: 'Tuân thủ',
  OPERATIONS: 'Vận hành',
  SYNTHESIZER: 'Synthesizer',
};

export function extractCitations(
  results: readonly AgentResult[],
  events: readonly RunEvent[],
): Citation[] {
  const candidates: unknown[] = results.flatMap((result) =>
    result.findings.flatMap((finding) => finding.citations),
  );

  for (const event of events) {
    if (event.type !== 'citation.added') continue;
    candidates.push(event.payload, event.payload['citation'], event.payload['data']);
  }

  const byId = new Map<string, Citation>();
  for (const candidate of candidates) {
    const parsed = citationSchema.safeParse(candidate);
    if (parsed.success && !byId.has(parsed.data.id)) byId.set(parsed.data.id, parsed.data);
  }
  return [...byId.values()];
}

export function extractToolEvents(events: readonly RunEvent[]): ToolEvidenceView[] {
  const views: ToolEvidenceView[] = [];
  for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
    if (event.type !== 'tool.completed') continue;
    const candidates = [event.payload, event.payload['tool'], event.payload['data']];
    const parsed = candidates
      .map((candidate) => toolEventDataSchema.safeParse(candidate))
      .find((result) => result.success);
    if (!parsed?.success) continue;

    views.push({
      eventId: event.id,
      sequence: event.sequence,
      agent: event.agent ? AGENT_LABELS[event.agent] : 'Hệ thống',
      toolName: parsed.data.toolName,
      toolLabel: TOOL_LABELS[parsed.data.toolName],
      latency: `${parsed.data.latencyMs.toLocaleString('vi-VN')} ms`,
      inputDisplay: summarizeRecord(parsed.data.inputSummary),
      outputDisplay: summarizeRecord(parsed.data.outputSummary),
    });
  }
  return views;
}

@Component({
  selector: 'app-evidence-panel',
  imports: [SdBadge, SdInform, SdSection, SdTab, SdTabGroup, SdView],
  template: `
    <section aria-labelledby="evidence-panel-title">
      <h2 id="evidence-panel-title" class="d-none">Bằng chứng và công cụ</h2>
      <sd-section
        title="Bằng chứng"
        subTitle="Nguồn tri thức và dấu vết sử dụng công cụ"
        icon="fact_check"
      >
        <div class="p-16">
          <sd-tab-group autoId="run-evidence-tabs" variant="line" color="primary">
            <sd-tab [label]="citationTabLabel()" icon="library_books">
              @if (citations().length === 0) {
                <div class="pt-16">
                  <sd-inform
                    info
                    title="Chưa có trích dẫn"
                    description="Các nguồn được chuyên gia viện dẫn sẽ xuất hiện tại đây."
                  ></sd-inform>
                </div>
              } @else {
                <div class="d-flex flex-column gap-16 pt-16" aria-label="Danh sách trích dẫn">
                  @for (citation of citations(); track citation.id) {
                    <article class="d-flex flex-column gap-8">
                      <div class="d-flex align-items-center justify-content-between gap-8">
                        <sd-badge
                          type="tag"
                          color="success"
                          icon="description"
                          [title]="citation.documentTitle"
                        ></sd-badge>
                        <sd-badge
                          type="round"
                          color="info"
                          [title]="citation.relevanceDisplay"
                        ></sd-badge>
                      </div>
                      <sd-view label="Mục" [display]="citation.section"></sd-view>
                      <blockquote class="m-0 text-muted">“{{ citation.excerpt }}”</blockquote>
                    </article>
                  }
                </div>
              }
            </sd-tab>

            <sd-tab [label]="toolTabLabel()" icon="build">
              @if (tools().length === 0) {
                <div class="pt-16">
                  <sd-inform
                    info
                    title="Chưa có lần gọi công cụ"
                    description="Đầu vào và đầu ra tóm tắt sẽ được lưu lại khi công cụ hoàn tất."
                  ></sd-inform>
                </div>
              } @else {
                <div class="d-flex flex-column gap-16 pt-16" aria-label="Dấu vết công cụ">
                  @for (tool of tools(); track tool.eventId) {
                    <article class="d-flex flex-column gap-8">
                      <div class="d-flex flex-wrap gap-8">
                        <sd-badge
                          type="tag"
                          color="info"
                          icon="build"
                          [title]="tool.toolLabel"
                        ></sd-badge>
                        <sd-badge type="round" color="secondary" [title]="tool.agent"></sd-badge>
                      </div>
                      <div class="row gap-y-8">
                        <div class="col-12 col-lg-6">
                          <sd-view label="Đầu vào" [display]="tool.inputDisplay"></sd-view>
                        </div>
                        <div class="col-12 col-lg-6">
                          <sd-view label="Đầu ra" [display]="tool.outputDisplay"></sd-view>
                        </div>
                      </div>
                      <sd-view label="Độ trễ" [display]="tool.latency"></sd-view>
                    </article>
                  }
                </div>
              }
            </sd-tab>
          </sd-tab-group>
        </div>
      </sd-section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvidencePanelComponent {
  readonly results = input<readonly AgentResult[]>([]);
  readonly events = input<readonly RunEvent[]>([]);
  readonly citations = computed(() =>
    extractCitations(this.results(), this.events()).map((citation) => ({
      ...citation,
      relevanceDisplay: formatPercent(citation.relevanceScore),
    })),
  );
  readonly tools = computed(() => extractToolEvents(this.events()));
  readonly citationTabLabel = computed(() => `Trích dẫn (${this.citations().length})`);
  readonly toolTabLabel = computed(() => `Công cụ (${this.tools().length})`);
}

function summarizeRecord(record: Record<string, unknown>): string {
  const entries = Object.entries(record);
  if (entries.length === 0) return 'Không có dữ liệu tóm tắt';
  return entries.map(([key, value]) => `${key}: ${formatSummaryValue(value)}`).join(' · ');
}

function formatSummaryValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value == null) return '—';
  try {
    return JSON.stringify(value);
  } catch {
    return '[dữ liệu phức hợp]';
  }
}
