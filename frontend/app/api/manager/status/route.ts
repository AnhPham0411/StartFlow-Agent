import { NextResponse } from 'next/server';
import {
  demoManagerStaff,
  summarizeManagerStaff,
  summarizeStaffTeams,
} from '@/src/data/demo-manager-staff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const demoMode =
    process.env.NEXT_PUBLIC_AUTH_MODE === 'demo' &&
    process.env.NEXT_PUBLIC_DEMO_PUBLIC_WARNING === 'true';
  const authorization = request.headers.get('authorization');
  if (
    (demoMode && authorization !== 'Bearer demo-manager-token') ||
    (!demoMode && !authorization?.startsWith('Bearer '))
  ) {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  return NextResponse.json(
    {
      staff: demoManagerStaff,
      summary: summarizeManagerStaff(demoManagerStaff),
      teams: summarizeStaffTeams(demoManagerStaff),
      synthetic: true,
      observedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
