-- Datos de seguimiento (UTM + referrer) de los leads que vienen de Kommo.
-- Kommo los guarda como campos de tipo tracking_data en el lead y solo los trae
-- cuando el lead entró desde la web (formulario / anuncio); los que llegan por
-- WhatsApp directo no los tienen. sync-kommo-leads los completa en cada corrida.

alter table public.leads
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists referrer text;
