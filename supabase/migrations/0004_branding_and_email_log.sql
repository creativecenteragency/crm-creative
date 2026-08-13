-- Identidad de marca por workspace (logo, color institucional, firma) editable
-- tanto por el master como por los usuarios del workspace, y bitácora de emails
-- enviados a cada lead.

-- ============================================================
-- WORKSPACE_BRANDING
-- ============================================================
create table public.workspace_branding (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  logo_url text,
  primary_color text not null default '#EA6A2A',
  signature_name text,
  signature_role text,
  updated_at timestamptz not null default now()
);

create trigger workspace_branding_set_updated_at
  before update on public.workspace_branding
  for each row execute procedure public.set_updated_at();

alter table public.workspace_branding enable row level security;

create policy "workspace_branding_select" on public.workspace_branding
  for select using (public.is_master() or public.is_workspace_member(workspace_id));

create policy "workspace_branding_write" on public.workspace_branding
  for all using (public.is_master() or public.is_workspace_member(workspace_id))
  with check (public.is_master() or public.is_workspace_member(workspace_id));

-- backfill: el logo que ya estaba cargado en workspaces.logo_url pasa a ser el punto de partida
insert into public.workspace_branding (workspace_id, logo_url)
select id, logo_url from public.workspaces
on conflict (workspace_id) do nothing;

-- ============================================================
-- LEAD_EMAILS — bitácora de emails enviados desde la plataforma a un lead
-- ============================================================
create table public.lead_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_slot int,
  subject text not null,
  body_html text not null,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now()
);

create index lead_emails_lead_id_idx on public.lead_emails (lead_id, sent_at desc);

alter table public.lead_emails enable row level security;

create policy "lead_emails_select" on public.lead_emails
  for select using (public.is_master() or public.is_workspace_member(workspace_id));

create policy "lead_emails_insert" on public.lead_emails
  for insert with check (public.is_master() or public.is_workspace_member(workspace_id));
