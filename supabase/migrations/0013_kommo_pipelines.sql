-- Estructura de embudos y etapas de Kommo (con su orden), refrescada por
-- sync-kommo-leads en cada corrida. El Kanban de los clientes con Kommo la usa
-- para dibujar las mismas columnas que se ven en Kommo.
-- Forma: [{ id, name, sort, stages: [{ id, name, sort, type }] }]
-- type: 0 = etapa normal, 1 = entrada, 142 = ganado, 143 = perdido.

alter table public.kommo_sync_state
  add column if not exists pipelines jsonb;
