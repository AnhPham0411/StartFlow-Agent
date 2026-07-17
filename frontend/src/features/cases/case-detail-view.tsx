'use client';

import { ArrowRight, Play, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { EmptyState } from '@/src/components/ui/empty-state';
import { ErrorState } from '@/src/components/ui/error-state';
import { LoadingState } from '@/src/components/ui/loading-state';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { StatusBadge } from '@/src/components/ui/status-badge';
import { formatCurrency, formatDateTime } from '@/src/lib/format';
import type { CaseDetail } from '@/src/lib/models';
import { useStartFlowApi } from '@/src/lib/use-api';

export function CaseDetailView({ caseId }: { caseId: string }) {
  const api = useStartFlowApi();
  const router = useRouter();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      setData(await api.getCase(caseId));
    } catch {
      setError('Không tìm thấy hồ sơ hoặc bạn không có quyền truy cập.');
    } finally {
      setLoading(false);
    }
  }, [api, caseId]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  async function startRun() {
    setStarting(true);
    setError(null);
    try {
      const result = await api.createRun(caseId);
      router.push(`/runs/${result.runId}`);
    } catch {
      setError('Không thể bắt đầu đánh giá. Kiểm tra trạng thái backend rồi thử lại.');
      setStarting(false);
    }
  }
  if (loading) return <LoadingState label="Đang dựng lại hồ sơ…" />;
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return null;
  const runs = data.runs ?? [];
  return (
    <>
      <PageHeader
        eyebrow={`DEMO_DATA · ${data.registrationNumber}`}
        title={data.companyName}
        description={`${formatCurrency(data.requestedAmount)} · ${data.purpose}`}
        actions={
          <Button onClick={() => void startRun()} disabled={starting}>
            <Play aria-hidden="true" />
            {starting ? 'Đang khởi tạo…' : 'Bắt đầu đánh giá'}
          </Button>
        }
      />
      {error ? (
        <div className="banner banner--danger" role="alert">
          <p>{error}</p>
          <Button variant="ghost" onClick={() => setError(null)}>
            <RotateCcw aria-hidden="true" /> Đóng
          </Button>
        </div>
      ) : null}
      <div className="section-grid">
        <Panel>
          <PanelHeader title="Lịch sử đánh giá" eyebrow="Immutable snapshots" />
          {runs.length === 0 ? (
            <EmptyState
              title="Hồ sơ chưa được đánh giá"
              description="Bắt đầu đánh giá để Planner tạo ba luồng chuyên gia."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lượt chạy</th>
                    <th>Trạng thái</th>
                    <th>Kết luận</th>
                    <th>Thời điểm</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td data-label="Lượt chạy" className="utility">
                        #{run.id.slice(0, 8)}
                      </td>
                      <td data-label="Trạng thái">
                        <StatusBadge status={run.status} />
                      </td>
                      <td data-label="Kết luận">
                        {run.finalDecisionStatus ? (
                          <StatusBadge status={run.finalDecisionStatus} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Thời điểm">{formatDateTime(run.createdAt)}</td>
                      <td>
                        <Link aria-label={`Mở lượt ${run.id}`} href={`/runs/${run.id}`}>
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="list-stack">
          <Panel>
            <PanelHeader title="Ảnh chụp tài chính" eyebrow="Snapshot" />
            <PanelBody>
              <dl>
                {Object.entries(data.financials).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderBottom: '1px solid var(--line)',
                      padding: '8px 0',
                    }}
                  >
                    <dt className="muted">{key}</dt>
                    <dd style={{ margin: 0, fontWeight: 650 }}>{formatCurrency(value)}</dd>
                  </div>
                ))}
              </dl>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader
              title="Tài liệu đã nộp"
              eyebrow={`${data.submittedDocuments.length} documents`}
            />
            <PanelBody>
              {data.submittedDocuments.length ? (
                <ul className="condition-list">
                  {data.submittedDocuments.map((document) => (
                    <li key={document}>{document}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Chưa có tài liệu nào được ghi nhận.</p>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
