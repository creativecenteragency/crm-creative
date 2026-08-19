-- Suscripciones a notificaciones push (Web Push). Cada fila = "este
-- dispositivo quiere avisos de leads nuevos de este workspace". ingest-lead
-- lee esta tabla con el service-role key (bypassa RLS) para enviar los push.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, workspace_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_all on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
