-- Roles por workspace (admin/member) + detección de si un usuario invitado ya
-- aceptó la invitación (entró y eligió contraseña) o sigue pendiente.
--
-- Antes de esto, cualquier miembro de un workspace podía tocar Configuración,
-- Ajustes de marca, importar CSV y borrar leads. Para no sacarle acceso a nadie
-- que ya lo tenía, todas las filas EXISTENTES de workspace_members se
-- backfillean a 'admin' — el default de la columna para invitaciones NUEVAS
-- queda en 'member' (más restrictivo), así que de acá en adelante hay que
-- promover explícitamente a alguien para darle esos permisos.

alter table public.workspace_members
  add column role text not null default 'member' check (role in ('admin', 'member'));

update public.workspace_members set role = 'admin';

create function public.is_workspace_admin(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid() and wm.role = 'admin'
  );
$$;

-- workspace_members: además del master, un admin del workspace puede
-- gestionar (invitar vía RPC/edge function, cambiar rol, quitar) a la gente
-- de SU propio workspace.
drop policy if exists workspace_members_write on public.workspace_members;
create policy workspace_members_write on public.workspace_members
  for all using (is_master() or is_workspace_admin(workspace_id))
  with check (is_master() or is_workspace_admin(workspace_id));

-- Configuración (mapeo de Forminator, campos adicionales) pasa a ser
-- admin-only — antes cualquier miembro podía tocarlo.
drop policy if exists workspace_fields_write on public.workspace_fields;
create policy workspace_fields_write on public.workspace_fields
  for all using (is_master() or is_workspace_admin(workspace_id))
  with check (is_master() or is_workspace_admin(workspace_id));

create or replace function public.update_workspace_field_mapping(p_workspace_id uuid, p_field_mapping jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_master() or is_workspace_admin(p_workspace_id)) then
    raise exception 'not authorized';
  end if;
  update public.workspaces set field_mapping = p_field_mapping where id = p_workspace_id;
end;
$$;

-- Ajustes de marca (logo, color, firma) pasa a ser admin-only.
drop policy if exists workspace_branding_write on public.workspace_branding;
create policy workspace_branding_write on public.workspace_branding
  for all using (is_master() or is_workspace_admin(workspace_id))
  with check (is_master() or is_workspace_admin(workspace_id));

-- Importar leads por CSV (insert directo desde el navegador, no vía webhook
-- con service role) pasa a ser admin-only.
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert with check (is_master() or is_workspace_admin(workspace_id));

-- Borrar leads: antes solo el master de la agencia podía. Ahora también un
-- admin del workspace del cliente.
drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete using (is_master() or is_workspace_admin(workspace_id));

-- ============================================================
-- Detección de invitación aceptada: se refleja last_sign_in_at de auth.users
-- en profiles (no es accesible directo por RLS normal) para poder mostrar
-- "Invitación pendiente" vs "Activo" en la UI sin necesitar service role.
-- ============================================================
alter table public.profiles add column last_sign_in_at timestamptz;

create function public.sync_last_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set last_sign_in_at = new.last_sign_in_at where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_sign_in
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute procedure public.sync_last_sign_in();
