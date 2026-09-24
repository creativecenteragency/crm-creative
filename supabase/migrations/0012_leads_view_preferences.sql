-- Vista guardada de la tabla de leads (filtros y orden), por usuario y por
-- workspace. Vive junto a las columnas visibles en la misma fila; null = el
-- usuario no guardó ninguna y se usan los valores por defecto.
-- Forma: { status, rating, origin, validity, showSpam, hideDuplicates,
--          sortKey, sortDirection, pageSize }

alter table public.leads_column_preferences
  add column if not exists view jsonb;
