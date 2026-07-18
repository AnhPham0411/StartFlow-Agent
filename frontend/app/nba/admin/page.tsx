'use client';

/**
 * /nba/admin — chỉnh hệ số KPI, chạy batch nightly, huấn luyện lại mô hình.
 * Chỉ manager/admin thấy (nav đã lọc, backend cũng chặn bằng @Roles).
 *
 * Dùng design system trong app/globals.css (project KHÔNG có Tailwind).
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Play, Save } from 'lucide-react';

import { useAuth } from '@/src/auth/auth-context';
import { StartFlowApi } from '@/src/lib/api-client';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { Badge, type BadgeTone } from '@/src/components/ui/badge';

const PRODUCTS = ['the', 'vay', 'dautu', 'baohiem', 'taikhoan'] as const;
const PROD_LABEL: Record<string, string> = {
  the: 'Thẻ tín dụng', vay: 'Khoản vay', dautu: 'Đầu tư', baohiem: 'Bảo hiểm', taikhoan: 'Tài khoản',
};

/** Khớp CHECK constraint kpi_weights_multiplier_check trên DB. */
const KPI_MIN = 0.8;
const KPI_MAX = 1.5;

const AI_URL = process.env.NEXT_PUBLIC_AI_URL ?? 'http://localhost:8000';

type Status = 'idle' | 'running' | 'ok' | 'error';

