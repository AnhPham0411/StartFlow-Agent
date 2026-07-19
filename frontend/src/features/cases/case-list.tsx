'use client';

import { ArrowRight, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/src/components/ui/empty-state';
import { ErrorState } from '@/src/components/ui/error-state';
import { LoadingState } from '@/src/components/ui/loading-state';
import { PageHeader } from '@/src/components/ui/page-header';
import { StatusBadge } from '@/src/components/ui/status-badge';
import { demoCreditCases } from '@/src/data/demo-credit-cases';
import { formatCurrency, formatDateTime } from '@/src/lib/format';
import type { CaseSummary } from '@/src/lib/models';
import { useStartFlowApi } from '@/src/lib/use-api';

export function CaseList() {
  const api = useStartFlowApi();
  const [items, setItems] = useState<CaseSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listCases());
    } catch {
      setItems(demoCreditCases);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        `${item.companyName} ${item.registrationNumber}`
          .toLocaleLowerCase('vi')
          .includes(query.toLocaleLowerCase('vi')),
      ),
    [items, query],
  );

  return (
    <>
      <PageHeader
        eyebrow="Case workspace"
        title="Hồ sơ doanh nghiệp"
        description="Tất cả dữ liệu ở đây đều là DEMO_DATA, không chứa thông tin khách hàng thật."
        actions={
          <Link className="button button--primary" href="/cases/new">
            <Plus aria-hidden="true" /> Tạo hồ sơ demo
          </Link>
        }
      />
      <div className="form-field" style={{ maxWidth: 460, marginBottom: 16 }}>
        <label htmlFor="case-search">Tìm hồ sơ</label>
        <div style={{ position: 'relative' }}>
          <Search
            aria-hidden="true"
            style={{ position: 'absolute', left: 12, top: 12, width: 19 }}
          />
          <input
            className="input"
            id="case-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tên doanh nghiệp hoặc mã đăng ký"
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={items.length ? 'Không tìm thấy hồ sơ phù hợp' : 'Chưa có hồ sơ'}
          description={
            items.length
              ? 'Thử tên doanh nghiệp hoặc mã đăng ký khác.'
              : 'Tạo hồ sơ demo để bắt đầu luồng đánh giá.'
          }
          action={items.length ? undefined : { label: 'Tạo hồ sơ demo', href: '/cases/new' }}
        />
      ) : (
        <div className="list-stack">
          {filtered.map((item) => (
            <Link className="panel list-card" href={`/cases/${item.id}`} key={item.id}>
              <div>
                <p className="eyebrow">DEMO_DATA · {item.registrationNumber}</p>
                <h2>{item.companyName}</h2>
                <p className="muted">{item.purpose}</p>
                <div className="inline-meta">
                  <span>{formatCurrency(item.requestedAmount)}</span>
                  <span>{item.runCount ?? (item.latestRun ? 1 : 0)} lượt đánh giá</span>
                  <span>Tạo {formatDateTime(item.createdAt)}</span>
                </div>
              </div>
              <div>
                {item.latestRun ? (
                  <StatusBadge status={item.latestRun.status} />
                ) : (
                  <span className="badge badge--neutral">Chưa đánh giá</span>
                )}
                <ArrowRight aria-hidden="true" style={{ margin: '15px 0 0 auto' }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
