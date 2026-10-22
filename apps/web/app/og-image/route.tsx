import { ImageResponse } from 'next/og';

/** The picture shown when someone shares seatline.ch (LinkedIn, Teams, Slack, search results). */
export function GET() {
  const desk = (color: string, opacity = 1) => (
    <div style={{ width: 120, height: 90, borderRadius: 18, background: color, opacity }} />
  );
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 72,
        padding: 80,
        background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 60%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          width: 312,
          padding: 24,
          borderRadius: 48,
          background: '#2563eb',
        }}
      >
        {desk('#ffffff')}
        {desk('#ffffff', 0.55)}
        {desk('#ffffff', 0.55)}
        {desk('#4ade80')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
        <div style={{ fontSize: 40, color: '#2563eb', fontWeight: 700 }}>Seatline</div>
        <div style={{ fontSize: 72, fontWeight: 700, color: '#0f172a', lineHeight: 1.05 }}>
          Know who sits where.
        </div>
        <div style={{ fontSize: 32, color: '#475569' }}>
          Seating plans for companies · Hosted in Switzerland
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
