# CRM Creative

CRM de leads multi-cliente. Frontend en React + Vite (hosteado en GitHub Pages), datos en Supabase (Postgres + Auth con RLS).

## Arquitectura

- **Cuenta MASTER** (agencia): ve y administra todos los clientes (workspaces).
- **Workspace** = un cliente/marca. Cada uno tiene sus propios campos, opciones de "tipo de consulta", usuarios asignados y token de webhook.
- Los leads entran por un webhook desde Forminator → una Supabase Edge Function los guarda directo en la base.

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto en Supabase

1. En [supabase.com](https://supabase.com), crear un **proyecto nuevo** (separado de cualquier otro que ya tengas).
2. Ir a **SQL Editor** y correr el contenido de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Ir a **Project Settings → API** y copiar:
   - `Project URL`
   - `anon public` key

### 2. Configurar el frontend localmente

```bash
cp .env.example .env.local
```

Completar `.env.local` con la URL y la anon key del paso anterior. Después:

```bash
npm install
npm run dev
```

### 3. Crear tu primer usuario MASTER

1. En Supabase → **Authentication → Users → Add user**, crear tu usuario (email + password).
2. En **SQL Editor**, marcarlo como master:
   ```sql
   update public.profiles set is_master = true where email = 'tu-email@creativecenter.com';
   ```

### 4. Crear un cliente (workspace)

Desde el CRM, logueado como master: **Administrar clientes → + Nuevo cliente**. Después entrá a su configuración para:

- Definir el **mapeo de campos**: qué slug de Forminator corresponde a cada campo interno (nombre, email, teléfono, tipo de consulta, mensaje, y los que quieras agregar como "extra", ej. empresa).
- Definir las **opciones del select de "tipo de consulta"**.
- Copiar la **URL del webhook** y pegarla en Forminator (Behaviour Settings → Webhook / Integrations, según la [documentación de Forminator](https://wpmudev.com/docs/wpmu-dev-plugins/forminator/#webhook)).
- **Asignar usuarios**: el usuario del cliente debe existir primero en Authentication → Users (invitalo desde ahí), y luego buscalo por email en esta pantalla.

Para saber el slug que Forminator usa para cada campo, mirá el HTML del formulario (inputs `name="name-1"`, `name="email-1"`, etc.) o revisá el primer payload que llegue al webhook (Supabase → Edge Functions → Logs).

### 5. Deployar la Edge Function del webhook

Requiere la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase functions deploy ingest-lead
```

### 6. Deploy a GitHub Pages

1. Crear el repositorio en GitHub (si todavía no existe) y hacer push de este código a `main`.
2. En **Settings → Pages**, elegir "GitHub Actions" como source.
3. En **Settings → Secrets and variables → Actions**, agregar:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Cada push a `main` dispara el deploy automático (ver `.github/workflows/deploy.yml`).

## Desarrollo local

```bash
npm run dev       # servidor de desarrollo
npm run build     # build de producción + type-check
```
