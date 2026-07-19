'use client';

import { GitCompareArrows, Play } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { EmptyState } from '@/src/components/ui/empty-state';
import { ErrorState } from '@/src/components/ui/error-state';
import { LoadingState } from '@/src/components/ui/loading-state';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { demoCreditCases } from '@/src/data/demo-credit-cases';
import type { CaseSummary, ComparisonResult } from '@/src/lib/models';
import { useStartFlowApi } from '@/src/lib/use-api';

const metricLabels: Record<string, string> = {
  completeness: 'Độ đầy đủ',
  citationCoverage: 'Phủ căn cứ',
  toolUse: 'Sử dụng công cụ',
  conflictDetection: 'Phát hiện xung đột',
  latency: 'Độ trễ',
  rubricScore: 'Điểm rubric',
};

export function ComparisonView() {
  const api = useStartFlowApi();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [caseId, setCaseId] = useState('');
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const items = await api.listCases();
      setCases(items);
      setCaseId((current) => current || items[0]?.id || '');
    } catch {
      setCases(demoCreditCases);
      setCaseId((current) => current || demoCreditCases[0]?.id || '');
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  async function compare() {
    if (!caseId) return;
    setRunning(true);
    setError(null);
    try {
      setResult(await api.createComparison(caseId));
    } catch {
      setError('Không thể chạy baseline single-agent. Hãy kiểm tra trạng thái hồ sơ và thử lại.');
    } finally {
      setRunning(false);
    }
  }
  const maxByMetric = useMemo(
    () =>
      new Map(
        result?.metrics.map((metric) => [
          metric.name,
          Math.max(metric.singleAgent, metric.multiAgent, 1),
        ]) ?? [],
      ),
    [result],
  );
  return (
    <>
      <PageHeader
        eyebrow="Same snapshot · fair rubric"
        title="Single-agent và Multi-agent"
        description="So sánh hai cách xử lý trên cùng ảnh chụp hồ sơ theo sáu metric cố định."
      />
      {loading ? (
        <LoadingState />
      ) : error && !cases.length ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : cases.length === 0 ? (
        <EmptyState
          title="Chưa có hồ sơ để so sánh"
          description="Tạo và chạy một hồ sơ demo trước khi mở baseline."
          action={{ label: 'Tạo hồ sơ demo', href: '/cases/new' }}
        />
      ) : (
        <>
          {error ? (
            <div className="banner banner--danger" role="alert">
              <p>{error}</p>
            </div>
          ) : null}
          <Panel>
            <PanelHeader title="Chọn hồ sơ" eyebrow="Comparison setup" />
            <PanelBody>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="comparison-case">Hồ sơ nguồn</label>
                  <select
                    className="select"
                    id="comparison-case"
                    value={caseId}
                    onChange={(event) => {
                      setCaseId(event.target.value);
                      setResult(null);
                    }}
                  >
                    {cases.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.companyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field" style={{ alignSelf: 'end' }}>
                  <Button onClick={() => void compare()} disabled={running}>
                    <Play aria-hidden="true" />
                    {running ? 'Đang chạy baseline…' : 'Chạy phép so sánh'}
                  </Button>
                </div>
              </div>
            </PanelBody>
          </Panel>
          {result ? (
            <Panel className="comparison-result">
              <PanelHeader
                title="Kết quả cùng snapshot"
                eyebrow={`COMPARISON #${result.id.slice(0, 8)}`}
                action={<GitCompareArrows aria-hidden="true" />}
              />
              <PanelBody>
                {result.metrics.length ? (
                  <div className="comparison-grid" role="table" aria-label="So sánh sáu metric">
                    <div className="comparison-row utility muted" role="row">
                      <span>METRIC</span>
                      <span>SINGLE-AGENT</span>
                      <span>MULTI-AGENT</span>
                      <span>UNIT</span>
                    </div>
                    {result.metrics.map((metric) => {
                      const max = maxByMetric.get(metric.name) ?? 1;
                      return (
                        <div className="comparison-row" role="row" key={metric.name}>
                          <strong>{metricLabels[metric.name] ?? metric.name}</strong>
                          <div
                            className="bar-track"
                            aria-label={`Single-agent ${metric.singleAgent} ${metric.unit}`}
                          >
                            <div
                              className="bar"
                              style={{ width: `${(metric.singleAgent / max) * 100}%` }}
                            >
                              {metric.singleAgent}
                            </div>
                          </div>
                          <div
                            className="bar-track"
                            aria-label={`Multi-agent ${metric.multiAgent} ${metric.unit}`}
                          >
                            <div
                              className="bar bar--multi"
                              style={{ width: `${(metric.multiAgent / max) * 100}%` }}
                            >
                              {metric.multiAgent}
                            </div>
                          </div>
                          <span className="utility muted">{metric.unit}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="banner banner--info">
                    <p>
                      <strong>Đã khởi tạo hai lượt chạy trên cùng snapshot.</strong> Mở từng
                      timeline để theo dõi; bảng metric sẽ khả dụng khi backend hoàn tất evaluation.
                    </p>
                  </div>
                )}
                {result.singleAgentRunId && result.multiAgentRunId ? (
                  <div className="page-actions" style={{ marginTop: 16 }}>
                    <Link
                      className="button button--secondary"
                      href={`/runs/${result.singleAgentRunId}`}
                    >
                      Mở single-agent
                    </Link>
                    <Link
                      className="button button--primary"
                      href={`/runs/${result.multiAgentRunId}`}
                    >
                      Mở multi-agent
                    </Link>
                  </div>
                ) : null}
                <div className="banner banner--info" style={{ marginTop: 20 }}>
                  <p>
                    <strong>Cách đọc:</strong> các metric chất lượng cao hơn là tốt hơn; riêng
                    latency cần đọc cùng đơn vị thời gian. Đây là phép đo demo, không phải mô hình
                    phê duyệt tín dụng.
                  </p>
                </div>
              </PanelBody>
            </Panel>
          ) : null}
        </>
      )}
    </>
  );
}
