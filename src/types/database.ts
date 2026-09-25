export type LeadStatus = 'nuevo' | 'contactado' | 'cotizado' | 'ganado' | 'perdido'
export type LeadRating = 'bueno' | 'regular' | 'malo'
export type FieldType = 'text' | 'textarea' | 'select' | 'checkbox'

// Nota: estos son `type` (no `interface`) a propósito — un `interface` con props
// requeridas no satisface el chequeo estructural `extends Record<string, unknown>`
// que usa internamente @supabase/postgrest-js, y todo el tipado de la tabla colapsa
// silenciosamente a `never`. Con `type` (object literal) sí funciona.
export type Workspace = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  webhook_token: string
  // Fuente ACTIVA de leads de este cliente. Los históricos de la otra fuente
  // siguen en la misma tabla.
  lead_source: 'forminator' | 'kommo'
  field_mapping: Record<string, string>
  created_at: string
}

export type WorkspaceField = {
  id: string
  workspace_id: string
  key: string
  label: string
  field_type: FieldType
  options: string[] | null
  sort_order: number
  created_at: string
}

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  is_master: boolean
  created_at: string
  // Se refleja desde auth.users.last_sign_in_at vía trigger — null significa que
  // la persona nunca inició sesión (invitación pendiente), no que nunca fue invitada.
  last_sign_in_at: string | null
}

export type WorkspaceRole = 'admin' | 'member'

export type WorkspaceMember = {
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  created_at: string
}

export type EmailTemplate = {
  id: string
  workspace_id: string
  slot: number
  name: string
  subject: string
  body: string
  updated_at: string
}

export type WorkspaceBranding = {
  workspace_id: string
  logo_url: string | null
  primary_color: string
  signature_name: string | null
  signature_role: string | null
  updated_at: string
}

export type LeadEmail = {
  id: string
  lead_id: string
  workspace_id: string
  template_slot: number | null
  subject: string
  body_html: string
  sent_by: string | null
  sent_at: string
}

export type PushSubscriptionRow = {
  id: string
  user_id: string
  workspace_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export type LeadColumnConfig = { key: string; visible: boolean }

export type LeadsColumnPreferences = {
  user_id: string
  workspace_id: string
  columns: LeadColumnConfig[]
  view: LeadsView | null
  updated_at: string
}

// Filtros y orden de la tabla de leads que el usuario puede guardar como su vista.
export type LeadsView = {
  status: LeadStatus | 'all'
  rating: LeadRating | 'all'
  origin: 'all' | 'form' | 'kommo'
  validity: 'all' | 'counts' | 'excluded'
  // Etiquetas de Kommo elegidas (selección múltiple; el lead entra si tiene alguna).
  tags?: string[]
  showSpam: boolean
  hideDuplicates: boolean
  sortKey: string
  sortDirection: 'asc' | 'desc'
  pageSize: number
}

export type Lead = {
  id: string
  workspace_id: string
  created_at: string
  updated_at: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  message: string | null
  inquiry_type: string | null
  extra: Record<string, string>
  source_url: string | null
  source_channel: string | null
  source_campaign_id: string | null
  landing_page: string | null
  status: LeadStatus
  rating: LeadRating | null
  is_spam: boolean
  next_contact_at: string | null
  // Solo para leads traídos por polling desde un CRM externo (hoy: Kommo,
  // solo Mercator). null en cualquier lead que entró por el webhook normal.
  external_source: string | null
  external_id: string | null
  // Etiquetas del CRM externo (Kommo). [] en leads que entraron por formulario.
  tags: string[]
  // Seguimiento de origen (Kommo): solo los leads que entraron desde la web lo traen.
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  referrer: string | null
}

export type KommoSyncState = {
  workspace_id: string
  last_updated_ts: number
  // Un lead de Kommo cuenta para métricas solo si tiene alguna de estas etiquetas.
  valid_tags: string[]
  last_synced_at: string | null
  last_result: { revisados: number; upserted: number; errors: string[]; tope_alcanzado: boolean } | null
  // Embudos y etapas de Kommo en su orden original (null hasta la primera sincronización nueva).
  pipelines: KommoPipeline[] | null
}

// type: 0 etapa normal, 1 entrada, 142 ganado, 143 perdido.
export type KommoStage = { id: number; name: string; sort: number; type: number }
export type KommoPipeline = { id: number; name: string; sort: number; stages: KommoStage[] }

// `Relationships: []` es una simplificación deliberada — no describimos las FKs al tipo,
// así que los `select('tabla(*)')` embebidos devuelven `any` en vez de tipado estricto.
// Los hooks que hacen esos joins castean el resultado explícitamente.
export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: Workspace
        Insert: Partial<Workspace> & { name: string; slug: string }
        Update: Partial<Workspace>
        Relationships: []
      }
      workspace_fields: {
        Row: WorkspaceField
        Insert: Partial<WorkspaceField> & { workspace_id: string; key: string; label: string; field_type: FieldType }
        Update: Partial<WorkspaceField>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string }
        Update: Partial<Profile>
        Relationships: []
      }
      workspace_members: {
        Row: WorkspaceMember
        Insert: Partial<WorkspaceMember> & { workspace_id: string; user_id: string }
        Update: Partial<WorkspaceMember>
        Relationships: []
      }
      leads: {
        Row: Lead
        Insert: Partial<Lead> & { workspace_id: string }
        Update: Partial<Lead>
        Relationships: []
      }
      email_templates: {
        Row: EmailTemplate
        Insert: Partial<EmailTemplate> & { workspace_id: string; slot: number }
        Update: Partial<EmailTemplate>
        Relationships: []
      }
      workspace_branding: {
        Row: WorkspaceBranding
        Insert: Partial<WorkspaceBranding> & { workspace_id: string }
        Update: Partial<WorkspaceBranding>
        Relationships: []
      }
      kommo_sync_state: {
        Row: KommoSyncState
        Insert: Partial<KommoSyncState> & { workspace_id: string }
        Update: Partial<KommoSyncState>
        Relationships: []
      }
      lead_emails: {
        Row: LeadEmail
        Insert: Partial<LeadEmail> & { lead_id: string; workspace_id: string; subject: string; body_html: string }
        Update: Partial<LeadEmail>
        Relationships: []
      }
      leads_column_preferences: {
        Row: LeadsColumnPreferences
        Insert: Partial<LeadsColumnPreferences> & { user_id: string; workspace_id: string }
        Update: Partial<LeadsColumnPreferences>
        Relationships: []
      }
      push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: Partial<PushSubscriptionRow> & {
          user_id: string
          workspace_id: string
          endpoint: string
          p256dh: string
          auth: string
        }
        Update: Partial<PushSubscriptionRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      update_workspace_field_mapping: {
        Args: { p_workspace_id: string; p_field_mapping: Record<string, string> }
        Returns: void
      }
    }
  }
}
