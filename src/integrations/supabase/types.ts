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
  public: {
    Tables: {
      campaigns: {
        Row: {
          audience: string
          created_at: string
          created_by: string | null
          engaged: number
          id: string
          name: string
          payments: number
          product: string
          revenue_cents: number
          sent: number
          status: Database["public"]["Enums"]["campaign_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by?: string | null
          engaged?: number
          id?: string
          name: string
          payments?: number
          product?: string
          revenue_cents?: number
          sent?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string | null
          engaged?: number
          id?: string
          name?: string
          payments?: number
          product?: string
          revenue_cents?: number
          sent?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_activity_at: string | null
          lifecycle_stage: Database["public"]["Enums"]["lifecycle_stage"]
          phone: string | null
          recovery_score: number
          source: string
          tags: string[]
          tenant_id: string
          updated_at: string
          value_cents: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          last_activity_at?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["lifecycle_stage"]
          phone?: string | null
          recovery_score?: number
          source?: string
          tags?: string[]
          tenant_id: string
          updated_at?: string
          value_cents?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          last_activity_at?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["lifecycle_stage"]
          phone?: string | null
          recovery_score?: number
          source?: string
          tags?: string[]
          tenant_id?: string
          updated_at?: string
          value_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_opportunities: {
        Row: {
          created_at: string
          cta: string
          evidence: Json
          formats: string[]
          generated_content: string | null
          hook: string
          id: string
          occurrences: number
          signal_id: string | null
          tenant_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta: string
          evidence?: Json
          formats?: string[]
          generated_content?: string | null
          hook: string
          id?: string
          occurrences?: number
          signal_id?: string | null
          tenant_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta?: string
          evidence?: Json
          formats?: string[]
          generated_content?: string | null
          hook?: string
          id?: string
          occurrences?: number
          signal_id?: string | null
          tenant_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_opportunities_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "demand_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          channel: string
          contact_id: string | null
          created_at: string
          id: string
          intent: string | null
          last_message_at: string
          status: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          last_message_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          last_message_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_signals: {
        Row: {
          created_at: string
          frequency: number
          id: string
          intent_score: number
          source: string
          status: Database["public"]["Enums"]["signal_status"]
          tenant_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency?: number
          id?: string
          intent_score?: number
          source?: string
          status?: Database["public"]["Enums"]["signal_status"]
          tenant_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: number
          id?: string
          intent_score?: number
          source?: string
          status?: Database["public"]["Enums"]["signal_status"]
          tenant_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          filename: string
          id: string
          imported_count: number
          row_count: number
          status: Database["public"]["Enums"]["import_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          filename: string
          id?: string
          imported_count?: number
          row_count?: number
          status?: Database["public"]["Enums"]["import_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          filename?: string
          id?: string
          imported_count?: number
          row_count?: number
          status?: Database["public"]["Enums"]["import_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          provider: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          provider: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          provider?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leakage_records: {
        Row: {
          amount_cents: number
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          id: string
          item_count: number
          period_start: string
          stage: string
          tenant_id: string
        }
        Insert: {
          amount_cents?: number
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          id?: string
          item_count?: number
          period_start?: string
          stage: string
          tenant_id: string
        }
        Update: {
          amount_cents?: number
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          id?: string
          item_count?: number
          period_start?: string
          stage?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leakage_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          sender: string
          tenant_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          sender?: string
          tenant_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          sender?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          provider: string
          reference: string
          status: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount_cents?: number
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          provider?: string
          reference: string
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount_cents?: number
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          provider?: string
          reference?: string
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          lapsed_at: string | null
          next_due_at: string | null
          policy_number: string
          premium_cents: number
          product: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          lapsed_at?: string | null
          next_due_at?: string | null
          policy_number: string
          premium_cents?: number
          product?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          lapsed_at?: string | null
          next_due_at?: string | null
          policy_number?: string
          premium_cents?: number
          product?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          job_title?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          currency: string
          id: string
          industry: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          industry?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          industry?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "agent" | "viewer"
      campaign_status:
        | "draft"
        | "scheduled"
        | "running"
        | "paused"
        | "completed"
      confidence_level: "high" | "medium" | "estimated"
      conversation_status: "open" | "waiting" | "escalated" | "closed"
      import_status: "pending" | "processing" | "completed" | "failed"
      lifecycle_stage:
        | "lead"
        | "active"
        | "at_risk"
        | "dormant"
        | "lapsed"
        | "recovered"
        | "churned"
      message_direction: "inbound" | "outbound"
      payment_status: "pending" | "verified" | "failed" | "refunded"
      signal_status: "new" | "watching" | "opportunity" | "archived"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "agent", "viewer"],
      campaign_status: ["draft", "scheduled", "running", "paused", "completed"],
      confidence_level: ["high", "medium", "estimated"],
      conversation_status: ["open", "waiting", "escalated", "closed"],
      import_status: ["pending", "processing", "completed", "failed"],
      lifecycle_stage: [
        "lead",
        "active",
        "at_risk",
        "dormant",
        "lapsed",
        "recovered",
        "churned",
      ],
      message_direction: ["inbound", "outbound"],
      payment_status: ["pending", "verified", "failed", "refunded"],
      signal_status: ["new", "watching", "opportunity", "archived"],
    },
  },
} as const
