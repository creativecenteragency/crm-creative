-- Permite que los miembros de un workspace (no solo el master) editen sus
-- campos adicionales y el mapeo de campos de Forminator, sin darles UPDATE
-- directo sobre toda la fila de `workspaces` (que también tiene name y
-- webhook_token).

drop policy if exists workspace_fields_write on public.workspace_fields;
create policy workspace_fields_write on public.workspace_fields
  for all using (is_master() or is_workspace_member(workspace_id))
  with check (is_master() or is_workspace_member(workspace_id));

create or replace function public.update_workspace_field_mapping(p_workspace_id uuid, p_field_mapping jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_master() or is_workspace_member(p_workspace_id)) then
    raise exception 'not authorized';
  end if;
  update public.workspaces set field_mapping = p_field_mapping where id = p_workspace_id;
end;
$$;

grant execute on function public.update_workspace_field_mapping(uuid, jsonb) to authenticated;
