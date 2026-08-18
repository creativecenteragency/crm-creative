-- Permite marcar un campo adicional del cliente como checkbox (además de
-- text/textarea/select), para poder mapear formularios de Forminator con
-- varios selects y checkboxes por cliente sin tocar código.
alter table public.workspace_fields drop constraint if exists workspace_fields_field_type_check;
alter table public.workspace_fields add constraint workspace_fields_field_type_check
  check (field_type in ('text', 'textarea', 'select', 'checkbox'));
