'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, XCircle, PhoneMissed, RefreshCw } from 'lucide-react';
import { useAuth } from '@/src/auth/auth-context';
import { StartFlowApi } from '@/src/lib/api-client';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel } from '@/src/components/ui/panel';
import { LoadingState } from '@/src/components/ui/loading-state';
import { ErrorState } from '@/src/components/ui/error-state';

const PRODUCT_LABEL: Record<string, string> = {
  the: 'Thẻ', vay: 'Vay', dautu: 'Đầu tư', baohiem: 'Bảo hiểm', taikhoan: 'Tài khoản',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

type CallRow = {
  customer_id: number;
  name: string;
  cif_code: string;
  phone: string;
  assigned_sale_id: string | null;
  product_rank1: string | null;
  product_rank2: string | null;
  rec_id: string | null;
  rec_version: number | null;
};

type FbStatus = 'success' | 'rejected' | 'no_contact' | 'callback';

export default function NbaCallListPage() {
  const { getAccessToken } = useAuth();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, FbStatus>>({});
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const api = new StartFlowApi(getAccessToken);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(((await api.nbaCallList(date)) as CallRow[])); }
    catch (e) { setError(e instanceof Error ? e.message : 'Lỗi'); }
    finally { setLoading(false); }
  }, [date]); // eslint-disable-line

  useEffect(() => { void load(); }, [load]);

  async function giveFeedback(recId: string, status: FbStatus, reason?: string) {
    setFeedback(prev => ({ ...prev, [recId]: status }));
    try { await api.nbaFeedback({ rec_id: recId, status, reject_reason: reason }); }
    catch { setFeedback(prev => { const n = { ...prev }; delete n[recId]; return n; }); }
  }

  return (
    <div>
      <PageHeader eyebrow="NBA · Sale" title="Call List" description="Danh sách khách cần liên hệ hôm nay" />

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
        <CalendarDays size={18} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
        <button onClick={() => void load()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <RefreshCw size={14} /> Tải lại
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{rows.length} khách</span>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
          Chưa có khách nào trong call list ngày {date}.
        </p>
      )}

      {/* Modal từ chối */}
      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1.5rem', width: 360, maxWidth: '90vw' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Lý do từ chối</h3>
            <select value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
              <option value="">Chọn lý do...</option>
              <option value="da_co_bh_noi_khac">Đã có BH nơi khác</option>
              <option value="khong_co_nhu_cau">Không có nhu cầu</option>
              <option value="dtu_khong_du">DTI không đủ điều kiện</option>
              <option value="khong_lien_lac_duoc">Không liên lạc được</option>
              <option value="khac">Khác</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={!rejectReason} onClick={() => { void giveFeedback(rejectTarget, 'rejected', rejectReason); setRejectTarget(null); setRejectReason(''); }}
                style={{ flex: 1, padding: '0.5rem', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', opacity: rejectReason ? 1 : 0.5 }}>
                Xác nhận
              </button>
              <button onClick={() => setRejectTarget(null)}
                style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {rows.map(row => {
          const fbStatus = row.rec_id ? feedback[row.rec_id] : undefined;
          const done = !!fbStatus;
          return (
            <Panel key={row.customer_id} className={done ? 'opacity-60' : ''}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <Link href={`/nba/customers/${row.customer_id}`}
                    style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--accent)', textDecoration: 'none' }}>
                    KH-{row.customer_id} (CIF: ...{row.cif_code?.slice(-3) || '???'})
                  </Link>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 2 }}>{row.phone}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {row.product_rank1 && (
                    <span style={{ padding: '2px 10px', borderRadius: 20, background: 'var(--accent)', color: '#fff', fontSize: '0.78rem', fontWeight: 600 }}>
                      #1 {PRODUCT_LABEL[row.product_rank1] ?? row.product_rank1}
                    </span>
                  )}
                  {row.product_rank2 && (
                    <span style={{ padding: '2px 10px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      #2 {PRODUCT_LABEL[row.product_rank2] ?? row.product_rank2}
                    </span>
                  )}
                  {!row.product_rank1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Chưa có đề xuất</span>}
                </div>
                {row.rec_id && !done && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => void giveFeedback(row.rec_id!, 'success')}
                      style={{ padding: '6px 12px', borderRadius: 8, background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }}>
                      <CheckCircle2 size={14} /> Chốt
                    </button>
                    <button onClick={() => void giveFeedback(row.rec_id!, 'callback')}
                      style={{ padding: '6px 12px', borderRadius: 8, background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', cursor: 'pointer', fontSize: '0.82rem' }}>
                      Callback
                    </button>
                    <button onClick={() => void giveFeedback(row.rec_id!, 'no_contact')}
                      style={{ padding: '6px 12px', borderRadius: 8, background: '#6b728022', color: '#6b7280', border: '1px solid #6b728044', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }}>
                      <PhoneMissed size={14} />
                    </button>
                    <button onClick={() => setRejectTarget(row.rec_id!)}
                      style={{ padding: '6px 12px', borderRadius: 8, background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }}>
                      <XCircle size={14} /> Từ chối
                    </button>
                  </div>
                )}
                {done && (
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: fbStatus === 'success' ? '#22c55e' : '#ef4444' }}>
                    {fbStatus === 'success' ? '✓ Đã chốt' : fbStatus === 'callback' ? '↩ Callback' : fbStatus === 'no_contact' ? '📵 Không liên lạc' : '✗ Từ chối'}
                  </span>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
