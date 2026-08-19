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
}

export type WorkspaceMember = {
  workspace_id: string
  user_id: string
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
  updated_at: string
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
}

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
