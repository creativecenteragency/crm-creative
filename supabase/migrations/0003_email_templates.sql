-- 3 plantillas de email editables por workspace, para enviarle correos a los leads
-- y (más adelante) para las alertas de seguimiento.
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slot smallint not null check (slot in (1, 2, 3)),
  name text not null default '',
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique (workspace_id, slot)
);

alter table public.email_templates enable row level security;

create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute procedure public.set_updated_at();

create policy "email_templates_select" on public.email_templates
  for select using (public.is_master() or public.is_workspace_member(workspace_id));

create policy "email_templates_write" on public.email_templates
  for all using (public.is_master() or public.is_workspace_member(workspace_id))
  with check (public.is_master() or public.is_workspace_member(workspace_id));
