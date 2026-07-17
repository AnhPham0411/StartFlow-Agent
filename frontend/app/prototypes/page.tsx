const cardBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  background: '#fff',
  border: '1px solid #e8e8e6',
  borderRadius: 16,
  padding: '20px 24px',
  textDecoration: 'none',
  color: 'inherit',
};

const swatch: React.CSSProperties = {
  width: 18,
  height: 44,
  borderRadius: 5,
  display: 'inline-block',
};

const versions = [
  {
    href: '/prototypes/case-queue-dashboard.html',
    name: 'v1 · Editorial',
    desc: 'Kem ấm, cam Cursor, hairline, grain giấy. Giọng tạp chí.',
    tag: 'ổn định',
    colors: ['#f7f7f4', '#f54e00', '#26251e'],
  },
  {
    href: '/prototypes/case-queue-serenity.html',
    name: 'v2 · Serenity',
    desc: 'Xám nhạt, Outfit, kính mờ, lime + xanh lá. Nhẹ nhàng, thư thái.',
    tag: 'đang thử',
    colors: ['#f2f3f1', '#faff7f', '#0c9762'],
  },
];

export default function PrototypesPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f4f4f4',
        display: 'grid',
        placeItems: 'center',
        padding: '48px 24px',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#141414',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        <h1 style={{ fontSize: 28, fontWeight: 400, letterSpacing: -0.5, margin: '0 0 6px' }}>
          SHB StartFlow — Prototypes
        </h1>
        <p style={{ color: '#6b6b66', margin: '0 0 36px' }}>
          Màn hình 1 · Hàng đợi hồ sơ. Chọn một phiên bản để xem.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {versions.map((v) => (
            <a key={v.href} href={v.href} style={cardBase}>
              <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
                {v.colors.map((c) => (
                  <span key={c} style={{ ...swatch, background: c, border: '1px solid #e2e2de' }} />
                ))}
              </span>
              <span>
                <span style={{ fontWeight: 600 }}>{v.name}</span>
                <div style={{ color: '#6b6b66', fontSize: 14, marginTop: 2 }}>{v.desc}</div>
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: '#6b6b66',
                  border: '1px solid #e0e0dc',
                  borderRadius: 999,
                  padding: '3px 10px',
                  flex: 'none',
                }}
              >
                {v.tag}
              </span>
            </a>
          ))}
        </div>
        <p style={{ marginTop: 32, fontSize: 13, color: '#a5a59e' }}>
          <a href="/dashboard" style={{ color: '#6b6b66' }}>
            → Vào app thật (dashboard)
          </a>
        </p>
      </div>
    </main>
  );
}
