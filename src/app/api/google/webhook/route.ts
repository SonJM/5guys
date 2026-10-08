import { after } from 'next/server';
import { adminDb } from '@/lib/server';
import { syncGoogle } from '@/lib/google';

export const maxDuration = 300;

export async function POST(request: Request) {
  const channel = request.headers.get('x-goog-channel-id');
  const token = request.headers.get('x-goog-channel-token');
  const resource = request.headers.get('x-goog-resource-id');
  if (!channel || !token || !resource) return new Response(null, { status: 401 });
  const db = adminDb();
  const { data, error } = await db.from('google_connections').select('user_id')
    .eq('watch_channel_id', channel).eq('watch_token', token)
    .eq('watch_resource_id', resource).maybeSingle();
  if (error || !data) return new Response(null, { status: 401 });
  if (request.headers.get('x-goog-resource-state') !== 'sync') {
    await db.from('google_connections').update({ sync_requested_at: new Date().toISOString() })
      .eq('user_id', data.user_id);
    after(async () => {
      try { await syncGoogle(data.user_id); } catch { /* dashboard or daily recovery retries */ }
    });
  }
  return new Response(null, { status: 204 });
}
