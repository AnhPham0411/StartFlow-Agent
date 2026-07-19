'use client';

import { ArrowRight, Clock3, FileStack, Plus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/src/components/ui/empty-state';
import { ErrorState } from '@/src/components/ui/error-state';
import { LoadingState } from '@/src/components/ui/loading-state';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { StatusBadge } from '@/src/components/ui/status-badge';
import { demoCreditCases } from '@/src/data/demo-credit-cases';
import { listStoredDemoCases } from '@/src/lib/demo-case-store';
import { formatCurrency, formatDateTime } from '@/src/lib/format';
import type { CaseSummary } from '@/src/lib/models';
import { useStartFlowApi } from '@/src/lib/use-api';

export function DashboardView() {
  const api = useStartFlowApi();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      setCases([...listStoredDemoCases(), ...(await api.listCases())]);
    } catch {
      setCases([...listStoredDemoCases(), ...demoCreditCases]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const metrics = useMemo(() => {
    const runs = cases.flatMap((item) => (item.latestRun ? [item.latestRun] : []));
    return {
      cases: cases.length,
      active: runs.filter((run) => ['PENDING', 'PLANNING', 'RUNNING'].includes(run.status)).length,
      approvals: runs.filter((run) => run.status === 'AWAITING_APPROVAL').length,
      complete: runs.filter((run) => ['COMPLETED', 'PARTIAL'].includes(run.status)).length,
    };
  }, [cases]);

  return (
    <>
      <PageHeader
        eyebrow="Decision operations"
        title="Trung tâm đánh giá tín dụng"
        description="Quan sát hồ sơ, lượt chạy và các quyết định đang cần con người xử lý."
        actions={
          <Link className="button button--primary" href="/cases/new">
            <Plus aria-hidden="true" /> Tạo hồ sơ demo
          </Link>
        }
      />
      {loading ? (
        <LoadingState label="Đang tổng hợp hàng đợi…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <section className="card-grid" aria-label="Chỉ số vận hành">
            <article className="panel metric-card">
              <FileStack aria-hidden="true" />
              <p className="metric-value">{metrics.cases}</p>
              <p className="metric-label">Hồ sơ demo</p>
            </article>
            <article className="panel metric-card">
              <Clock3 aria-hidden="true" />
              <p className="metric-value">{metrics.active}</p>
              <p className="metric-label">Đang được phân tích</p>
            </article>
            <article className="panel metric-card metric-card--attention">
              <ShieldCheck aria-hidden="true" />
              <p className="metric-value">{metrics.approvals}</p>
              <p className="metric-label">Chờ phê duyệt</p>
            </article>
            <article className="panel metric-card">
              <span className="utility">DONE</span>
              <p className="metric-value">{metrics.complete}</p>
              <p className="metric-label">Đã có kết luận</p>
            </article>
          </section>
          <div className="section-grid">
            <Panel>
              <PanelHeader
                title="Lượt đánh giá gần đây"
                eyebrow="Persisted runs"
                action={<Link href="/cases">Xem tất cả</Link>}
              />
              {cases.length === 0 ? (
                <EmptyState
                  title="Chưa có hồ sơ"
                  description="Tạo hồ sơ demo để chạy đánh giá đa tác nhân đầu tiên."
                  action={{ label: 'Tạo hồ sơ demo', href: '/cases/new' }}
                />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Doanh nghiệp</th>
                        <th>Khoản vay</th>
                        <th>Trạng thái</th>
                        <th>Cập nhật</th>
                        <th>
                          <span className="visually-hidden">Mở</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.slice(0, 8).map((item) => (
                        <tr key={item.id}>
                          <td data-label="Doanh nghiệp">
                            <strong>{item.companyName}</strong>
                            <div className="utility muted">{item.registrationNumber}</div>
                          </td>
                          <td data-label="Khoản vay">{formatCurrency(item.requestedAmount)}</td>
                          <td data-label="Trạng thái">
                            {item.latestRun ? (
                              <StatusBadge status={item.latestRun.status} />
                            ) : (
                              <span className="muted">Chưa chạy</span>
                            )}
                          </td>
                          <td data-label="Cập nhật" className="nowrap">
                            {formatDateTime(item.latestRun?.createdAt ?? item.createdAt)}
                          </td>
                          <td>
                            <Link
                              aria-label={`Mở hồ sơ ${item.companyName}`}
                              href={`/cases/${item.id}`}
                            >
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
            <Panel>
              <PanelHeader title="Bước tiếp theo" eyebrow="Operator focus" />
              <PanelBody>
                {metrics.approvals > 0 ? (
                  <>
                    <h3>{metrics.approvals} quyết định đang chờ</h3>
                    <p className="muted">
                      Mở lượt đánh giá, đọc conflicts và căn cứ trước khi phê duyệt hành động.
                    </p>
                  </>
                ) : (
                  <>
                    <h3>Hàng đợi đang thông suốt</h3>
                    <p className="muted">Không có hành động nhạy cảm nào đang chờ phê duyệt.</p>
                  </>
                )}
                <Link className="button button--secondary button--full" href="/cases">
                  Mở hàng đợi hồ sơ <ArrowRight aria-hidden="true" />
                </Link>
              </PanelBody>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
