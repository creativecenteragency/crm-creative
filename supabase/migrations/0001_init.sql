-- CRM Creative — esquema inicial
-- Modelo: cuenta MASTER (agencia) + N workspaces (uno por marca/cliente), aislados por RLS.

create extension if not exists "pgcrypto";

-- ============================================================
-- WORKSPACES
-- ============================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  -- token secreto usado por el webhook de Forminator para identificar el workspace sin login
  webhook_token uuid not null default gen_random_uuid(),
  -- mapea claves internas (first_name, last_name, email, phone, message, inquiry_type, company...)
  -- al slug del campo tal como lo manda el webhook de Forminator de ESE formulario.
  -- ej: {"first_name": "name-1", "email": "email-1", "inquiry_type": "select-1"}
  field_mapping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on column public.workspaces.webhook_token is
  'Token opaco incluido en la URL del webhook de Forminator. No requiere auth de usuario, solo identifica a qué workspace pertenece el lead entrante.';

-- ============================================================
-- WORKSPACE_FIELDS — define el select de "tipo de consulta" y campos extra por cliente
-- ============================================================
create table public.workspace_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null,                -- ej: 'inquiry_type', 'company'
  label text not null,              -- ej: 'Motivo de consulta'
  field_type text not null check (field_type in ('text', 'textarea', 'select')),
  options jsonb,                    -- array de strings, solo para field_type = 'select'
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, key)
);

-- ============================================================
-- PROFILES — extiende auth.users
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  is_master boolean not null default false,  -- true = usuario de la agencia, ve todos los workspaces
  created_at timestamptz not null default now()
);

-- Crea automáticamente un profile cuando se registra un usuario en auth.users
-- (copia el email para que el master pueda buscar/asignar usuarios existentes por email desde la UI)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- WORKSPACE_MEMBERS — a qué workspace(s) tiene acceso cada usuario cliente
-- ============================================================
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ============================================================
-- LEADS
-- ============================================================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- campos core (comunes a todos los clientes)
  first_name text,
  last_name text,
  email text,
  phone text,
  message text,

  -- campo variable por workspace (el select de "tipo de consulta")
  inquiry_type text,

  -- cualquier campo extra que no sea core (ej: empresa) queda acá
  extra jsonb not null default '{}'::jsonb,

  -- atribución / fuente
  source_url text,
  source_channel text,       -- 'google_ads' | 'organic' | 'direct' | etc, parseado del source_url
  source_campaign_id text,
  landing_page text,

  -- seguimiento comercial
  status text not null default 'nuevo'
    check (status in ('nuevo', 'contactado', 'cotizado', 'ganado', 'perdido')),
  rating text
    check (rating in ('bueno', 'regular', 'malo')),
  is_spam boolean not null default false
);

create index leads_workspace_id_idx on public.leads (workspace_id);
create index leads_status_idx on public.leads (workspace_id, status);
create index leads_created_at_idx on public.leads (workspace_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- HELPER FUNCTIONS (security definer para evitar recursión de RLS)
-- ============================================================
create function public.is_master()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_master = true
  );
$$;

create function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.workspaces enable row level security;
alter table public.workspace_fields enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.leads enable row level security;

-- workspaces
create policy "workspaces_select" on public.workspaces
  for select using (public.is_master() or public.is_workspace_member(id));

create policy "workspaces_insert" on public.workspaces
  for insert with check (public.is_master());

create policy "workspaces_update" on public.workspaces
  for update using (public.is_master());

create policy "workspaces_delete" on public.workspaces
  for delete using (public.is_master());

-- workspace_fields
create policy "workspace_fields_select" on public.workspace_fields
  for select using (public.is_master() or public.is_workspace_member(workspace_id));

create policy "workspace_fields_write" on public.workspace_fields
  for all using (public.is_master()) with check (public.is_master());

-- profiles
create policy "profiles_select" on public.profiles
  for select using (public.is_master() or id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid() or public.is_master());

-- workspace_members
create policy "workspace_members_select" on public.workspace_members
  for select using (public.is_master() or user_id = auth.uid());

create policy "workspace_members_write" on public.workspace_members
  for all using (public.is_master()) with check (public.is_master());

-- leads
create policy "leads_select" on public.leads
  for select using (public.is_master() or public.is_workspace_member(workspace_id));

create policy "leads_insert" on public.leads
  for insert with check (public.is_master() or public.is_workspace_member(workspace_id));

create policy "leads_update" on public.leads
  for update using (public.is_master() or public.is_workspace_member(workspace_id));

create policy "leads_delete" on public.leads
  for delete using (public.is_master());