export default function NbaAdminPage() {
  const { getAccessToken } = useAuth();
  const api = new StartFlowApi(getAccessToken);
  const month = new Date().toISOString().slice(0, 7);

  const [kpi, setKpi] = useState<Record<string, number>>(
    Object.fromEntries(PRODUCTS.map((p) => [p, 1.0])),
  );
  const [kpiStatus, setKpiStatus] = useState<Status>('idle');
  const [kpiError, setKpiError] = useState<string | null>(null);

  const [batchStatus, setBatchStatus] = useState<Status>('idle');
  const [batchResult, setBatchResult] = useState<unknown>(null);

  const [product, setProduct] = useState<string>('baohiem');
  const [retrainStatus, setRetrainStatus] = useState<Status>('idle');
  const [retrainResult, setRetrainResult] = useState<Record<string, unknown> | null>(null);

  const changed = PRODUCTS.filter((p) => (kpi[p] ?? 1) !== 1).length;

  async function saveKpi() {
    setKpiStatus('running'); setKpiError(null);
    try {
      await Promise.all(PRODUCTS.map((p) => api.nbaSetKpi(month, p, kpi[p] ?? 1.0)));
      setKpiStatus('ok');
      setTimeout(() => setKpiStatus('idle'), 2500);
    } catch (e) {
      setKpiStatus('error');
      setKpiError(e instanceof Error ? e.message : 'Không lưu được hệ số KPI');
    }
  }

  async function runBatch() {
    setBatchStatus('running'); setBatchResult(null);
    try {
      const res = await fetch(`${AI_URL}/batch/nightly`, { method: 'POST' });
      const body: unknown = await res.json();
      setBatchResult(body);
      setBatchStatus(res.ok ? 'ok' : 'error');
    } catch (e) {
      setBatchResult({ error: e instanceof Error ? e.message : String(e) });
      setBatchStatus('error');
    }
  }

  async function runRetrain() {
    setRetrainStatus('running'); setRetrainResult(null);
    try {
      const res = await fetch(`${AI_URL}/admin/retrain?product=${product}`, { method: 'POST' });
      const body = (await res.json()) as Record<string, unknown>;
      setRetrainResult(body);
      setRetrainStatus(res.ok ? 'ok' : 'error');
    } catch (e) {
      setRetrainResult({ error: e instanceof Error ? e.message : String(e) });
      setRetrainStatus('error');
    }
  }

  const metrics = retrainResult?.metrics as Record<string, unknown> | undefined;
  const gates = (metrics?.gates ?? retrainResult?.gates) as Record<string, string> | undefined;

  return (
    <>
      <PageHeader
        eyebrow="NBA · Quản lý"
        title="Vận hành hệ thống"
        description="Hệ số KPI · chạy pipeline hằng đêm · huấn luyện lại mô hình"
      />

      <div className="section-grid">
        <div className="stack">
          {/* ── KPI ──────────────────────────────────────────────────── */}
          <Panel>
            <PanelHeader
              eyebrow={`Tháng ${month}`}
              title="Hệ số ưu tiên sản phẩm"
              action={changed > 0 ? <Badge tone="warning">{changed} thay đổi</Badge> : undefined}
            />
            <PanelBody>
              <p className="subtle" style={{ marginTop: 0 }}>
                Hệ số nhân vào điểm khi xếp hạng đề xuất. Trên 1,00 là đẩy mạnh sản phẩm đó;
                dưới 1,00 là giảm ưu tiên. Giới hạn {KPI_MIN.toFixed(2)}–{KPI_MAX.toFixed(2)}.
              </p>

              {PRODUCTS.map((p) => {
                const value = kpi[p] ?? 1;
                return (
                  <div key={p} className="kpi-row">
                    <label htmlFor={`kpi-${p}`}>{PROD_LABEL[p]}</label>
                    <input
                      id={`kpi-${p}`}
                      type="range"
                      min={KPI_MIN}
                      max={KPI_MAX}
                      step={0.05}
                      value={value}
                      onChange={(e) => setKpi((prev) => ({ ...prev, [p]: Number(e.target.value) }))}
                    />
                    <span className={`kpi-row__value${value !== 1 ? ' kpi-row__value--changed' : ''}`}>
                      {value.toFixed(2)}
                    </span>
                  </div>
                );
              })}

              {kpiError && (
                <div className="banner banner--danger" style={{ marginTop: 14, marginBottom: 0 }}>
                  <AlertTriangle aria-hidden="true" />
                  <p>{kpiError}</p>
                </div>
              )}

              <button
                type="button"
                className="button button--primary"
                style={{ marginTop: 14 }}
                disabled={kpiStatus === 'running'}
                onClick={() => void saveKpi()}
              >
                {kpiStatus === 'ok' ? <CheckCircle2 aria-hidden="true" /> : <Save aria-hidden="true" />}
                {kpiStatus === 'running' ? 'Đang lưu…' : kpiStatus === 'ok' ? 'Đã lưu' : 'Lưu hệ số'}
              </button>
            </PanelBody>
          </Panel>

          {/* ── Retrain ──────────────────────────────────────────────── */}
          <Panel>
            <PanelHeader eyebrow="Mô hình" title="Huấn luyện lại" />
            <PanelBody>
              <p className="subtle" style={{ marginTop: 0 }}>
                Bộ trọng số mới chỉ được đưa vào dùng khi vượt cả bốn cửa kiểm định.
                Trượt bất kỳ cửa nào thì hệ thống giữ nguyên bộ đang chạy.
              </p>

              <div className="toolbar" style={{ marginBottom: 14 }}>
                <label className="visually-hidden" htmlFor="retrain-product">Sản phẩm</label>
                <select
                  id="retrain-product"
                  className="select"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                >
                  {PRODUCTS.map((p) => <option key={p} value={p}>{PROD_LABEL[p]}</option>)}
                </select>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={retrainStatus === 'running'}
                  onClick={() => void runRetrain()}
                >
                  <FlaskConical aria-hidden="true" />
                  {retrainStatus === 'running' ? 'Đang huấn luyện…' : 'Chạy huấn luyện'}
                </button>
              </div>

              {gates && (
                <div className="gate-row">
                  {Object.entries(gates).map(([name, verdict]) => (
                    <Badge key={name} tone={gateTone(verdict)}>
                      {name.toUpperCase()}: {verdict}
                    </Badge>
                  ))}
                </div>
              )}

              {retrainResult && (
                <pre className="result-box">{JSON.stringify(retrainResult, null, 2)}</pre>
              )}
            </PanelBody>
          </Panel>
        </div>

        {/* ── Batch ──────────────────────────────────────────────────── */}
        <div className="stack">
          <Panel>
            <PanelHeader eyebrow="Pipeline" title="Batch hằng đêm" />
            <PanelBody>
              <p className="subtle" style={{ marginTop: 0 }}>
                Chạy toàn bộ chuỗi xử lý: tổng hợp dữ liệu → chấm điểm → xếp hạng →
                soạn kịch bản → kiểm duyệt → ghi đề xuất mới.
              </p>
              <p className="field-help" style={{ marginBottom: 14 }}>
                Đề xuất chỉ được thêm mới, không ghi đè bản cũ — lịch sử luôn truy vết được.
              </p>

              <button
                type="button"
                className="button button--primary button--full"
                disabled={batchStatus === 'running'}
                onClick={() => void runBatch()}
              >
                <Play aria-hidden="true" />
                {batchStatus === 'running' ? 'Đang chạy…' : 'Chạy batch ngay'}
              </button>

              {batchStatus === 'error' && (
                <div className="banner banner--danger" style={{ marginTop: 14, marginBottom: 0 }}>
                  <AlertTriangle aria-hidden="true" />
                  <p>Batch thất bại. Xem chi tiết bên dưới.</p>
                </div>
              )}

              {batchResult != null && (
                <pre className="result-box" style={{ marginTop: 14 }}>
                  {JSON.stringify(batchResult, null, 2)}
                </pre>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}

function gateTone(verdict: string): BadgeTone {
  if (verdict === 'PASS') return 'success';
  if (verdict === 'FAIL') return 'danger';
  return 'neutral';
}
