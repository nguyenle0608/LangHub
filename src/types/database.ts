export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_audit_events: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string
          id: string
          metadata: Json
          org_id: string
          outcome: string
          project_id: string | null
          request_id: string
          token_id: string | null
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id: string
          outcome: string
          project_id?: string | null
          request_id: string
          token_id?: string | null
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string
          outcome?: string
          project_id?: string | null
          request_id?: string
          token_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "api_audit_events_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "api_audit_events_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "api_audit_events_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "api_audit_events_token_id_fkey"; columns: ["token_id"]; isOneToOne: false; referencedRelation: "api_tokens"; referencedColumns: ["id"] },
        ]
      }
      api_idempotency_keys: {
        Row: { created_at: string; expires_at: string; idempotency_key: string; request_hash: string; response_body: Json | null; response_status: number | null; snapshot_id: string | null; state: string; token_id: string; updated_at: string }
        Insert: { created_at?: string; expires_at?: string; idempotency_key: string; request_hash: string; response_body?: Json | null; response_status?: number | null; snapshot_id?: string | null; state?: string; token_id: string; updated_at?: string }
        Update: { created_at?: string; expires_at?: string; idempotency_key?: string; request_hash?: string; response_body?: Json | null; response_status?: number | null; snapshot_id?: string | null; state?: string; token_id?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "api_idempotency_keys_snapshot_id_fkey"; columns: ["snapshot_id"]; isOneToOne: false; referencedRelation: "versions"; referencedColumns: ["id"] },
          { foreignKeyName: "api_idempotency_keys_token_id_fkey"; columns: ["token_id"]; isOneToOne: false; referencedRelation: "api_tokens"; referencedColumns: ["id"] },
        ]
      }
      api_rate_limit_buckets: {
        Row: { bucket_start: string; request_count: number; request_kind: string; token_id: string }
        Insert: { bucket_start: string; request_count?: number; request_kind: string; token_id: string }
        Update: { bucket_start?: string; request_count?: number; request_kind?: string; token_id?: string }
        Relationships: [{ foreignKeyName: "api_rate_limit_buckets_token_id_fkey"; columns: ["token_id"]; isOneToOne: false; referencedRelation: "api_tokens"; referencedColumns: ["id"] }]
      }
      api_tokens: {
        Row: { created_at: string; created_by: string | null; expires_at: string | null; id: string; last_used_at: string | null; name: string; org_id: string; revoked_at: string | null; scope: string; token_hash: string; token_prefix: string }
        Insert: { created_at?: string; created_by?: string | null; expires_at?: string | null; id?: string; last_used_at?: string | null; name: string; org_id: string; revoked_at?: string | null; scope?: string; token_hash: string; token_prefix: string }
        Update: { created_at?: string; created_by?: string | null; expires_at?: string | null; id?: string; last_used_at?: string | null; name?: string; org_id?: string; revoked_at?: string | null; scope?: string; token_hash?: string; token_prefix?: string }
        Relationships: [{ foreignKeyName: "api_tokens_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }]
      }
      branches: {
        Row: {
          base_snapshot_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_default: boolean | null
          is_locked: boolean | null
          name: string
          parent_branch_id: string | null
          project_id: string
        }
        Insert: {
          base_snapshot_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          is_locked?: boolean | null
          name: string
          parent_branch_id?: string | null
          project_id: string
        }
        Update: {
          base_snapshot_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          is_locked?: boolean | null
          name?: string
          parent_branch_id?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_base_snapshot_id_fkey"
            columns: ["base_snapshot_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_parent_branch_id_fkey"
            columns: ["parent_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          created_at: string
          id: string
          key_id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_id: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "translation_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      glossary_terms: {
        Row: { case_sensitive: boolean; created_at: string; created_by: string | null; description: string | null; id: string; org_id: string; source_locale: string; source_normalized: string; source_term: string; target_locale: string; target_term: string; updated_at: string; whole_word: boolean }
        Insert: { case_sensitive?: boolean; created_at?: string; created_by?: string | null; description?: string | null; id?: string; org_id: string; source_locale: string; source_normalized: string; source_term: string; target_locale: string; target_term: string; updated_at?: string; whole_word?: boolean }
        Update: { case_sensitive?: boolean; created_at?: string; created_by?: string | null; description?: string | null; id?: string; org_id?: string; source_locale?: string; source_normalized?: string; source_term?: string; target_locale?: string; target_term?: string; updated_at?: string; whole_word?: boolean }
        Relationships: [
          { foreignKeyName: "glossary_terms_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
        ]
      }
      locales: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_base: boolean | null
          name: string
          project_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_base?: boolean | null
          name: string
          project_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_base?: boolean | null
          name?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locales_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string | null
          id: string
          org_id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          plan: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          plan?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          plan?: string | null
          slug?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          base_locale: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          org_id: string | null
          slug: string
        }
        Insert: {
          base_locale?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          slug: string
        }
        Update: {
          base_locale?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string | null
          new_value: string | null
          old_status: string | null
          old_value: string | null
          translation_id: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string | null
          new_value?: string | null
          old_status?: string | null
          old_value?: string | null
          translation_id?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string | null
          new_value?: string | null
          old_status?: string | null
          old_value?: string | null
          translation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "translation_history_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "translations"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_memory_entries: {
        Row: { branch_id: string | null; created_at: string; fingerprint: string; id: string; key_id: string | null; last_used_at: string | null; org_id: string; project_id: string | null; quality: string; source_locale: string; source_normalized: string; source_text: string; target_locale: string; target_text: string; updated_at: string; usage_count: number }
        Insert: { branch_id?: string | null; created_at?: string; fingerprint: string; id?: string; key_id?: string | null; last_used_at?: string | null; org_id: string; project_id?: string | null; quality?: string; source_locale: string; source_normalized: string; source_text: string; target_locale: string; target_text: string; updated_at?: string; usage_count?: number }
        Update: { branch_id?: string | null; created_at?: string; fingerprint?: string; id?: string; key_id?: string | null; last_used_at?: string | null; org_id?: string; project_id?: string | null; quality?: string; source_locale?: string; source_normalized?: string; source_text?: string; target_locale?: string; target_text?: string; updated_at?: string; usage_count?: number }
        Relationships: [
          { foreignKeyName: "translation_memory_entries_branch_id_fkey"; columns: ["branch_id"]; isOneToOne: false; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "translation_memory_entries_key_id_fkey"; columns: ["key_id"]; isOneToOne: false; referencedRelation: "translation_keys"; referencedColumns: ["id"] },
          { foreignKeyName: "translation_memory_entries_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "translation_memory_entries_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
        ]
      }
      translation_keys: {
        Row: {
          branch_id: string
          char_limit: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_plural: boolean | null
          key: string
          platforms: string[] | null
          plural_forms: Json | null
          project_id: string | null
          reference_key_id: string | null
          tags: string[] | null
        }
        Insert: {
          branch_id: string
          char_limit?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_plural?: boolean | null
          key: string
          platforms?: string[] | null
          plural_forms?: Json | null
          project_id?: string | null
          reference_key_id?: string | null
          tags?: string[] | null
        }
        Update: {
          branch_id?: string
          char_limit?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_plural?: boolean | null
          key?: string
          platforms?: string[] | null
          plural_forms?: Json | null
          project_id?: string | null
          reference_key_id?: string | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "translation_keys_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_keys_reference_key_id_fkey"
            columns: ["reference_key_id"]
            isOneToOne: false
            referencedRelation: "translation_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          ai_model: string | null
          ai_suggested_at: string | null
          ai_suggestion: string | null
          branch_id: string
          id: string
          key_id: string | null
          locale_id: string | null
          reviewed_by: string | null
          status: string | null
          translated_by: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_suggested_at?: string | null
          ai_suggestion?: string | null
          branch_id: string
          id?: string
          key_id?: string | null
          locale_id?: string | null
          reviewed_by?: string | null
          status?: string | null
          translated_by?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_suggested_at?: string | null
          ai_suggestion?: string | null
          branch_id?: string
          id?: string
          key_id?: string | null
          locale_id?: string | null
          reviewed_by?: string | null
          status?: string | null
          translated_by?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "translations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translations_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "translation_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translations_locale_id_fkey"
            columns: ["locale_id"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["id"]
          },
        ]
      }
      version_snapshots: {
        Row: {
          id: string
          key_id: string | null
          key_name: string
          locale_code: string
          locale_id: string | null
          status: string | null
          value: string | null
          version_id: string | null
        }
        Insert: {
          id?: string
          key_id?: string | null
          key_name: string
          locale_code: string
          locale_id?: string | null
          status?: string | null
          value?: string | null
          version_id?: string | null
        }
        Update: {
          id?: string
          key_id?: string | null
          key_name?: string
          locale_code?: string
          locale_id?: string | null
          status?: string | null
          value?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "version_snapshots_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "translation_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_snapshots_locale_id_fkey"
            columns: ["locale_id"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "version_snapshots_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      version_stats: {
        Row: {
          approved_count: number | null
          empty_count: number | null
          pending_count: number | null
          total_keys: number | null
          total_locales: number | null
          version_id: string
        }
        Insert: {
          approved_count?: number | null
          empty_count?: number | null
          pending_count?: number | null
          total_keys?: number | null
          total_locales?: number | null
          version_id: string
        }
        Update: {
          approved_count?: number | null
          empty_count?: number | null
          pending_count?: number | null
          total_keys?: number | null
          total_locales?: number | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "version_stats_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      versions: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          project_id: string | null
          tag: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          project_id?: string | null
          tag?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          project_id?: string | null
          tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "versions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_idempotent_translation_import: {
        Args: { p_actor_user_id?: string | null; p_api_token_id: string; p_branch_id: string; p_entries: Json; p_filename: string; p_idempotency_key: string; p_locale_id: string; p_project_id: string; p_request_hash: string; p_request_id: string; p_skipped?: number; p_snapshot_id: string; p_total?: number }
        Returns: Json
      }
      apply_translation_import: {
        Args: { p_actor_user_id?: string | null; p_api_token_id?: string | null; p_branch_id: string; p_entries: Json; p_locale_id: string; p_project_id: string; p_request_id?: string }
        Returns: Json
      }
      consume_api_rate_limit: {
        Args: { p_limit: number; p_request_kind: string; p_token_id: string; p_window_seconds?: number }
        Returns: { allowed: boolean; remaining: number; reset_at: string }[]
      }
      create_api_token: {
        Args: { p_active_limit?: number; p_expires_at?: string | null; p_name: string; p_org_id: string; p_scope: string; p_token_hash: string; p_token_prefix: string; p_user_id: string }
        Returns: { created_at: string; created_by: string | null; expires_at: string | null; id: string; last_used_at: string | null; name: string; revoked_at: string | null; scope: string; token_prefix: string }[]
      }
      backfill_translation_memory: {
        Args: { p_after_translation_id?: string | null; p_batch_size?: number }
        Returns: Json
      }
      get_branches_bootstrap: {
        Args: {
          p_project_id: string
        }
        Returns: {
          project: Json
          branches: Json
          role: string | null
        }[]
      }
      get_branches_dashboard: {
        Args: {
          p_project_id: string
        }
        Returns: {
          id: string
          project_id: string
          name: string
          parent_branch_id: string | null
          is_default: boolean | null
          is_locked: boolean | null
          base_snapshot_id: string | null
          created_by: string | null
          created_at: string | null
          key_count: number
          locale_count: number
          approved_percent: number
        }[]
      }
      get_projects_dashboard: {
        Args: {
          p_org_id: string
        }
        Returns: {
          id: string
          org_id: string | null
          name: string
          slug: string
          description: string | null
          base_locale: string | null
          created_at: string | null
          key_count: number
          locale_count: number
          overall_percent: number
          locales: Json
        }[]
      }
      get_editor_bootstrap: {
        Args: {
          p_project_id: string
          p_branch_id?: string | null
        }
        Returns: {
          project: Json
          branches: Json
          active_branch_id: string | null
          role: string | null
        }[]
      }
      get_user_organizations: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          slug: string
          plan: string
          created_at: string | null
          role: string
          member_count: number
          project_count: number
        }[]
      }
      record_translation_memory_usage: {
        Args: { p_entry_id: string; p_org_id: string }
        Returns: boolean
      }
      search_translation_memory: {
        Args: { p_limit?: number; p_org_id: string; p_source_locale: string; p_source_text: string; p_target_locale: string; p_threshold?: number }
        Returns: { id: string; last_used_at: string | null; match_kind: string; project_id: string | null; score: number; source_text: string; target_text: string; usage_count: number }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
