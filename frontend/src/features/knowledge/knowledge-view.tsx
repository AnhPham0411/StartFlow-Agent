'use client';

import { BookOpenText, LockKeyhole, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RoleGate } from '@/src/auth/role-gate';
import { Button } from '@/src/components/ui/button';
import { EmptyState } from '@/src/components/ui/empty-state';
import { LoadingState } from '@/src/components/ui/loading-state';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { StatusBadge } from '@/src/components/ui/status-badge';
import { formatDateTime } from '@/src/lib/format';
import type { KnowledgeDocument } from '@/src/lib/models';
import { useStartFlowApi } from '@/src/lib/use-api';

export function KnowledgeView() {
  return (
    <RoleGate allow={['admin']} fallback={<AccessDenied />}>
      <AdminKnowledge />
    </RoleGate>
  );
}

function AccessDenied() {
  return (
    <main className="centered-state">
      <div className="state-icon state-icon--danger">
        <LockKeyhole aria-hidden="true" />
      </div>
      <p className="eyebrow">Admin only</p>
      <h1>Không có quyền quản lý tri thức</h1>
      <p className="muted">
        Màn hình ingest yêu cầu role <strong>admin</strong>. Backend vẫn là nơi cưỡng chế quyền truy
        cập.
      </p>
      <Link className="button button--secondary" href="/dashboard">
        Về tổng quan
      </Link>
    </main>
  );
}

function AdminKnowledge() {
  const api = useStartFlowApi();
  const [items, setItems] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', domain: 'CREDIT', content: '' });
  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listKnowledge());
    } catch {
      setError('Không tải được thư viện tri thức demo.');
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSuccess(null);
    if (form.title.trim().length < 3 || form.content.trim().length < 20) {
      setError('Tiêu đề cần ít nhất 3 ký tự và nội dung cần ít nhất 20 ký tự.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.ingestKnowledge({
        ...form,
        title: form.title.trim(),
        content: form.content.trim(),
        demoData: true,
      });
      setItems((current) => [created, ...current]);
      setForm({ title: '', domain: 'CREDIT', content: '' });
      setSuccess('Đã gửi tài liệu demo vào hàng đợi ingest.');
    } catch {
      setError('Không thể ingest tài liệu. Kiểm tra quyền admin và kết nối AI service.');
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Admin · RAG corpus"
        title="Tri thức mô phỏng"
        description="Quản lý tài liệu demo cho Credit, Compliance và Operations. Không tải lên dữ liệu ngân hàng thật."
        actions={
          <Button onClick={() => document.getElementById('knowledge-title')?.focus()}>
            <Plus aria-hidden="true" />
            Thêm tài liệu
          </Button>
        }
      />
      {success ? (
        <div className="banner banner--success" role="status">
          <p>{success}</p>
        </div>
      ) : null}
      {error ? (
        <div className="banner banner--danger" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      <div className="admin-grid">
        <Panel>
          <PanelHeader title="Thư viện hiện có" eyebrow={`${items.length} demo documents`} />
          {loading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <EmptyState
              title="Chưa có tài liệu"
              description="Ingest seed đầu tiên để các agent trả citation có căn cứ."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tài liệu</th>
                    <th>Domain</th>
                    <th>Chunks</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Tài liệu">
                        <strong>{item.title}</strong>
                        <div className="utility muted">#{item.id.slice(0, 8)}</div>
                      </td>
                      <td data-label="Domain">{item.domain}</td>
                      <td data-label="Chunks">{item.chunkCount ?? '—'}</td>
                      <td data-label="Trạng thái">
                        <StatusBadge status={item.status ?? 'READY'} />
                      </td>
                      <td data-label="Ngày tạo">{formatDateTime(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel className="sticky-panel">
          <PanelHeader title="Ingest tài liệu demo" eyebrow="Admin action" />
          <PanelBody>
            <form onSubmit={(event) => void submit(event)} className="list-stack">
              <div className="banner banner--warning">
                <BookOpenText aria-hidden="true" />
                <p>
                  Chỉ dùng chính sách mô phỏng. Nội dung sẽ được chia chunk và tạo embedding bởi AI
                  service.
                </p>
              </div>
              <div className="form-field">
                <label htmlFor="knowledge-title">Tiêu đề</label>
                <input
                  className="input"
                  id="knowledge-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label htmlFor="knowledge-domain">Domain</label>
                <select
                  className="select"
                  id="knowledge-domain"
                  value={form.domain}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, domain: event.target.value }))
                  }
                >
                  <option value="CREDIT">Credit</option>
                  <option value="COMPLIANCE">Compliance</option>
                  <option value="OPERATIONS">Operations</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="knowledge-content">Nội dung mô phỏng</label>
                <textarea
                  className="textarea"
                  id="knowledge-content"
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, content: event.target.value }))
                  }
                  rows={8}
                />
              </div>
              <Button type="submit" fullWidth disabled={submitting}>
                <Upload aria-hidden="true" />
                {submitting ? 'Đang ingest…' : 'Ingest tài liệu demo'}
              </Button>
            </form>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
