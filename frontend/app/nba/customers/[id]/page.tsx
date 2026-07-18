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
  
  // Call Notes State
  const [notes, setNotes] = useState<Array<{ id: number; note_text: string; created_at: string; sale_name?: string }>>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const api = new StartFlowApi(getAccessToken);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.nbaCustomer(Number(id))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Lỗi'); }
    finally { setLoading(false); }
  }, [id]); // eslint-disable-line

  const loadNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const res = await api.getCallNotes(Number(id));
      setNotes(res);
    } catch (e) {
      console.error('Failed to load notes', e);
    } finally {
      setLoadingNotes(false);
    }
  }, [id]); // eslint-disable-line

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.saveCallNote(Number(id), noteText);
      setNoteText('');
      await loadNotes();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lỗi khi lưu ghi chú');
    } finally {
      setSavingNote(false);
    }
  };

  useEffect(() => {
    void load();
    void loadNotes();
  }, [load, loadNotes]);

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
                      {typeof rec[`score_rank${n}`] === 'number' ? `${((rec[`score_rank${n}`] as number) * 100).toFixed(1)}%` : ''}
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

          {/* Ghi chú cuộc gọi (Call Notes) */}
          <Panel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Ghi chú cuộc gọi</h3>
            </div>
            
            <form onSubmit={handleSaveNote} style={{ marginBottom: '1.5rem' }}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Nhập nội dung trao đổi cuộc gọi (vd: Khách hàng đồng ý mở thẻ, hẹn chiều gửi hồ sơ...)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2, #f3f4f6)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  outline: 'none',
                  marginBottom: '0.5rem'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingNote || !noteText.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    background: noteText.trim() ? 'var(--accent, #7c3aed)' : 'var(--border)',
                    color: '#fff',
                    border: 'none',
                    cursor: noteText.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  {savingNote ? 'Đang lưu...' : 'Lưu ghi chú'}
                </button>
              </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {loadingNotes ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Đang tải ghi chú...</p>
              ) : notes.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', fontStyle: 'italic' }}>
                  Chưa có ghi chú cuộc gọi cho khách hàng này.
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'var(--surface-2, #f3f4f6)',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {note.sale_name || 'Nhân viên Sale'}
                      </strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {new Date(note.created_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                      {note.note_text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Panel>

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
