'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel } from '@/src/components/ui/panel';
import { LoadingState } from '@/src/components/ui/loading-state';
import { ErrorState } from '@/src/components/ui/error-state';

type Customer = { customer_id: number; name: string; cif_code: string; phone: string };

export default function NbaCustomersPage() {
  const [all, setAll] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/nba-customers')
      .then(r => r.json() as Promise<Customer[]>)
      .then(d => setAll(Array.isArray(d) ? d : []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = q
    ? all.filter(c => c.cif_code.toLowerCase().includes(q.toLowerCase()) || String(c.customer_id).includes(q))
    : all;

  return (
    <div>
      <PageHeader eyebrow="NBA" title="Khách hàng" description="Toàn bộ khách trong hệ thống" />
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo CIF hoặc ID..."
          style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={load} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.map(c => (
          <Link key={c.customer_id} href={`/nba/customers/${c.customer_id}`} style={{ textDecoration: 'none' }}>
            <Panel>
              <span style={{ fontWeight: 600 }}>KH-{c.customer_id} (CIF: ...{c.cif_code?.slice(-3) || '???'})</span>
              {c.phone && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginLeft: 8 }}>{c.phone}</span>}
            </Panel>
          </Link>
        ))}
        {!loading && !error && filtered.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            {q ? 'Không tìm thấy.' : 'Chưa có dữ liệu. Chạy batch nightly hoặc seed data.'}
          </p>
        )}
      </div>
    </div>
  );
}
