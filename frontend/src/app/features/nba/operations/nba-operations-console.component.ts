import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { SdBadge } from '@sdcorejs/angular/components/badge';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdInform } from '@sdcorejs/angular/components/inform';
import { SdSection } from '@sdcorejs/angular/components/section';
import { SdTabComponent } from '@sdcorejs/angular/components/tab-router';
import { SdTable, type SdTableOption } from '@sdcorejs/angular/components/table';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import { timer } from 'rxjs';

type ConsoleKey =
  | 'operations'
  | 'compliance'
  | 'tag-qa'
  | 'models'
  | 'rag'
  | 'audit'
  | 'call-lists'
  | 'kpi'
  | 'catalog'
  | 'geo'
  | 'parameters';

type CapabilityStatus = 'demo-ready' | 'connected' | 'planned' | 'not-configured' | 'read-only';
type MiniRunStatus = 'idle' | 'running' | 'complete';

interface ConsoleStage {
  code: string;
  name: string;
  responsibility: string;
  status: CapabilityStatus;
}

interface ConsoleCapability {
  title: string;
  value: string;
  hint: string;
  icon: string;
  color: 'primary' | 'info' | 'success' | 'warning' | 'secondary';
}

interface ConsoleConfig {
  key: ConsoleKey;
  title: string;
  subtitle: string;
  sectionTitle: string;
  capabilities: ConsoleCapability[];
  stages: ConsoleStage[];
}

const NBA_PIPELINE_STAGES: ConsoleStage[] = [
  stage('M1', 'ETL', 'Tổng hợp tín hiệu giao dịch deterministic và giữ nguyên NULL', 'planned'),
  stage('AG1', 'Local extraction', 'Trích xuất tag bằng local LLM, điểm duy nhất chạm PII thô', 'not-configured'),
  stage('M2', 'Geo', 'Ghép vùng địa lý, không suy diễn dưới ngưỡng confidence', 'planned'),
  stage('M3', 'Profile snapshot', 'Hợp nhất profile theo batch và phiên bản', 'planned'),
  stage('M4', 'Scoring', 'Chấm điểm khách hàng trên tất cả sản phẩm', 'planned'),
  stage('M5', 'Ranking R1–R12', 'Lọc điều kiện và xếp hạng theo rule được duyệt', 'not-configured'),
  stage('M6', 'Call-list gate', 'Áp dụng cooldown, suppression và quota phân phối', 'planned'),
  stage('AG2–AG6', 'Sanitized scripting', 'Sinh kịch bản theo sản phẩm chỉ từ contract đã làm sạch', 'not-configured'),
  stage('M7', 'Validate / fallback', 'Kiểm tra payload và fallback khi không đủ evidence', 'not-configured'),
  stage('M8', 'Atomic append', 'Ghi recommendation và suppression nguyên tử, không ghi đè version', 'planned'),
  stage('M10', 'Mini-run', 'Chạy lại M1–M8 cho một khách hàng và giữ version cũ', 'demo-ready'),
  stage('M11', 'Outcome window', 'Nối kết quả mở sản phẩm trong cửa sổ outcome', 'planned'),
  stage('M12', 'Retrain / promotion gates', 'Chỉ promote khi bốn gate pass và tốt hơn production', 'not-configured'),
  stage('M13', 'Masked won/lost RAG', 'Mask dữ liệu trước embedding và lưu cả won/lost case', 'planned'),
];

