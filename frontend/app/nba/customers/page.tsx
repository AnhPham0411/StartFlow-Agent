'use client';

/**
 * /nba/customers — tra cứu khách trong phạm vi được phép xem.
 *
 * Gọi backend qua StartFlowApi với bearer token Keycloak và giữ nguyên lỗi API để UI
 * không nhầm lỗi xác thực/kết nối thành trạng thái "chưa có dữ liệu".
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';

import { useAuth } from '@/src/auth/auth-context';
import { StartFlowApi } from '@/src/lib/api-client';
import { PageHeader } from '@/src/components/ui/page-header';
import { Badge } from '@/src/components/ui/badge';
import { LoadingState } from '@/src/components/ui/loading-state';
import { ErrorState } from '@/src/components/ui/error-state';

const PROD: Record<string, string> = {
  the: 'Thẻ tín dụng',
  vay: 'Khoản vay',
  dautu: 'Đầu tư',
  baohiem: 'Bảo hiểm',
  taikhoan: 'Tài khoản',
};

interface CustomerRow {
  customer_id: number;
  full_name: string;
  cif_code: string;
  product_rank1: string | null;
  last_list_date: string | null;
}

export default function NbaCustomersPage() {
  const { getAccessToken } = useAuth();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = new StartFlowApi(getAccessToken);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await api.nbaCustomers(search));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  // Trễ 300ms để gõ tìm kiếm không bắn request mỗi ký tự.
  useEffect(() => {
    const timer = setTimeout(() => void load(q), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [q, load]);

  return (
    <>
      <PageHeader
        eyebrow="NBA"
        title="Khách hàng"
        description="Khách được phân công cho bạn — sale xem khách của mình, quản lý xem cả chi nhánh"
        actions={rows.length > 0 ? <Badge tone="neutral">{rows.length} khách</Badge> : undefined}
      />

      <div className="toolbar">
        <Search size={16} aria-hidden="true" style={{ color: 'var(--audit-slate)' }} />
        <label className="visually-hidden" htmlFor="q">
          Tìm khách hàng
        </label>
        <input
          id="q"
          className="input"
          style={{ flex: 1, minWidth: 220 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên hoặc mã CIF…"
        />
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={() => load(q)} />}

      {!loading && !error && rows.length === 0 && (
        <div className="banner banner--info">
          <Users aria-hidden="true" />
          <p>
            {q
              ? `Không tìm thấy khách nào khớp “${q}”.`
              : 'Chưa có khách nào được phân công cho bạn. Liên hệ quản lý để được thêm vào call list.'}
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Mã CIF</th>
                  <th>Nên chào</th>
                  <th>Lần gần nhất trong call list</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.customer_id}>
                    <td>
                      <Link href={`/nba/customers/${c.customer_id}`} className="call-row__name">
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="utility muted">{c.cif_code}</td>
                    <td>
                      {c.product_rank1 ? (
                        <span className="offer offer--top">
                          {PROD[c.product_rank1] ?? c.product_rank1}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="utility muted">{c.last_list_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
