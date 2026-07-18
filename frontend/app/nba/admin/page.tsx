'use client';
/**
 * /nba/admin — quản lý call list + KPI slider + nút chạy batch + kết quả retrain.
 * Chỉ manager/admin thấy (nav đã lọc).
 */
import { useState } from 'react';
import { useAuth } from '@/src/auth/auth-context';
import { StartFlowApi } from '@/src/lib/api-client';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel } from '@/src/components/ui/panel';

const PRODUCTS = ['the', 'vay', 'dautu', 'baohiem', 'taikhoan'];
const PROD_LABEL: Record<string, string> = {
  the: 'Thẻ tín dụng', vay: 'Vay', dautu: 'Đầu tư', baohiem: 'Bảo hiểm', taikhoan: 'Tài khoản',
};

export default function NbaAdminPage() {
  const { getAccessToken } = useAuth();
  const api = new StartFlowApi(getAccessToken);

  // KPI sliders (0.8 – 1.5)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [kpi, setKpi] = useState<Record<string, number>>(Object.fromEntries(PRODUCTS.map(p => [p, 1.0])));
  const [kpiSaved, setKpiSaved] = useState(false);

  // Batch nightly
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<Record<string, unknown> | null>(null);

  // Retrain
  const [retrainProduct, setRetrainProduct] = useState('baohiem');
  const [retrainRunning, setRetrainRunning] = useState(false);
  const [retrainResult, setRetrainResult] = useState<Record<string, unknown> | null>(null);

  async function saveKpi() {
    await Promise.all(PRODUCTS.map(p => api.nbaSetKpi(currentMonth, p, kpi[p] ?? 1.0)));
    setKpiSaved(true);
    setTimeout(() => setKpiSaved(false), 2000);
  }

  async function runBatch() {
    setBatchRunning(true); setBatchResult(null);
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_AI_URL ?? 'http://localhost:8000'}/batch/nightly`, { method: 'POST' });
      setBatchResult(await r.json() as Record<string, unknown>);
    } catch (e) { setBatchResult({ error: String(e) }); }
    finally { setBatchRunning(false); }
  }

  async function runRetrain() {
    setRetrainRunning(true); setRetrainResult(null);
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_AI_URL ?? 'http://localhost:8000'}/admin/retrain?product=${retrainProduct}`, { method: 'POST' });
      setRetrainResult(await r.json() as Record<string, unknown>);
    } catch (e) { setRetrainResult({ error: String(e) }); }
    finally { setRetrainRunning(false); }
  }

  const gates = retrainResult?.metrics ? (retrainResult.metrics as Record<string, unknown>).gates as Record<string, string> : retrainResult?.gates as Record<string, string> | undefined;

  return (
    <div>
      <PageHeader eyebrow="NBA · Manager" title="Quản lý NBA" description="KPI · Batch nightly · Retrain model" />

      <div style={{ marginBottom: '1rem' }}><Panel>
        <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Hệ số KPI tháng {currentMonth}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {PRODUCTS.map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ width: 120, fontSize: '0.9rem' }}>{PROD_LABEL[p]}</span>
              <input type="range" min={0.8} max={1.5} step={0.05} value={kpi[p]}
                onChange={e => setKpi(prev => ({ ...prev, [p]: Number(e.target.value) }))}
                style={{ flex: 1 }} />
              <span style={{ width: 40, textAlign: 'right', fontWeight: 600, color: (kpi[p] ?? 1.0) !== 1.0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {(kpi[p] ?? 1.0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <button onClick={() => void saveKpi()} style={{ marginTop: '1rem', padding: '0.5rem 1.25rem', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {kpiSaved ? '✓ Đã lưu' : 'Lưu KPI'}
        </button>
      </Panel></div>

      {/* Batch nightly */}
      <div style={{ marginBottom: '1rem' }}><Panel>
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Batch Nightly (A1→A7)</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Chạy toàn bộ pipeline: ETL → scoring → ranker → scripting → validator → ghi recommendations.
        </p>
        <button disabled={batchRunning} onClick={() => void runBatch()}
          style={{ padding: '0.6rem 1.25rem', borderRadius: 8, background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {batchRunning ? '⏳ Đang chạy batch...' : '▶ Run Nightly Batch'}
        </button>
        {batchResult && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 8, background: 'var(--surface-2)', fontSize: '0.82rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(batchResult, null, 2)}
          </div>
        )}
      </Panel></div>

      {/* Retrain */}
      <Panel>
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Retrain + 4 Cửa Duyệt (B6)</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '0.75rem' }}>
          <select value={retrainProduct} onChange={e => setRetrainProduct(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
            {PRODUCTS.map(p => <option key={p} value={p}>{PROD_LABEL[p]}</option>)}
          </select>
          <button disabled={retrainRunning} onClick={() => void runRetrain()}
            style={{ padding: '0.5rem 1.25rem', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {retrainRunning ? 'Đang train...' : '🔬 Retrain'}
          </button>
        </div>
        {gates && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {Object.entries(gates).map(([k, v]) => (
              <span key={k} style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, background: v === 'PASS' ? '#22c55e22' : v === 'FAIL' ? '#ef444422' : '#6b728022', color: v === 'PASS' ? '#22c55e' : v === 'FAIL' ? '#ef4444' : '#6b7280', border: `1px solid ${v === 'PASS' ? '#22c55e44' : v === 'FAIL' ? '#ef444444' : '#6b728044'}` }}>
                {k.toUpperCase()}: {v}
              </span>
            ))}
          </div>
        )}
        {retrainResult && (
          <div style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface-2)', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(retrainResult, null, 2)}
          </div>
        )}
      </Panel>
    </div>
  );
}
