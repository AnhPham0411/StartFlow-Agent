'use client';

/**
 * Panel "Đánh giá 3/6 tháng + vì sao phù hợp sản phẩm".
 *
 * Dùng design system trong app/globals.css (token ember/teal/slate), KHÔNG dùng Tailwind —
 * project không cài Tailwind, class tiện ích sẽ không có tác dụng.
 *
 * Thứ tự hiển thị bám theo việc sale làm khi cầm điện thoại:
 * cảnh báo có nên gọi không → vì sao phù hợp → số liệu nền.
 */
import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

import type {
  NbaAssessment,
  NbaCriterion,
  NbaPackageAssessment,
} from '@/src/lib/nba-assessment.types';
import { Panel, PanelBody, PanelHeader } from '@/src/components/ui/panel';
import { Badge } from '@/src/components/ui/badge';

const PROD: Record<string, string> = {
  the: 'Thẻ tín dụng',
  vay: 'Khoản vay',
  dautu: 'Đầu tư',
  baohiem: 'Bảo hiểm',
  taikhoan: 'Tài khoản',
};

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** Số tiền đầy đủ — dùng cho ô chỉ số, nơi sale cần con số chính xác. */
const vnd = (v: number | null): string => (v === null ? '—' : `${nf.format(Math.round(v))} đ`);

