import { NextRequest, NextResponse } from 'next/server';
import { loadCalendarMonth } from '@/app/planner-actions';
import { apiError } from '@/lib/server';

export async function GET(request: NextRequest) {
  try {
    // Authenticated, owner-filtered DB reads only. Never trigger Google sync here.
    const data = await loadCalendarMonth(request.nextUrl.searchParams.get('month') ?? '');
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
