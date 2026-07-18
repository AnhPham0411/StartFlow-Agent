'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, History, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/src/auth/auth-context';
import { StartFlowApi } from '@/src/lib/api-client';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel } from '@/src/components/ui/panel';
import { LoadingState } from '@/src/components/ui/loading-state';
import { ErrorState } from '@/src/components/ui/error-state';

const PROD: Record<string, string> = {
  the: 'Thẻ', vay: 'Vay', dautu: 'Đầu tư', baohiem: 'Bảo hiểm', taikhoan: 'Tài khoản',
};

export default function NbaCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [runningMini, setRunningMini] = useState(false);
  const api = new StartFlowApi(getAccessToken);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.nbaCustomer(Number(id))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Lỗi'); }
    finally { setLoading(false); }
  }, [id]); // eslint-disable-line

  useEffect(() => { void load(); }, [load]);

  const rec = data?.recommendation as Record<string, unknown> | null;
  const versions = (data?.versions ?? []) as Array<{ version: number; created_at: string; source: string }>;
  const staleness = (data?.staleness ?? { flag: false, fields: [] }) as { flag: boolean; fields: string[] };

  return (
    <div>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        <ArrowLeft size={14} /> Quay lại
      </button>
      <PageHeader eyebrow="NBA · Khách hàng" title={data ? (data.full_name as string) : `Khách #${id}`} description={data ? `CIF: ${data.cif_code as string} · Đề xuất + staleness + version history` : "Đề xuất + staleness + version history"} />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && data && (
        <>
          {staleness.flag && (
            <div style={{ display: 'flex', gap: 8, padding: '0.75rem 1rem', borderRadius: 8, background: '#f59e0b18', border: '1px solid #f59e0b44', marginBottom: '1rem' }}>
              <AlertTriangle size={16} color="#f59e0b" />
              <span style={{ fontSize: '0.85rem', color: '#f59e0b' }}>
                Lỗi thời: <strong>{staleness.fields.join(', ')}</strong>
              </span>
            </div>
          )}

          {rec ? (
            <Panel>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700 }}>Đề xuất v{String(rec.version)}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>{String(rec.source)}</span>
              </div>
              {(['1', '2'] as const).map(n => {
                const prod = rec[`product_rank${n}`];
                if (!prod) return null;
                return (
                  <div key={n} style={{ padding: '0.75rem', borderRadius: 8, background: n === '1' ? 'var(--accent-dim, #7c3aed22)' : 'var(--surface-2, #f3f4f6)', marginBottom: '0.5rem', border: '1px solid var(--border)' }}>
                    <strong>#{n} {PROD[String(prod)] ?? String(prod)}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>
                      {typeof rec[`score_rank${n}`] === 'number' ? (rec[`score_rank${n}`] as number).toFixed(3) : ''}
                    </span>
                    <p style={{ margin: '0.4rem 0 0.2rem', fontSize: '0.9rem' }}>{String(rec[`hook${n}`] ?? '—')}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{String(rec[`explain${n}`] ?? '')}</p>
                  </div>
                );
              })}
            </Panel>
          ) : (
            <Panel><p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Chưa có đề xuất. Chạy batch nightly.</p></Panel>
          )}

          {versions.length > 0 && (
            <Panel>
              <button onClick={() => setShowTrace(t => !t)}
                style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600, width: '100%', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <History size={14} /> {versions.length} version
                </span>
                {showTrace ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showTrace && versions.map(v => (
                <div key={v.version} style={{ display: 'flex', gap: 8, padding: '0.4rem 0', borderBottom: '1px solid var(--border)', marginTop: 4, fontSize: '0.82rem', alignItems: 'center' }}>
                  <strong>v{v.version}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{new Date(v.created_at).toLocaleString('vi-VN')}</span>
                  <span style={{ color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4 }}>{v.source}</span>
                </div>
              ))}
            </Panel>
          )}

          <div style={{ marginTop: '1rem' }}>
            <button disabled={runningMini} onClick={async () => {
              setRunningMini(true);
              try {
                await fetch(`${process.env.NEXT_PUBLIC_AI_URL ?? 'http://localhost:8000'}/batch/mini/${id}`, { method: 'POST' });
                await load();
              } finally { setRunningMini(false); }
            }} style={{ padding: '0.6rem 1.25rem', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {runningMini ? 'Đang chạy...' : '⚡ Trigger mini batch'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