const CONSOLE_CONFIGS: Record<ConsoleKey, ConsoleConfig> = {
  operations: config(
    'operations',
    'NBA Operations',
    'Theo dõi pipeline M1–M13, trạng thái stage và mini-run trình diễn có kiểm soát.',
    'Hành trình batch và stage',
    NBA_PIPELINE_STAGES,
    [
      capability('Pipeline', 'M1–M13', 'Stage contract đã sẵn sàng', 'account_tree', 'primary'),
      capability('Chế độ', 'Mini run', 'Một khách hàng demo', 'play_circle', 'info'),
      capability('Trace', 'Bật', 'Không hiển thị PII nhạy cảm', 'timeline', 'success'),
      capability('Rule set', 'Chờ input', 'Không tự bịa công thức E/R', 'verified_user', 'warning'),
    ],
  ),
  compliance: config(
    'compliance',
    'Compliance Control Center',
    'Kiểm soát validation, policy gate và biên bảo vệ dữ liệu cho từng lần chạy NBA.',
    'Các lớp kiểm soát',
    [
      stage('C1', 'Input validation', 'Kiểm tra cấu trúc contract đầu vào', 'connected'),
      stage('C2', 'PII boundary', 'Giới hạn dữ liệu nhạy cảm trước agent/tool', 'demo-ready'),
      stage('C3', 'Policy gate', 'Chờ bộ rule chính thức E1–E10 và R1–R12', 'planned'),
      stage('C4', 'Output validation', 'Chặn payload thiếu bằng chứng hoặc sai schema', 'demo-ready'),
    ],
    standardCapabilities('4 gates', 'Schema-first', 'PII safe', 'Audit trace'),
  ),
  'tag-qa': config(
    'tag-qa',
    'Tag Quality Assurance',
    'Theo dõi độ phủ, độ mới và độ ổn định của tag trước khi dùng cho xếp hạng.',
    'Bộ kiểm tra chất lượng tag',
    [
      stage('QA1', 'Coverage', 'Theo dõi tỷ lệ khách hàng có tag hợp lệ', 'demo-ready'),
      stage('QA2', 'Freshness', 'Phát hiện tag quá hạn so với snapshot', 'demo-ready'),
      stage('QA3', 'Distribution drift', 'So sánh thay đổi phân phối theo kỳ', 'planned'),
      stage('QA4', 'Exception queue', 'Gom lỗi để xử lý có truy vết', 'read-only'),
    ],
    standardCapabilities('Coverage', 'Freshness', 'Drift', 'Exceptions'),
  ),
  models: config(
    'models',
    'Model Governance',
    'Quản trị candidate, gate report và quyết định promotion mà không thay đổi model runtime.',
    'Vòng đời model',
    [
      stage('ML1', 'Candidate registry', 'Danh sách model candidate và metadata', 'read-only'),
      stage('ML2', 'Quality gate', 'Theo dõi quality, stability và fairness gate', 'planned'),
      stage('ML3', 'Promotion decision', 'Yêu cầu đủ gate trước khi promote', 'planned'),
      stage('ML4', 'Production lineage', 'Truy vết phiên bản đang phục vụ', 'read-only'),
    ],
    standardCapabilities('Registry', '5 gates', 'Promotion', 'Lineage'),
  ),
  rag: config(
    'rag',
    'RAG Knowledge Monitor',
    'Theo dõi nguồn tri thức, retrieval và citation phục vụ phần giải thích NBA.',
    'Chuỗi RAG có kiểm soát',
    [
      stage('RAG1', 'Knowledge index', 'Theo dõi nguồn và phiên bản tài liệu', 'connected'),
      stage('RAG2', 'Retrieval', 'Tìm evidence theo phạm vi truy cập', 'demo-ready'),
      stage('RAG3', 'Citation check', 'Yêu cầu trích dẫn cho narrative', 'planned'),
      stage('RAG4', 'Fallback', 'Chuyển về giải thích rule khi không đủ evidence', 'demo-ready'),
    ],
    standardCapabilities('Sources', 'Retrieval', 'Citation', 'Fallback'),
  ),
  audit: config(
    'audit',
    'NBA Audit Explorer',
    'Truy vết stage, phiên bản recommendation và phản hồi bán hàng theo từng khách hàng.',
    'Audit lineage',
    [
      stage('A1', 'Run trace', 'Timeline theo run và stage', 'read-only'),
      stage('A2', 'Recommendation versions', 'So sánh các phiên bản đề xuất', 'connected'),
      stage('A3', 'Feedback lineage', 'Liên kết outcome và suppression', 'connected'),
      stage('A4', 'Export control', 'Xuất dữ liệu đã kiểm soát quyền', 'planned'),
    ],
    standardCapabilities('Run trace', 'Versions', 'Feedback', 'Export'),
  ),
  'call-lists': adminConfig('call-lists', 'Call-list Administration', 'Quản lý lịch tạo và phân phối call list.', [
    stage('CL1', 'Generation schedule', 'Theo dõi batch tạo call list', 'read-only'),
    stage('CL2', 'Assignment scope', 'Kiểm tra phạm vi chi nhánh và nhân viên', 'connected'),
    stage('CL3', 'Publish status', 'Theo dõi trạng thái phân phối', 'demo-ready'),
  ]),
  kpi: adminConfig('kpi', 'KPI Configuration', 'Theo dõi bộ KPI dùng cho báo cáo hiệu quả NBA.', [
    stage('K1', 'Outcome metrics', 'Success, rejected, no-contact và callback', 'connected'),
    stage('K2', 'Conversion windows', 'Chờ cấu hình nghiệp vụ chính thức', 'planned'),
    stage('K3', 'Dashboard exposure', 'Chỉ xuất chỉ số đã được phê duyệt', 'read-only'),
  ]),
  catalog: adminConfig('catalog', 'Product Catalog', 'Quản trị catalog gói sản phẩm và trạng thái sử dụng.', [
    stage('P1', 'Products', 'Thẻ, vay, đầu tư, bảo hiểm, tài khoản', 'connected'),
    stage('P2', 'Packages', 'Theo dõi tier và tiêu chí catalog', 'read-only'),
    stage('P3', 'Eligibility links', 'Chờ rule chính thức để kích hoạt chỉnh sửa', 'planned'),
  ]),
  geo: adminConfig('geo', 'Geo Configuration', 'Theo dõi vùng địa lý phục vụ phân công và báo cáo.', [
    stage('G1', 'Branch coverage', 'Liên kết chi nhánh với vùng vận hành', 'connected'),
    stage('G2', 'Territory view', 'Hiển thị phạm vi phục vụ', 'read-only'),
    stage('G3', 'Geo rules', 'Chờ quy tắc phân vùng được duyệt', 'planned'),
  ]),
  parameters: adminConfig('parameters', 'NBA Parameters', 'Quản trị phiên bản tham số nhưng không sửa công thức chưa được phê duyệt.', [
    stage('PR1', 'Parameter registry', 'Danh sách tham số theo phiên bản', 'read-only'),
    stage('PR2', 'Change control', 'Yêu cầu phê duyệt trước khi áp dụng', 'planned'),
    stage('PR3', 'Runtime snapshot', 'Gắn phiên bản tham số vào audit', 'demo-ready'),
  ]),
};

