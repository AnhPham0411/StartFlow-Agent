'use client';

/**
 * /nba/calllist — màn hình sale làm việc cả ngày: gọi lần lượt và ghi kết quả.
 *
 * Dùng design system trong app/globals.css (project KHÔNG có Tailwind).
 * Thiết kế xoay quanh một việc: gọi xong bấm một nút là xong, không rời trang.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarDays, CheckCircle2, PhoneMissed, RotateCcw, RefreshCw, XCircle,
} from 'lucide-react';

import { useAuth } from '@/src/auth/auth-context';
import { StartFlowApi } from '@/src/lib/api-client';
import { PageHeader } from '@/src/components/ui/page-header';
import { Badge } from '@/src/components/ui/badge';
import { LoadingState } from '@/src/components/ui/loading-state';
import { ErrorState } from '@/src/components/ui/error-state';

const PROD: Record<string, string> = {
  the: 'Thẻ tín dụng', vay: 'Khoản vay', dautu: 'Đầu tư', baohiem: 'Bảo hiểm', taikhoan: 'Tài khoản',
};

const REJECT_REASONS = [
  { value: 'da_co_bh_noi_khac', label: 'Đã có bảo hiểm nơi khác' },
  { value: 'khong_co_nhu_cau', label: 'Không có nhu cầu' },
  { value: 'dtu_khong_du', label: 'Không đủ điều kiện tài chính' },
  { value: 'khong_lien_lac_duoc', label: 'Không liên lạc được' },
  { value: 'khac', label: 'Lý do khác' },
];

const OUTCOME: Record<FbStatus, { label: string; tone: string }> = {
  success: { label: 'Đã chốt', tone: 'win' },
  callback: { label: 'Hẹn gọi lại', tone: 'wait' },
  no_contact: { label: 'Không liên lạc được', tone: 'none' },
  rejected: { label: 'Từ chối', tone: 'lose' },
};

type FbStatus = 'success' | 'rejected' | 'no_contact' | 'callback';

interface CallRow {
  customer_id: number;
  name: string;
  cif_code: string;
  phone: string;
  assigned_sale_id: string | null;
  product_rank1: string | null;
  product_rank2: string | null;
  score_rank1?: number | null;
  rec_id: string | null;
  rec_version: number | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function NbaCallListPage() {
  const { getAccessToken } = useAuth();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [outcomes, setOutcomes] = useState<Record<string, FbStatus>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<CallRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const api = new StartFlowApi(getAccessToken);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRows((await api.nbaCallList(date)) as CallRow[]);
      setOutcomes({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được call list');
    } finally { setLoading(false); }
  }, [date]); // eslint-disable-line

  // Hoãn một nhịp: tránh setState đồng bộ trong effect (render dây chuyền), đồng thời
  // gộp các lần đổi ngày liên tiếp thành một request.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const done = useMemo(() => Object.keys(outcomes).length, [outcomes]);

  async function record(row: CallRow, status: FbStatus, reason?: string) {
    if (!row.rec_id) return;
    const recId = row.rec_id;
    setSaving(recId); setActionError(null);
    try {
      await api.nbaFeedback({ rec_id: recId, status, reject_reason: reason });
      setOutcomes((prev) => ({ ...prev, [recId]: status }));
    } catch (e) {
      // Không cập nhật lạc quan rồi âm thầm quay lui: sale cần biết là CHƯA ghi được.
      setActionError(
        `Không ghi được kết quả cho ${row.name}: ${e instanceof Error ? e.message : 'lỗi không xác định'}`,
      );
    } finally { setSaving(null); }
  }

  function undo(recId: string) {
    setOutcomes((prev) => {
      const next = { ...prev };
      delete next[recId];
      return next;
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="NBA · Sale"
        title="Call List"
        description="Danh sách khách cần liên hệ, kèm sản phẩm nên chào"
        actions={
          <button type="button" className="button button--secondary" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> Tải lại
          </button>
        }
      />

      <div className="toolbar">
        <CalendarDays size={17} aria-hidden="true" style={{ color: 'var(--audit-slate)' }} />
        <label className="visually-hidden" htmlFor="date">Ngày</label>
        <input
          id="date"
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <span className="toolbar__spacer" />
        {rows.length > 0 && (
          <>
            <Badge tone={done === rows.length ? 'success' : 'neutral'}>
              {done}/{rows.length} đã xử lý
            </Badge>
          </>
        )}
      </div>

      {actionError && (
        <div className="banner banner--danger">
          <XCircle aria-hidden="true" />
          <p>{actionError}</p>
        </div>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && rows.length === 0 && (
        <div className="banner banner--info">
          <CalendarDays aria-hidden="true" />
          <p>Không có khách nào trong call list ngày {date}. Thử chọn ngày khác hoặc liên hệ quản lý để được phân công.</p>
        </div>
      )}

      {!loading && !error && rows.map((row) => {
        const status = row.rec_id ? outcomes[row.rec_id] : undefined;
        const busy = saving === row.rec_id;

        return (
          <article key={row.customer_id} className={`call-row${status ? ' call-row--done' : ''}`}>
            <div className="call-row__who">
              <Link href={`/nba/customers/${row.customer_id}`} className="call-row__name">
                {row.name}
              </Link>
              <p className="call-row__meta">
                CIF {row.cif_code}
                {row.phone ? ` · ${row.phone}` : ''}
                {row.rec_version ? ` · đề xuất v${row.rec_version}` : ''}
              </p>

              <div className="call-row__offer">
                {row.product_rank1 ? (
                  <>
                    <span className="offer offer--top">
                      {PROD[row.product_rank1] ?? row.product_rank1}
                      {typeof row.score_rank1 === 'number' && ` · ${(row.score_rank1 * 100).toFixed(0)}%`}
                    </span>
                    {row.product_rank2 && (
                      <span className="offer">{PROD[row.product_rank2] ?? row.product_rank2}</span>
                    )}
                  </>
                ) : (
                  <span className="muted" style={{ fontSize: '0.82rem' }}>Chưa có đề xuất</span>
                )}
              </div>
            </div>

            {status ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`outcome outcome--${OUTCOME[status].tone}`}>
                  {status === 'success' && <CheckCircle2 size={15} />}
                  {status === 'rejected' && <XCircle size={15} />}
                  {status === 'no_contact' && <PhoneMissed size={15} />}
                  {OUTCOME[status].label}
                </span>
                <button
                  type="button"
                  className="act"
                  onClick={() => row.rec_id && undo(row.rec_id)}
                  title="Bỏ đánh dấu trên màn hình (bản ghi đã lưu vẫn giữ nguyên)"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            ) : row.rec_id ? (
              <div className="call-row__actions">
                <button type="button" className="act act--win" disabled={busy}
                  onClick={() => void record(row, 'success')}>
                  <CheckCircle2 size={14} /> Chốt
                </button>
                <button type="button" className="act act--wait" disabled={busy}
                  onClick={() => void record(row, 'callback')}>
                  Gọi lại
                </button>
                <button type="button" className="act" disabled={busy}
                  onClick={() => void record(row, 'no_contact')} title="Không liên lạc được">
                  <PhoneMissed size={14} />
                </button>
                <button type="button" className="act act--lose" disabled={busy}
                  onClick={() => { setRejectTarget(row); setRejectReason(''); }}>
                  <XCircle size={14} /> Từ chối
                </button>
              </div>
            ) : (
              <span className="outcome outcome--none">Không ghi nhận được</span>
            )}
          </article>
        );
      })}

      {/* Lý do từ chối — bắt buộc, vì DB có CHECK chặn rejected mà thiếu lý do. */}
      {rejectTarget && (
        <div
          className="modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
          onKeyDown={(e) => e.key === 'Escape' && setRejectTarget(null)}
        >
          <div className="modal">
            <div className="modal__head">
              <h2 id="reject-title">Lý do từ chối</h2>
              <p className="subtle" style={{ margin: '4px 0 0' }}>{rejectTarget.name}</p>
            </div>
            <div className="modal__body">
              <label className="fieldset-label" htmlFor="reason">Chọn lý do</label>
              <select
                id="reason"
                className="select"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              >
                <option value="">— Chọn —</option>
                {REJECT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="field-help">
                Từ chối sẽ tạm hoãn sản phẩm này với khách trong 90 ngày.
              </p>
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="button button--danger"
                disabled={!rejectReason}
                onClick={() => {
                  const target = rejectTarget;
                  setRejectTarget(null);
                  void record(target, 'rejected', rejectReason);
                }}
              >
                Xác nhận từ chối
              </button>
              <button type="button" className="button button--ghost" onClick={() => setRejectTarget(null)}>
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
