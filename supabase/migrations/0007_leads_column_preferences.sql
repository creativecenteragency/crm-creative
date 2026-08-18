-- Guarda, por usuario y por workspace, qué columnas de la tabla de leads
-- están visibles y en qué orden. `columns` es un array ordenado de
-- { key: string, visible: boolean } que cubre tanto columnas core como
-- columnas de campos adicionales (workspace_fields).

create table public.leads_column_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  columns jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

alter table public.leads_column_preferences enable row level security;

create policy leads_column_preferences_all on public.leads_column_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