@Component({
  selector: 'app-nba-operations-console',
  imports: [SdBadge, SdButton, SdInform, SdPageComponent, SdSection, SdTable],
  templateUrl: './nba-operations-console.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
@SdTabComponent({
  component: NbaOperationsConsoleComponent,
  name: 'NBA Operations',
  icon: 'monitor_heart',
  color: 'primary',
})
export class NbaOperationsConsoleComponent {
  readonly #destroyRef = inject(DestroyRef);
  readonly config = resolveConfig(inject(ActivatedRoute).snapshot.data['console']);
  readonly runStatus = signal<MiniRunStatus>('idle');
  readonly canRunMiniJourney = this.config.key === 'operations';
  readonly runBadge = computed(() => {
    if (this.runStatus() === 'running') {
      return { title: 'Đang chạy demo', color: 'info' as const, icon: 'sync' };
    }
    if (this.runStatus() === 'complete') {
      return { title: 'Demo hoàn tất', color: 'success' as const, icon: 'task_alt' };
    }
    return { title: 'Sẵn sàng', color: 'secondary' as const, icon: 'play_circle' };
  });

  readonly tableOption: SdTableOption<ConsoleStage> = {
    type: 'local',
    key: `startflow.nba.console.${this.config.key}`,
    items: () => this.config.stages,
    columns: [
      { field: 'code', title: 'Mã', type: 'string', width: '120px', fixed: true },
      { field: 'name', title: 'Thành phần', type: 'string', minWidth: '220px' },
      {
        field: 'responsibility',
        title: 'Trách nhiệm',
        type: 'string',
        minWidth: '320px',
        cell: { truncate: { enable: true, type: 'tooltip' } },
      },
      {
        field: 'status',
        title: 'Mức sẵn sàng',
        type: 'string',
        width: '170px',
        useBadge: (value) => capabilityBadge(value),
      },
    ],
    index: { enabled: true, title: 'STT', width: '64px' },
    paginate: { hidden: true },
    config: { visible: true, resizable: true },
    style: { shadow: false },
  };

  startMiniRun(): void {
    if (!this.canRunMiniJourney || this.runStatus() === 'running') return;
    this.runStatus.set('running');
    timer(900)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.runStatus.set('complete'));
  }
}

function resolveConfig(value: unknown): ConsoleConfig {
  return typeof value === 'string' && value in CONSOLE_CONFIGS
    ? CONSOLE_CONFIGS[value as ConsoleKey]
    : CONSOLE_CONFIGS.operations;
}

function stage(
  code: string,
  name: string,
  responsibility: string,
  status: CapabilityStatus,
): ConsoleStage {
  return { code, name, responsibility, status };
}

function capability(
  title: string,
  value: string,
  hint: string,
  icon: string,
  color: ConsoleCapability['color'],
): ConsoleCapability {
  return { title, value, hint, icon, color };
}

function standardCapabilities(
  first: string,
  second: string,
  third: string,
  fourth: string,
): ConsoleCapability[] {
  return [
    capability('Phạm vi', first, 'Hiển thị theo contract demo', 'dashboard_customize', 'primary'),
    capability('Kiểm soát', second, 'Không thay đổi rule runtime', 'verified_user', 'info'),
    capability('An toàn', third, 'Dữ liệu nhạy cảm được giới hạn', 'security', 'success'),
    capability('Truy vết', fourth, 'Có trạng thái và lineage rõ ràng', 'history', 'secondary'),
  ];
}

function config(
  key: ConsoleKey,
  title: string,
  subtitle: string,
  sectionTitle: string,
  stages: ConsoleStage[],
  capabilities: ConsoleCapability[],
): ConsoleConfig {
  return { key, title, subtitle, sectionTitle, stages, capabilities };
}

function adminConfig(
  key: ConsoleKey,
  title: string,
  subtitle: string,
  stages: ConsoleStage[],
): ConsoleConfig {
  return config(
    key,
    title,
    subtitle,
    'Phạm vi cấu hình',
    stages,
    standardCapabilities('Admin only', 'Versioned', 'Read-safe', 'Auditable'),
  );
}

function capabilityBadge(value: unknown): {
  type: 'round';
  color: 'success' | 'info' | 'warning' | 'secondary';
  title: string;
} {
  if (value === 'connected') return { type: 'round', color: 'success', title: 'Đã kết nối' };
  if (value === 'demo-ready') return { type: 'round', color: 'info', title: 'Demo-ready' };
  if (value === 'planned') return { type: 'round', color: 'warning', title: 'Chờ rule/input' };
  if (value === 'not-configured') return { type: 'round', color: 'warning', title: 'Chưa cấu hình' };
  return { type: 'round', color: 'secondary', title: 'Chỉ đọc' };
}
