-- Fecha del próximo seguimiento de un lead, para poder mostrar "atrasados / para hoy"
-- sin depender de un envío de mail (no hay infraestructura de cron todavía).
alter table public.leads add column next_contact_at timestamptz;
