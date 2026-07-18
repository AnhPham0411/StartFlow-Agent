'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';

import { useAuth } from '@/src/auth/auth-context';
import { Badge } from '@/src/components/ui/badge';
import { PageHeader } from '@/src/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { StartFlowApi } from '@/src/lib/api-client';

const PRODUCTS = ['the', 'vay', 'dautu', 'baohiem', 'taikhoan'] as const;
const PRODUCT_LABEL: Record<(typeof PRODUCTS)[number], string> = {
  the: 'Thẻ tín dụng',
  vay: 'Khoản vay',
  dautu: 'Đầu tư',
  baohiem: 'Bảo hiểm',
  taikhoan: 'Tài khoản',
};

const KPI_MIN = 0.8;
const KPI_MAX = 1.5;
type Status = 'idle' | 'running' | 'ok' | 'error';

export default function NbaAdminPage() {
  const { getAccessToken } = useAuth();
  const api = new StartFlowApi(getAccessToken);
  const month = new Date().toISOString().slice(0, 7);
  const [kpi, setKpi] = useState<Record<string, number>>(
    Object.fromEntries(PRODUCTS.map((product) => [product, 1])),
  );
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const changed = PRODUCTS.filter((product) => (kpi[product] ?? 1) !== 1).length;

  async function saveKpi() {
    setStatus('running');
    setError(null);
    try {
      await Promise.all(
        PRODUCTS.map((product) => api.nbaSetKpi(month, product, kpi[product] ?? 1)),
      );
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'Không lưu được hệ số KPI');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="NBA · Quản lý"
        title="Cấu hình ưu tiên bán hàng"
        description="Điều chỉnh hệ số KPI qua backend được bảo vệ bằng Keycloak"
      />

      <Panel>
        <PanelHeader
          eyebrow={`Tháng ${month}`}
          title="Hệ số ưu tiên sản phẩm"
          action={changed > 0 ? <Badge tone="warning">{changed} thay đổi</Badge> : undefined}
        />
        <PanelBody>
          <p className="subtle" style={{ marginTop: 0 }}>
            Hệ số trên 1,00 tăng ưu tiên; hệ số dưới 1,00 giảm ưu tiên. Phạm vi cho phép là{' '}
            {KPI_MIN.toFixed(2)}–{KPI_MAX.toFixed(2)}.
          </p>

          {PRODUCTS.map((product) => {
            const value = kpi[product] ?? 1;
            return (
              <div key={product} className="kpi-row">
                <label htmlFor={`kpi-${product}`}>{PRODUCT_LABEL[product]}</label>
                <input
                  id={`kpi-${product}`}
                  type="range"
                  min={KPI_MIN}
                  max={KPI_MAX}
                  step={0.05}
                  value={value}
                  onChange={(event) =>
                    setKpi((current) => ({ ...current, [product]: Number(event.target.value) }))
                  }
                />
                <span className={`kpi-row__value${value !== 1 ? ' kpi-row__value--changed' : ''}`}>
                  {value.toFixed(2)}
                </span>
              </div>
            );
          })}

          {error && (
            <div className="banner banner--danger" style={{ marginTop: 14, marginBottom: 0 }}>
              <AlertTriangle aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="button"
            className="button button--primary"
            style={{ marginTop: 14 }}
            disabled={status === 'running'}
            onClick={() => void saveKpi()}
          >
            {status === 'ok' ? <CheckCircle2 aria-hidden="true" /> : <Save aria-hidden="true" />}
            {status === 'running' ? 'Đang lưu…' : status === 'ok' ? 'Đã lưu' : 'Lưu hệ số'}
          </button>
        </PanelBody>
      </Panel>
    </>
  );
}
