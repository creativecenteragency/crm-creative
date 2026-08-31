-- Soporte para sincronizar leads desde un CRM externo (Kommo, por ahora solo
-- Mercator) por polling en vez de webhook. Kommo no nos manda nada — cada
-- corrida le pregunta a su API qué leads se movieron y hace upsert acá.

-- Todo lead traído de afuera se identifica por (workspace_id, external_source,
-- external_id) para poder actualizarlo en la próxima corrida sin duplicar.
-- Los leads de Forminator (la gran mayoría) no tocan estas columnas.
alter table public.leads add column external_source text;
alter table public.leads add column external_id text;

create unique index leads_external_unique_idx
  on public.leads (workspace_id, external_source, external_id)
  where external_id is not null;

-- Checkpoint + resultado de la última corrida, por workspace. Que exista una
-- fila acá es lo que habilita el botón "Sincronizar ahora" en el CRM para ese
-- workspace — no hay ninguna columna en `workspaces` marcando "usa Kommo".
create table public.kommo_sync_state (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  last_updated_ts bigint not null default 0,
  last_synced_at timestamptz,
  last_result jsonb
);

alter table public.kommo_sync_state enable row level security;

create policy kommo_sync_state_read on public.kommo_sync_state
  for select using (is_master() or is_workspace_admin(workspace_id));

-- Fila para Mercator (el único workspace con Kommo hoy). last_updated_ts en 0
-- => la primera corrida barre toda la cuenta desde el principio.
insert into public.kommo_sync_state (workspace_id, last_updated_ts)
values ('6a01a57f-56b7-47f9-b1e7-ccb4e68c2745', 0);