/** Rút gọn để liếc nhanh trong bảng so sánh: 191.592.605 → 191,6 tr */
const short = (v: number | null): string => {
  if (v === null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)} tỷ`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)} tr`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)} ng`;
  return nf.format(v);
};

export function AssessmentPanel({ data }: { data: NbaAssessment }) {
  // `current` và `relationship` được hiển thị ở CustomerSnapshot (cột phải), không dùng ở đây.
  const { explanation, window_3m: w3, window_6m: w6, trend } = data;
  const eligible = data.packages.filter((p) => p.eligible);
  const rejected = data.packages.filter((p) => !p.eligible);
  const [open, setOpen] = useState<string | null>(eligible[0]?.package ?? null);
  const [showRejected, setShowRejected] = useState(false);

  const toggle = (pkg: string) => setOpen(open === pkg ? null : pkg);
  const blocks = data.customer_blocks.filter((c) => !c.passed);

  return (
    <div className="stack">
      {/* ── Có nên gọi khách này không ────────────────────────────────── */}
      {blocks.map((c) => (
        <div key={c.code} className="banner banner--danger">
          <AlertTriangle aria-hidden="true" />
          <div>
            <p>
              <strong>Chưa nên gọi khách này — {c.label.toLowerCase()}</strong>
            </p>
            <p className="subtle" style={{ marginTop: 3 }}>
              {c.actual} · yêu cầu {c.required}. Các gói bên dưới vẫn được chấm đầy đủ để bạn nắm
              trước.
            </p>
          </div>
        </div>
      ))}

      {data.drift.length > 0 && (
        <div className="banner banner--warning">
          <AlertTriangle aria-hidden="true" />
          <div>
            <p>
              <strong>{data.drift.length} tiêu chí đã đổi kể từ khi có đề xuất</strong>
            </p>
            <ul style={{ margin: '5px 0 0', paddingLeft: 17 }}>
              {data.drift.slice(0, 4).map((d, i) => (
                <li key={i} className="subtle">
                  {PROD[d.product] ?? d.product} · {d.label}: {d.was ? 'đạt' : 'không đạt'} →{' '}
                  <strong>{d.now ? 'đạt' : 'không đạt'}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Vì sao phù hợp ───────────────────────────────────────────── */}
      <Panel>
        <PanelHeader
          eyebrow="Phân tích"
          title="Vì sao phù hợp"
          action={
            <Badge tone={eligible.length > 0 ? 'success' : 'neutral'}>
              {eligible.length}/{data.packages.length} gói đủ điều kiện
            </Badge>
          }
        />
        <PanelBody>
          <p className="subtle" style={{ marginTop: 0 }}>
            Chấm theo điều kiện từng gói trong danh mục sản phẩm, kết hợp rule R1–R12.
          </p>

          {explanation.narrative && (
            <div className="opener" style={{ marginBottom: 16 }}>
              <p className="opener__label">Gợi ý câu mở lời</p>
              <p className="opener__text">{explanation.narrative}</p>
            </div>
          )}

          {explanation.degraded_reason && (
            <div className="banner banner--info">
              <AlertTriangle aria-hidden="true" />
              <p>
                Chưa có câu mở lời: {explanation.degraded_reason}. Bảng tiêu chí bên dưới vẫn đầy
                đủ.
              </p>
            </div>
          )}

          {eligible.length === 0 ? (
            <p className="muted">Không gói nào đủ điều kiện. Xem lý do bị chặn bên dưới.</p>
          ) : (
            eligible.map((p) => (
              <PackageRow
                key={p.package}
                pkg={p}
                open={open === p.package}
                onToggle={() => toggle(p.package)}
              />
            ))
          )}

          {rejected.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setShowRejected((v) => !v)}
                style={{ minHeight: 36, padding: '6px 10px' }}
              >
                {showRejected ? <ChevronUp /> : <ChevronDown />}
                {rejected.length} gói không đủ điều kiện
              </button>
              {showRejected && (
                <div style={{ marginTop: 8 }}>
                  {rejected.map((p) => (
                    <PackageRow
                      key={p.package}
                      pkg={p}
                      open={open === p.package}
                      onToggle={() => toggle(p.package)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* ── Hoạt động 3 / 6 tháng ────────────────────────────────────── */}
      <Panel>
        <PanelHeader eyebrow="Dòng tiền" title="Hoạt động gần đây" />
        <PanelBody>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Chỉ số</th>
                  <th style={{ textAlign: 'right' }}>3 tháng</th>
                  <th style={{ textAlign: 'right' }}>6 tháng</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Tiền vào" a={short(w3.total_in)} b={short(w6.total_in)} />
                <Row label="Tiền ra" a={short(w3.total_out)} b={short(w6.total_out)} />
                <Row label="Dòng tiền ròng" a={short(w3.net_flow)} b={short(w6.net_flow)} strong />
                <Row label="Số giao dịch" a={String(w3.txn_count)} b={String(w6.txn_count)} />
                <Row
                  label="Trung bình mỗi tháng"
                  a={String(w3.txn_per_month)}
                  b={String(w6.txn_per_month)}
                />
                <Row
                  label="Giao dịch lớn nhất"
                  a={short(w3.max_txn_amount)}
                  b={short(w6.max_txn_amount)}
                />
                <Row
                  label="Tháng có phát sinh"
                  a={`${w3.active_months}/3`}
                  b={`${w6.active_months}/6`}
                />
              </tbody>
            </table>
          </div>

          {trend.net_flow_pct !== null && (
            <p className={`trend trend--${trend.direction === 'flat' ? 'up' : trend.direction}`}>
              {trend.direction === 'up' ? (
                <TrendingUp size={16} />
              ) : trend.direction === 'down' ? (
                <TrendingDown size={16} />
              ) : (
                <Minus size={16} />
              )}
              {trend.direction === 'flat'
                ? 'Dòng tiền ròng đi ngang so với 3 tháng trước đó'
                : `Dòng tiền ròng 3 tháng gần ${trend.direction === 'up' ? 'tăng' : 'giảm'} ${Math.abs(trend.net_flow_pct)}% so với 3 tháng trước đó`}
            </p>
          )}

          {w3.spend_tags.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p className="stat__label">Nhóm chi tiêu nổi bật</p>
              <div className="chip-row">
                {w3.spend_tags.map((t) => (
                  <span key={t.tag} className="chip">
                    {t.tag} · {t.txn_count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

/** Ô chỉ số hiện tại + quan hệ — đặt ở cột phải nên tách riêng. */
export function CustomerSnapshot({ data }: { data: NbaAssessment }) {
  const { current, relationship } = data;

  return (
    <Panel>
      <PanelHeader eyebrow="Hồ sơ" title="Vị thế hiện tại" />
      <PanelBody>
        <div className="stat-grid">
          <Stat label="Số dư tài khoản" value={vnd(current.casa_avg)} />
          <Stat label="Tổng dư nợ" value={vnd(current.total_debt)} />
          <Stat
            label="Nợ / thu nhập"
            value={current.dti === null ? 'chưa xác định' : `${(current.dti * 100).toFixed(1)}%`}
          />
          <Stat
            label="Nhóm CIC"
            value={current.cic_group === null ? '—' : `Nhóm ${current.cic_group}`}
          />
          <Stat label="Tuổi" value={current.age === null ? '—' : String(current.age)} />
          <Stat
            label="Khoản quá hạn"
            value={current.has_overdue ? 'Có' : 'Không'}
            danger={current.has_overdue}
          />
        </div>

        <p className="subtle" style={{ marginTop: 12, marginBottom: 0 }}>
          Số dư và dư nợ là giá trị hiện tại — hệ thống chưa lưu lịch sử số dư nên không tính trung
          bình theo tháng được.
        </p>

        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />

        <div className="stack-sm">
          <div>
            <p className="stat__label">Đang sử dụng</p>
            {relationship.held_products.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
                Chưa có sản phẩm nào
              </p>
            ) : (
              <div className="chip-row">
                {relationship.held_products.map((h, i) => (
                  <span key={i} className="chip">
                    {PROD[h.product] ?? h.product}
                    {h.tier ? ` · ${h.tier}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="stat__label">Lần tiếp cận gần nhất</p>
            <p style={{ margin: 0, fontSize: '0.86rem' }}>
              {relationship.last_contact_days === null ? (
                <span className="muted">Chưa từng tiếp cận</span>
              ) : (
                `${relationship.last_contact_days} ngày trước`
              )}
              {relationship.last_feedback && ` · ${relationship.last_feedback.status}`}
            </p>
          </div>

          {relationship.suppressed.length > 0 && (
            <div>
              <p className="stat__label">Đang tạm hoãn</p>
              <div className="chip-row">
                {relationship.suppressed.map((s, i) => (
                  <span
                    key={i}
                    className="chip"
                    style={{
                      color: 'var(--danger)',
                      borderColor: 'var(--danger-line)',
                      background: 'var(--danger-soft)',
                    }}
                  >
                    {PROD[s.product] ?? s.product} · tới {s.until_date}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
}

function Row({ label, a, b, strong }: { label: string; a: string; b: string; strong?: boolean }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="num" style={{ textAlign: 'right', fontWeight: strong ? 700 : 500 }}>
        {a}
      </td>
      <td className="num muted" style={{ textAlign: 'right' }}>
        {b}
      </td>
    </tr>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`stat${danger ? ' stat--danger' : ''}`}>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
    </div>
  );
}

function PackageRow({
  pkg,
  open,
  onToggle,
}: {
  pkg: NbaPackageAssessment;
  open: boolean;
  onToggle: () => void;
}) {
  const passed = pkg.criteria.filter((c) => c.passed).length;

  return (
    <div className={`pkg pkg--${pkg.eligible ? 'pass' : 'fail'}`}>
      <button type="button" className="pkg__toggle" onClick={onToggle} aria-expanded={open}>
        <span className="pkg__mark">{pkg.eligible ? <Check size={13} /> : <X size={13} />}</span>
        <span className="pkg__name">
          <strong>{pkg.package}</strong>
          <span className="pkg__meta">
            {PROD[pkg.product] ?? pkg.product}
            {pkg.tier ? ` · ${pkg.tier}` : ''}
            {!pkg.eligible &&
              pkg.blocked_by.length > 0 &&
              ` · chặn bởi ${pkg.blocked_by.join(', ')}`}
          </span>
        </span>
        {pkg.multiplier !== 1 && (
          <Badge tone={pkg.multiplier > 1 ? 'success' : 'warning'}>×{pkg.multiplier}</Badge>
        )}
        <span className="pkg__count">
          {passed}/{pkg.criteria.length}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div className="pkg__criteria">
          {pkg.criteria.map((c) => (
            <Criterion key={c.code} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function Criterion({ c }: { c: NbaCriterion }) {
  const tone = c.passed ? 'pass' : c.blocking ? 'fail' : 'soft';
  return (
    <div className={`criterion criterion--${tone}`}>
      <span className="criterion__mark">{c.passed ? <Check size={14} /> : <X size={14} />}</span>
      <div>
        <span className="criterion__label">{c.label}</span>
        <span className="criterion__code">
          {c.code} · {c.source === 'catalog' ? 'điều kiện sản phẩm' : 'rule'}
          {!c.blocking && ' · không chặn'}
        </span>
        <p className="criterion__fact">
          {c.actual} <span className="criterion__need">· yêu cầu: {c.required}</span>
        </p>
      </div>
    </div>
  );
}
