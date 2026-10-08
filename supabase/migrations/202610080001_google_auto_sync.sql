-- Add checkpoints and renewable watch metadata without replacing existing events or connections.
alter table public.google_connections
  add column if not exists sync_token text,
  add column if not exists sync_requested_at timestamptz,
  add column if not exists watch_channel_id uuid,
  add column if not exists watch_resource_id text,
  add column if not exists watch_token text,
  add column if not exists watch_expires_at timestamptz;

create index if not exists google_connections_watch_due
  on public.google_connections(watch_expires_at);

-- Keep provider token data service-role only. Existing RLS and grants remain unchanged.
