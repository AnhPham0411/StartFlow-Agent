import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import {
  SdTable,
  SdTableCellDefDirective,
  type SdTableOption,
} from '@sdcorejs/angular/components/table';
import { SdSelect } from '@sdcorejs/angular/forms/select';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import type { ComparisonMetric } from '@startflow/contracts';
import type { CaseSummary, ComparisonResult } from '../../core/api/models';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import { EmptyStateComponent } from '../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../shared/states/loading-state.component';

type MetricName = ComparisonMetric['name'];

interface MetricDefinition {
  name: MetricName;
  label: string;
}

export interface ComparisonMetricRow {
  name: MetricName;
  label: string;
  singleDisplay: string;
  multiDisplay: string;
  unitLabel: string;
  singleWidth: string;
  multiWidth: string;
  singleAriaLabel: string;
  multiAriaLabel: string;
}

const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  { name: 'completeness', label: 'Độ đầy đủ' },
  { name: 'citationCoverage', label: 'Phủ căn cứ' },
  { name: 'toolUse', label: 'Sử dụng công cụ' },
  { name: 'conflictDetection', label: 'Phát hiện xung đột' },
  { name: 'latency', label: 'Độ trễ' },
  { name: 'rubricScore', label: 'Điểm rubric' },
];

@Component({
  selector: 'app-comparison',
  imports: [
    RouterLink,
    SdButton,
    SdInform,
    SdPageComponent,
    SdSection,
    SdSelect,
    SdTable,
    SdTableCellDefDirective,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingStateComponent,
  ],
  templateUrl: './comparison.component.html',
  styleUrl: './comparison.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparisonComponent implements OnInit {
  readonly #api = inject(StartFlowApiService);
  private readonly table = viewChild(SdTable<ComparisonMetricRow>);

  readonly cases = signal<CaseSummary[]>([]);
  readonly selectedCaseId = signal('');
  readonly result = signal<ComparisonResult | null>(null);
  readonly loading = signal(true);
  readonly running = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorKind = signal<'cases' | 'comparison' | null>(null);

  readonly metricRows = computed<ComparisonMetricRow[]>(() => {
    const metrics = this.result()?.metrics ?? [];
    const metricsByName = new Map(metrics.map((metric) => [metric.name, metric]));

    return METRIC_DEFINITIONS.flatMap((definition) => {
      const metric = metricsByName.get(definition.name);
      if (!metric) return [];

      const maximum = Math.max(metric.singleAgent, metric.multiAgent, 1);
      const singleDisplay = formatMetricValue(metric.singleAgent, metric.unit);
      const multiDisplay = formatMetricValue(metric.multiAgent, metric.unit);
      const unitLabel = formatUnit(metric.unit);
      return [
        {
          name: definition.name,
          label: definition.label,
          singleDisplay,
          multiDisplay,
          unitLabel,
          singleWidth: barWidth(metric.singleAgent, maximum),
          multiWidth: barWidth(metric.multiAgent, maximum),
          singleAriaLabel: `Single-agent: ${singleDisplay}`,
          multiAriaLabel: `Multi-agent: ${multiDisplay}`,
        },
      ];
    });
  });

  readonly comparisonTableOption: SdTableOption<ComparisonMetricRow> = {
    type: 'local',
    items: () => this.metricRows(),
    selector: { visible: false },
    paginate: { hidden: true },
    sort: { enable: false },
    columns: [
      { field: 'label', title: 'Metric', type: 'string', minWidth: '180px' },
      {
        field: 'singleDisplay',
        title: 'Single-agent',
        type: 'string',
        minWidth: '210px',
      },
      {
        field: 'multiDisplay',
        title: 'Multi-agent',
        type: 'string',
        minWidth: '210px',
      },
      { field: 'unitLabel', title: 'Đơn vị', type: 'string', width: '100px' },
    ],
  };

  ngOnInit(): void {
    void this.loadCases();
  }

  async loadCases(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.errorKind.set(null);
    try {
      const cases = await this.#api.listCases();
      this.cases.set(cases);
      if (!cases.some((item) => item.id === this.selectedCaseId())) {
        this.selectedCaseId.set(cases[0]?.id ?? '');
        this.result.set(null);
      }
    } catch {
      this.cases.set([]);
      this.error.set('Không tải được danh sách hồ sơ để so sánh.');
      this.errorKind.set('cases');
    } finally {
      this.loading.set(false);
    }
  }

  selectCase(caseId: unknown): void {
    this.selectedCaseId.set(typeof caseId === 'string' ? caseId : '');
    this.result.set(null);
    this.error.set(null);
    this.errorKind.set(null);
  }

  async compare(): Promise<void> {
    const caseId = this.selectedCaseId();
    if (!caseId || this.running()) return;

    this.running.set(true);
    this.error.set(null);
    this.errorKind.set(null);
    try {
      this.result.set(await this.#api.createComparison(caseId));
      const table = this.table();
      if (table) await table.reload(true, false);
    } catch {
      this.error.set('Không thể chạy phép so sánh. Hãy kiểm tra trạng thái hồ sơ và thử lại.');
      this.errorKind.set('comparison');
    } finally {
      this.running.set(false);
    }
  }

  retry(): void {
    if (this.errorKind() === 'cases') void this.loadCases();
    else void this.compare();
  }
}

function formatMetricValue(value: number, unit: string): string {
  const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
  switch (unit.toLowerCase()) {
    case '%':
    case 'percent':
      return `${number}%`;
    case 's':
    case 'seconds':
      return `${number} giây`;
    case 'count':
      return `${number} lần`;
    case 'points':
      return `${number} điểm`;
    default:
      return `${number} ${unit}`.trim();
  }
}

function formatUnit(unit: string): string {
  switch (unit.toLowerCase()) {
    case '%':
    case 'percent':
      return '%';
    case 's':
    case 'seconds':
      return 'giây';
    case 'count':
      return 'lần';
    case 'points':
      return 'điểm';
    default:
      return unit;
  }
}

function barWidth(value: number, maximum: number): string {
  if (value <= 0) return '0%';
  return `${Math.max(6, Math.round((value / maximum) * 100))}%`;
}
