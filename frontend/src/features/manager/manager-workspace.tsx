'use client';

import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import rawCatalog from '@/src/data/agent-catalog.json';
import rawDemoDatabase from '@/src/data/synthetic-banking-demo.json';
import { useAuth } from '@/src/auth/auth-context';
import { RoleGate } from '@/src/auth/role-gate';
import { Badge } from '@/src/components/ui/badge';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';

interface ManagerStatus {
  runtime: {
    online: boolean;
    mode: string;
    model: string;
    slurmJobId: string | null;
    observedAt: string | null;
    models: Array<{ coreId?: string; modelId?: string; status?: string }>;
  };
  queue: { pending: number; running: number; completed: number; approvals: number; failed: number };
  demoDatabase: { synthetic: boolean; version: string; records: number; staff: number; sourceRows: number; sourceTables: number };
  observedAt: string;
}

const domains = Array.from(
  rawCatalog.agents.reduce((map, agent) => {
    map.set(agent.domain, (map.get(agent.domain) ?? 0) + 1);
    return map;
  }, new Map<string, number>()),
).map(([name, count]) => ({ name: name.replaceAll('_', ' '), count }));
const demoStaff = rawDemoDatabase.staff;
const seedDataset = rawDemoDatabase.sourceDatasets[0] ?? { insertRows: 0, tables: 0 };

export function ManagerWorkspace() {
  const { getAccessToken } = useAuth();
  const [status, setStatus] = useState<ManagerStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/manager/status', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setStatus((await response.json()) as ManagerStatus);
    } catch {
      setStatus(null);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const active = useMemo(() => status?.queue.running ?? 0, [status]);
  return (
    <RoleGate
      allow={['admin']}
      fallback={<div className="centered-state"><AlertTriangle /><h1>Chỉ manager được truy cập</h1><p className="muted">Tài khoản banker không có quyền xem vận hành và năng lực agent.</p></div>}
    >
      <PageHeader
        eyebrow="Manager operations"
        title="Năng lực và hàng đợi"
        description="Theo dõi GPU runtime, công việc, approval và 128 agent logic; không hiển thị nội dung file khách hàng."
        actions={<Badge tone={status?.runtime.online ? 'success' : 'warning'}>{status?.runtime.online ? 'GPU online' : 'GPU chưa nối'}</Badge>}
      />
      <section className="card-grid manager-metrics" aria-label="Chỉ số vận hành">
        <article className="panel metric-card"><Bot /><p className="metric-value">128</p><p className="metric-label">AI agents</p></article>
        <article className="panel metric-card"><Activity /><p className="metric-value">{active}</p><p className="metric-label">Đang thực thi</p></article>
        <article className="panel metric-card metric-card--attention"><Clock3 /><p className="metric-value">{status?.queue.approvals ?? 0}</p><p className="metric-label">Chờ phê duyệt</p></article>
        <article className="panel metric-card"><CheckCircle2 /><p className="metric-value">{status?.queue.completed ?? 0}</p><p className="metric-label">Đã hoàn tất</p></article>
      </section>
      <div className="manager-layout">
        <Panel>
          <PanelHeader title="AI workforce theo domain" eyebrow="16 controlled domains" />
          <div className="manager-domain-grid">
            {domains.map((domain) => <article key={domain.name}><UsersRound /><div><strong>{domain.name}</strong><span>{domain.count} agents · sẵn sàng định tuyến</span></div></article>)}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="GPU runtime" eyebrow="HPC only" />
          <PanelBody>
            <dl className="manager-runtime-list">
              <div><dt>Trạng thái</dt><dd>{status?.runtime.online ? 'Online' : 'Offline / pending'}</dd></div>
              <div><dt>Model</dt><dd>{status?.runtime.model ?? 'Đang kiểm tra'}</dd></div>
              <div><dt>Runtime</dt><dd>{status?.runtime.mode ?? '—'}</dd></div>
              <div><dt>Slurm job</dt><dd>{status?.runtime.slurmJobId ?? '—'}</dd></div>
              <div><dt>Queue</dt><dd>{status?.queue.pending ?? 0} chờ · {status?.queue.failed ?? 0} lỗi</dd></div>
            </dl>
            {status?.runtime.models.length ? (
              <div className="manager-model-list">
                {status.runtime.models.map((model, index) => (
                  <article key={`${model.coreId}:${model.modelId}:${index}`}>
                    <div>
                      <strong>{model.coreId ?? 'Core service'}</strong>
                      <span>{model.modelId ?? 'deterministic runtime'}</span>
                    </div>
                    <Badge tone={model.status === 'preloaded' ? 'success' : 'info'}>
                      {model.status ?? 'registered'}
                    </Badge>
                  </article>
                ))}
              </div>
            ) : null}
          </PanelBody>
        </Panel>
      </div>
      <Panel className="manager-workforce">
        <PanelHeader
          title="Nhân lực và tải công việc demo"
          eyebrow={`${status?.demoDatabase.records ?? rawDemoDatabase.records.length} synthetic records · không phải dữ liệu thật`}
        />
        <div className="manager-demo-database-note">
          <Database aria-hidden="true" />
          <span>
            CSDL ảo phiên bản {status?.demoDatabase.version ?? rawDemoDatabase.version} giúp trình diễn
            policy RAG, lead scoring, KYC, giao dịch và workload. Projection an toàn từ seed_20k gồm{' '}
            {status?.demoDatabase.sourceRows?.toLocaleString('vi-VN') ?? seedDataset.insertRows.toLocaleString('vi-VN')}{' '}
            dòng / {status?.demoDatabase.sourceTables ?? seedDataset.tables} bảng và không đưa dữ liệu định danh vào phản hồi.
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nhân sự tổng hợp</th><th>Đội</th><th>Trạng thái</th><th>Đang xử lý</th><th>Hoàn tất hôm nay</th></tr></thead>
            <tbody>
              {demoStaff.map((member) => (
                <tr key={member.id}>
                  <td data-label="Nhân sự"><strong>{member.name}</strong><br /><span className="muted">{member.role}</span></td>
                  <td data-label="Đội">{member.team}</td>
                  <td data-label="Trạng thái"><Badge tone={member.status === 'escalated' ? 'warning' : member.status === 'approval' ? 'info' : 'success'}>{member.status}</Badge></td>
                  <td data-label="Đang xử lý">{member.activeCases}</td>
                  <td data-label="Hoàn tất hôm nay">{member.completedToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </RoleGate>
  );
}
