-- Fuente de leads por workspace + etiquetas de Kommo como dato estructurado.
--
-- Mercator dejó de recibir leads por Forminator y pasó a Kommo. Cada workspace
-- declara cuál es su fuente ACTIVA de leads ('forminator' o 'kommo'), y la
-- Configuración/tabla de leads muestran lo que corresponde a esa fuente. Los
-- leads históricos de la otra fuente siguen en la misma tabla, sin tocarse.

alter table public.workspaces
  add column lead_source text not null default 'forminator'
  check (lead_source in ('forminator', 'kommo'));

update public.workspaces set lead_source = 'kommo'
where id = '6a01a57f-56b7-47f9-b1e7-ccb4e68c2745';

-- Etiquetas del lead (hoy solo las de Kommo). Antes solo quedaban como texto
-- dentro de extra->'Etiquetas'; como array se pueden filtrar por SQL/API y no
-- se pierde información si mañana cambian qué etiquetas se consideran válidas.
alter table public.leads add column tags text[] not null default '{}';
create index leads_tags_idx on public.leads using gin (tags);

update public.leads
set tags = string_to_array(extra->>'Etiquetas', ', ')
where external_source = 'kommo' and coalesce(extra->>'Etiquetas', '') <> '';

-- Etiquetas que hacen que un lead de Kommo cuente para las métricas. Todos los
-- leads se importan igual; un lead sin ninguna de estas etiquetas queda
-- marcado como "no cuenta para métricas" (se decide al leer, no al importar,
-- así cambiar esta lista no obliga a re-sincronizar nada).
alter table public.kommo_sync_state
  add column valid_tags text[] not null default array['Formulario', 'Pauta-Directo'];

-- La lista de etiquetas válidas la edita desde Configuración un master o un
-- admin del workspace (la sincronización escribe con service role y no pasa por acá).
create policy kommo_sync_state_update on public.kommo_sync_state
  for update using (is_master() or is_workspace_admin(workspace_id))
  with check (is_master() or is_workspace_admin(workspace_id));
