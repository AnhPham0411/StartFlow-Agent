import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { SdBadge } from '@sdcorejs/angular/components/badge';
import { SdButton } from '@sdcorejs/angular/components/button';
import { SdSection } from '@sdcorejs/angular/components/section';
import {
  SdTable,
  SdTableCellDefDirective,
  type SdTableOption,
} from '@sdcorejs/angular/components/table';
import { SdPageComponent } from '@sdcorejs/angular/modules/layout';
import { SdPermissionDirective } from '@sdcorejs/angular/modules/permission';
import type { Color } from '@sdcorejs/utils/models';
import type { KnowledgeDocument } from '../../core/api/models';
import { StartFlowApiService } from '../../core/api/startflow-api.service';
import { STARTFLOW_PERMISSIONS } from '../../core/auth/permission-map';
import { formatDateTime } from '../../shared/formatters';
import { EmptyStateComponent } from '../../shared/states/empty-state.component';
import { ErrorStateComponent } from '../../shared/states/error-state.component';
import { LoadingStateComponent } from '../../shared/states/loading-state.component';
import { statusPresentation } from '../../shared/status-presentation';
import { IngestDrawerComponent } from './ingest-drawer.component';

interface KnowledgeRow {
  id: string;
  shortId: string;
  title: string;
  domainLabel: string;
  chunkDisplay: string;
  statusLabel: string;
  statusColor: Color;
  createdAtDisplay: string;
}

@Component({
  selector: 'app-knowledge',
  imports: [
    SdBadge,
    SdButton,
    SdPageComponent,
    SdPermissionDirective,
    SdSection,
    SdTable,
    SdTableCellDefDirective,
    EmptyStateComponent,
    ErrorStateComponent,
    IngestDrawerComponent,
    LoadingStateComponent,
  ],
  templateUrl: './knowledge.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeComponent implements OnInit {
  readonly #api = inject(StartFlowApiService);
  private readonly table = viewChild(SdTable<KnowledgeRow>);
  private readonly ingestDrawer = viewChild.required(IngestDrawerComponent);

  readonly permissions = STARTFLOW_PERMISSIONS;
  readonly documents = signal<KnowledgeDocument[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly rows = computed<KnowledgeRow[]>(() =>
    this.documents().map((document) => {
      const presentation = statusPresentation(document.status ?? 'READY');
      return {
        id: document.id,
        shortId: document.id.slice(0, 8),
        title: document.title,
        domainLabel: domainLabel(document.domain),
        chunkDisplay: document.chunkCount === undefined ? '—' : `${document.chunkCount}`,
        statusLabel: presentation.label,
        statusColor: presentation.color,
        createdAtDisplay: formatDateTime(document.createdAt),
      };
    }),
  );

  readonly knowledgeTableOption: SdTableOption<KnowledgeRow> = {
    type: 'local',
    items: () => this.rows(),
    selector: { visible: false },
    paginate: { hidden: true },
    columns: [
      { field: 'title', title: 'Tài liệu', type: 'string', minWidth: '260px' },
      { field: 'domainLabel', title: 'Lĩnh vực', type: 'string', minWidth: '130px' },
      { field: 'chunkDisplay', title: 'Số đoạn', type: 'string', width: '100px' },
      { field: 'statusLabel', title: 'Trạng thái', type: 'string', minWidth: '140px' },
      {
        field: 'createdAtDisplay',
        title: 'Ngày tạo',
        type: 'string',
        minWidth: '160px',
      },
    ],
  };

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.documents.set(await this.#api.listKnowledge());
      const table = this.table();
      if (table) await table.reload(true, false);
    } catch {
      this.documents.set([]);
      this.error.set('Không tải được thư viện tri thức demo.');
    } finally {
      this.loading.set(false);
    }
  }

  openIngestDrawer(): void {
    this.ingestDrawer().open();
  }

  async onIngested(): Promise<void> {
    await this.load();
  }
}

function domainLabel(domain: string): string {
  switch (domain.toUpperCase()) {
    case 'CREDIT':
      return 'Tín dụng';
    case 'COMPLIANCE':
      return 'Tuân thủ';
    case 'OPERATIONS':
      return 'Vận hành';
    default:
      return domain || 'Không xác định';
  }
}
