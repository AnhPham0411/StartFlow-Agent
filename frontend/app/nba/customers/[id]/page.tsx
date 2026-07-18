'use client';

/**
 * Trang khách hàng NBA — màn hình sale mở ra khi chuẩn bị gọi.
 *
 * Dùng design system trong app/globals.css. Project KHÔNG cài Tailwind, nên mọi class
 * tiện ích kiểu `bg-white rounded-xl` sẽ không có tác dụng — đừng dùng.
 *
 * Bố cục: cột trái là thứ cần khi đang nói chuyện (kịch bản, lý do, số liệu),
 * cột phải là tra cứu nhanh (hồ sơ, ghi chú, lịch sử).
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Send, Zap } from 'lucide-react';

import { useAuth } from '@/src/auth/auth-context';
import { StartFlowApi } from '@/src/lib/api-client';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { Badge } from '@/src/components/ui/badge';
import { LoadingState } from '@/src/components/ui/loading-state';
import { ErrorState } from '@/src/components/ui/error-state';
import { AssessmentPanel, CustomerSnapshot } from '@/src/features/nba/assessment-panel';
import type { NbaAssessment } from '@/src/lib/nba-assessment.types';

const PROD: Record<string, string> = {
  the: 'Thẻ tín dụng',
  vay: 'Khoản vay',
  dautu: 'Đầu tư',
  baohiem: 'Bảo hiểm',
  taikhoan: 'Tài khoản',
};

interface CallNote {
  id: number;
  note_text: string;
  created_at: string;
  sale_name?: string;
}

export default function NbaCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getAccessToken } = useAuth();

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [assessment, setAssessment] = useState<NbaAssessment | null>(null);
  const [assessError, setAssessError] = useState<string | null>(null);

  const [notes, setNotes] = useState<CallNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const api = new StartFlowApi(getAccessToken);

  /** Trả true nếu tải được — quyết định có gọi tiếp ghi chú/đánh giá hay không. */
  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.nbaCustomer(Number(id)));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu khách hàng');
      return false;
    } finally {
      setLoading(false);
    }
  }, [id]); // eslint-disable-line

  const loadNotes = useCallback(async () => {
    try {
      setNotes(await api.getCallNotes(Number(id)));
      setNotesError(null);
    } catch (e) {
      // Không dùng console.error: Next.js dev overlay bắt nó và bung màn hình lỗi che cả trang.
      setNotesError(e instanceof Error ? e.message : 'Không tải được ghi chú');
    }
  }, [id]); // eslint-disable-line

  const loadAssessment = useCallback(async () => {
    setAssessError(null);
    try {
      setAssessment(await api.nbaAssessment(Number(id)));
    } catch (e) {
      setAssessError(e instanceof Error ? e.message : 'Không tải được phần đánh giá');
    }
  }, [id]); // eslint-disable-line

  useEffect(() => {
    // Tuần tự: không có quyền xem khách này thì đừng bắn thêm 2 request để nhận 3 lần 403.
    void (async () => {
      if (await load()) await Promise.all([loadNotes(), loadAssessment()]);
    })();
  }, [load, loadNotes, loadAssessment]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.saveCallNote(Number(id), noteText);
      setNoteText('');
      await loadNotes();
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Không lưu được ghi chú');
    } finally {
      setSavingNote(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), loadAssessment()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const rec = data.recommendation as Record<string, unknown> | null;
  const versions = (data.versions ?? []) as Array<{
    version: number;
    created_at: string;
    source: string;
  }>;
  const staleness = (data.staleness ?? { flag: false, fields: [] }) as {
    flag: boolean;
    fields: string[];
  };

  return (
    <>
      <button
        type="button"
        className="button button--ghost"
        onClick={() => router.back()}
        style={{ marginBottom: 12 }}
      >
        <ArrowLeft aria-hidden="true" /> Quay lại
      </button>

      <PageHeader
        eyebrow="NBA · Khách hàng"
        title={String(data.full_name)}
        description={`CIF ${String(data.cif_code)}`}
        actions={
          <button
            type="button"
            className="button button--primary"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            <Zap aria-hidden="true" />
            {refreshing ? 'Đang làm mới…' : 'Làm mới dữ liệu'}
          </button>
        }
      />

      {staleness.flag && (
        <div className="banner banner--warning">
          <AlertTriangle aria-hidden="true" />
          <p>
            Số liệu <strong>{staleness.fields.join(', ')}</strong> đã thay đổi kể từ khi tạo đề
            xuất. Cân nhắc chạy lại trước khi gọi.
          </p>
        </div>
      )}

      <div className="section-grid">
        {/* ── Cột chính: dùng khi đang nói chuyện ─────────────────────── */}
        <div className="stack">
          <Panel>
            <PanelHeader
              eyebrow="Kịch bản"
              title="Mục tiêu tiếp cận"
              action={
                rec ? (
                  <Badge tone="neutral">
                    {String(rec.source)} · v{String(rec.version)}
                  </Badge>
                ) : undefined
              }
            />
            <PanelBody>
              {rec ? (
                (['1', '2'] as const).map((n) => {
                  const product = rec[`product_rank${n}`];
                  if (!product) return null;
                  const score = rec[`score_rank${n}`];
                  return (
                    <article key={n} className={`pitch${n === '1' ? ' pitch--primary' : ''}`}>
                      <header className="pitch__head">
                        <span className="pitch__rank">
                          <span className="pitch__ord">{n}</span>
                          {PROD[String(product)] ?? String(product)}
                        </span>
                        {typeof score === 'number' && (
                          <span className="pitch__score">{(score * 100).toFixed(1)}% phù hợp</span>
                        )}
                      </header>
                      <div className="pitch__body">
                        <p className="pitch__hook">{String(rec[`hook${n}`] ?? '—')}</p>
                        {rec[`explain${n}`] ? (
                          <p className="pitch__why">{String(rec[`explain${n}`])}</p>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="muted">Chưa có đề xuất cho khách hàng này.</p>
              )}
            </PanelBody>
          </Panel>

          {assessment && <AssessmentPanel data={assessment} />}
          {assessError && (
            <div className="banner banner--info">
              <AlertTriangle aria-hidden="true" />
              <p>Không tải được phần đánh giá: {assessError}</p>
            </div>
          )}
        </div>

        {/* ── Cột phụ: tra cứu nhanh ──────────────────────────────────── */}
        <div className="stack">
          {assessment && <CustomerSnapshot data={assessment} />}

          <Panel>
            <PanelHeader
              eyebrow="Nhật ký"
              title="Ghi chú cuộc gọi"
              action={notes.length > 0 ? <Badge tone="neutral">{notes.length}</Badge> : undefined}
            />
            <PanelBody>
              <form onSubmit={handleSaveNote} style={{ marginBottom: 14 }}>
                <label className="visually-hidden" htmlFor="note">
                  Nội dung trao đổi
                </label>
                <textarea
                  id="note"
                  className="textarea"
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Khách hẹn gọi lại chiều mai, quan tâm gói tích luỹ…"
                />
                <button
                  type="submit"
                  className="button button--secondary button--full"
                  disabled={savingNote || !noteText.trim()}
                  style={{ marginTop: 8 }}
                >
                  <Send aria-hidden="true" />
                  {savingNote ? 'Đang lưu…' : 'Lưu ghi chú'}
                </button>
              </form>

              {notesError && <p className="field-error">{notesError}</p>}

              {notes.length === 0 && !notesError ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
                  Chưa có ghi chú nào.
                </p>
              ) : (
                notes.map((note) => (
                  <article key={note.id} className="note">
                    <header className="note__head">
                      <span className="note__who">{note.sale_name ?? 'Nhân viên'}</span>
                      <time className="note__when">
                        {new Date(note.created_at).toLocaleString('vi-VN')}
                      </time>
                    </header>
                    <p className="note__text">{note.note_text}</p>
                  </article>
                ))
              )}
            </PanelBody>
          </Panel>

          {versions.length > 0 && (
            <Panel>
              <PanelHeader eyebrow="Truy vết" title={`${versions.length} phiên bản`} />
              <PanelBody>
                {versions.map((v) => (
                  <div key={v.version} className="ver">
                    <span className="ver__no">v{v.version}</span>
                    <time className="muted" style={{ flex: 1, fontSize: '0.8rem' }}>
                      {new Date(v.created_at).toLocaleString('vi-VN')}
                    </time>
                    <span className="chip">{v.source}</span>
                  </div>
                ))}
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
