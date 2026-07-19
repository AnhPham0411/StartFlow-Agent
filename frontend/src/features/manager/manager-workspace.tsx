'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/src/auth/auth-context';
import { RoleGate } from '@/src/auth/role-gate';
import { Badge } from '@/src/components/ui/badge';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import {
  demoManagerStaff,
  summarizeManagerStaff,
  summarizeStaffTeams,
  type DemoStaffMember,
  type StaffStatus,
} from '@/src/data/demo-manager-staff';

interface ManagerStaffResponse {
  staff?: DemoStaffMember[];
  observedAt?: string;
}

const statusLabels: Record<StaffStatus, string> = {
  available: 'Sẵn sàng',
  reviewing: 'Đang xử lý',
  approval: 'Đang phê duyệt',
  'support-needed': 'Cần hỗ trợ',
};

function statusTone(status: StaffStatus): 'success' | 'info' | 'warning' {
  if (status === 'available') return 'success';
  if (status === 'support-needed') return 'warning';
  return 'info';
}

function isDemoStaff(value: unknown): value is DemoStaffMember[] {
  return Array.isArray(value) && value.length > 0 && value.every((member) => (
    typeof member === 'object' &&
    member !== null &&
    typeof (member as DemoStaffMember).id === 'string' &&
    typeof (member as DemoStaffMember).name === 'string' &&
    typeof (member as DemoStaffMember).activeCases === 'number'
  ));
}

export function ManagerWorkspace() {
  const { getAccessToken } = useAuth();
  const [staff, setStaff] = useState<DemoStaffMember[]>(demoManagerStaff);
  const [usingFallback, setUsingFallback] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/manager/status', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Manager staff unavailable');
      const payload = (await response.json()) as ManagerStaffResponse;
      if (!isDemoStaff(payload.staff)) throw new Error('Invalid manager staff response');
      setStaff(payload.staff);
      setUsingFallback(false);
    } catch {
      setStaff(demoManagerStaff);
      setUsingFallback(true);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeManagerStaff(staff), [staff]);
  const teams = useMemo(() => summarizeStaffTeams(staff), [staff]);
  const attention = useMemo(
    () => staff.filter((member) => member.status === 'support-needed' || member.pendingApprovals > 0),
    [staff],
  );

  return (
    <RoleGate
      allow={['admin']}
      fallback={<div className="centered-state"><AlertTriangle /><h1>Chỉ manager được truy cập</h1><p className="muted">Tài khoản banker không có quyền xem thông tin quản lý nhân sự.</p></div>}
    >
      <PageHeader
        eyebrow="Manager workspace"
        title="Quản lý nhân sự"
        description="Theo dõi khối lượng công việc, hiệu suất và các phê duyệt cần xử lý của đội ngũ ngân hàng."
        actions={<Badge tone={usingFallback ? 'info' : 'success'}>{usingFallback ? 'Dữ liệu mô phỏng' : 'Đã đồng bộ'}</Badge>}
      />

      <section className="card-grid manager-metrics" aria-label="Tổng quan nhân sự">
        <article className="panel metric-card"><UsersRound /><p className="metric-value">{summary.total}</p><p className="metric-label">Nhân sự</p></article>
        <article className="panel metric-card"><Activity /><p className="metric-value">{summary.workloadPercent}%</p><p className="metric-label">Tải công việc</p></article>
        <article className="panel metric-card metric-card--attention"><Clock3 /><p className="metric-value">{summary.pendingApprovals}</p><p className="metric-label">Chờ phê duyệt</p></article>
        <article className="panel metric-card"><CheckCircle2 /><p className="metric-value">{summary.completedToday}</p><p className="metric-label">Hoàn tất hôm nay</p></article>
      </section>

      <div className="manager-layout">
        <Panel>
          <PanelHeader title="Tổng quan theo đội ngũ" eyebrow={`${teams.length} phòng ban · ${summary.activeCases} hồ sơ đang xử lý`} />
          <div className="manager-domain-grid">
            {teams.map((team) => (
              <article key={team.name}>
                <UsersRound aria-hidden="true" />
                <div>
                  <strong>{team.name}</strong>
                  <span>{team.members} nhân sự · {team.activeCases} đang xử lý · {team.completedToday} hoàn tất</span>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Việc cần chú ý" eyebrow={`${attention.length} nhân sự cần theo dõi`} />
          <PanelBody>
            {attention.length ? (
              <dl className="manager-runtime-list">
                {attention.map((member) => (
                  <div key={member.id}>
                    <dt><strong>{member.name}</strong><br /><span className="muted">{member.team}</span></dt>
                    <dd>
                      {member.status === 'support-needed'
                        ? `Tải ${member.activeCases}/${member.capacity}`
                        : `${member.pendingApprovals} chờ duyệt`}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : <p className="muted">Không có nhân sự cần hỗ trợ hoặc tác vụ chờ duyệt.</p>}
          </PanelBody>
        </Panel>
      </div>

      <Panel className="manager-workforce">
        <PanelHeader
          title="Nhân sự và hiệu suất hôm nay"
          eyebrow={`Dữ liệu mô phỏng · SLA trung bình ${summary.averageSlaPercent}%`}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Phòng ban</th>
                <th>Trạng thái</th>
                <th>Khối lượng</th>
                <th>Hoàn tất</th>
                <th>SLA</th>
                <th>Chờ duyệt</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <td data-label="Nhân sự"><strong>{member.name}</strong><br /><span className="muted">{member.role}</span></td>
                  <td data-label="Phòng ban">{member.team}</td>
                  <td data-label="Trạng thái"><Badge tone={statusTone(member.status)}>{statusLabels[member.status]}</Badge></td>
                  <td data-label="Khối lượng">{member.activeCases}/{member.capacity}</td>
                  <td data-label="Hoàn tất">{member.completedToday}</td>
                  <td data-label="SLA">{member.slaPercent}%</td>
                  <td data-label="Chờ duyệt">{member.pendingApprovals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </RoleGate>
  );
}
