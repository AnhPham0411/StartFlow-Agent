import { type NextRequest, NextResponse } from 'next/server';

/**
 * Proxy: GET /api/nba-customers → BE /api/nba/calllist?date=... để lấy danh sách cơ bản.
 * Thực ra customers list cần endpoint riêng. Tạm proxy qua calllist ngày hôm nay để lấy name/phone.
 * TODO: thêm GET /api/nba/customers riêng ở BE trả toàn bộ customers.
 */
export async function GET(req: NextRequest) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const auth = req.headers.get('authorization') ?? '';
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(`${apiUrl}/api/nba/calllist?date=${today}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json([], { status: 200 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch from backend calllist:', error);
    return NextResponse.json([], { status: 200 });
  }
}
