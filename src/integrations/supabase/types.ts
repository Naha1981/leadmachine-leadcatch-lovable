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
      auto_reply_configs: {
        Row: {
          after_hours: string
          after_hours_message: string
          created_at: string
          enabled: boolean
          greeting: string
          handoff: string
          handoff_message: string
          id: string
          keyword_rules: Json
          qualification_questions: string[]
          questions: Json
          review_link: string | null
          review_request_message: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          after_hours?: string
          after_hours_message?: string
          created_at?: string
          enabled?: boolean
          greeting?: string
          handoff?: string
          handoff_message?: string
          id?: string
          keyword_rules?: Json
          qualification_questions?: string[]
          questions?: Json
          review_link?: string | null
          review_request_message?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          after_hours?: string
          after_hours_message?: string
          created_at?: string
          enabled?: boolean
          greeting?: string
          handoff?: string
          handoff_message?: string
          id?: string
          keyword_rules?: Json
          qualification_questions?: string[]
          questions?: Json
          review_link?: string | null
          review_request_message?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_reply_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          brand_voice: string
          business_name: string
          market_intelligence_enabled: boolean
          market_intelligence_keywords: Json
          market_intelligence_source_preferences: Json
          market_intelligence_website: string | null
          contact_phone: string | null
          created_at: string
          id: string
          industry: string
          onboarded: boolean
          pricing_notes: string
          services: string
          suburb: string | null
          tenant_id: string
          trade: string
          updated_at: string
          wa_account_id: string | null
          whatsapp_last_seen_at: string | null
          whatsapp_last_synced_at: string | null
          whatsapp_number: string | null
          whatsapp_status: string
          working_hours: Json
        }
        Insert: {
          brand_voice?: string
          business_name?: string
          market_intelligence_enabled?: boolean
          market_intelligence_keywords?: Json
          market_intelligence_source_preferences?: Json
          market_intelligence_website?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string
          onboarded?: boolean
          pricing_notes?: string
          services?: string
          suburb?: string | null
          tenant_id?: string
          trade?: string
          updated_at?: string
          wa_account_id?: string | null
          whatsapp_last_seen_at?: string | null
          whatsapp_last_synced_at?: string | null
          whatsapp_number?: string | null
          whatsapp_status?: string
          working_hours?: Json
        }
        Update: {
          brand_voice?: string
          business_name?: string
          market_intelligence_enabled?: boolean
          market_intelligence_keywords?: Json
          market_intelligence_source_preferences?: Json
          market_intelligence_website?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          industry?: string
          onboarded?: boolean
          pricing_notes?: string
          services?: string
          suburb?: string | null
          tenant_id?: string
          trade?: string
          updated_at?: string
          wa_account_id?: string | null
          whatsapp_last_seen_at?: string | null
          whatsapp_last_synced_at?: string | null
          whatsapp_number?: string | null
          whatsapp_status?: string
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      conversation_messages: {
        Row: {
          body: string
          conversation_id: string | null
          created_at: string
          delivery_status: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_id: string | null
          id: string
          is_auto: boolean
          lead_id: string
          sender: string
          tenant_id: string
        }
        Insert: {
          body: string
          conversation_id?: string | null
          created_at?: string
          delivery_status?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          is_auto?: boolean
          lead_id: string
          sender?: string
          tenant_id?: string
        }
        Update: {
          body?: string
          conversation_id?: string | null
          created_at?: string
          delivery_status?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          is_auto?: boolean
          lead_id?: string
          sender?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_tenant_id_fkey"
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
          last_message_preview: string | null
          lead_id: string | null
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
          last_message_preview?: string | null
          lead_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
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
          last_message_preview?: string | null
          lead_id?: string | null
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
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      lead_events: {
        Row: {
          actor_id: string | null
          event_type: string
          id: string
          lead_id: string
          metadata: Json
          occurred_at: string
          payload: Json
          tenant_id: string
          type: string | null
        }
        Insert: {
          actor_id?: string | null
          event_type?: string
          id?: string
          lead_id: string
          metadata?: Json
          occurred_at?: string
          payload?: Json
          tenant_id?: string
          type?: string | null
        }
        Update: {
          actor_id?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          metadata?: Json
          occurred_at?: string
          payload?: Json
          tenant_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          actual_revenue_cents: number | null
          ai_score: number | null
          ai_scored_at: string | null
          ai_summary: string | null
          ai_temperature: string | null
          created_at: string
          estimated_value_cents: number | null
          first_response_at: string | null
          id: string
          last_message_at: string
          name: string | null
          notes: string | null
          phone: string
          service: string | null
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          suburb: string | null
          tenant_id: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          actual_revenue_cents?: number | null
          ai_score?: number | null
          ai_scored_at?: string | null
          ai_summary?: string | null
          ai_temperature?: string | null
          created_at?: string
          estimated_value_cents?: number | null
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          name?: string | null
          notes?: string | null
          phone: string
          service?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          suburb?: string | null
          tenant_id?: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          actual_revenue_cents?: number | null
          ai_score?: number | null
          ai_scored_at?: string | null
          ai_summary?: string | null
          ai_temperature?: string | null
          created_at?: string
          estimated_value_cents?: number | null
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          name?: string | null
          notes?: string | null
          phone?: string
          service?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          suburb?: string | null
          tenant_id?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_tenant_id_fkey"
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
      pending_actions: {
        Row: {
          action_type: string
          attempts: number
          created_at: string
          created_by: string | null
          id: string
          last_error: string | null
          lead_id: string | null
          message_id: string | null
          payload: Json
          processed_at: string | null
          status: Database["public"]["Enums"]["action_status"]
          tenant_id: string
        }
        Insert: {
          action_type: string
          attempts?: number
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          lead_id?: string | null
          message_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          tenant_id?: string
        }
        Update: {
          action_type?: string
          attempts?: number
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          lead_id?: string | null
          message_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_actions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
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
      quote_submissions: {
        Row: {
          created_at: string
          id: string
          ip_hash: string
          phone: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash: string
          phone?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string
          phone?: string | null
          slug?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          currency: string
          id: string
          industry: string
          name: string
          onboarded: boolean
          owner_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          industry?: string
          name?: string
          onboarded?: boolean
          owner_id?: string | null
          slug?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          industry?: string
          name?: string
          onboarded?: boolean
          owner_id?: string | null
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
      websites: {
        Row: {
          about: string
          accent: string
          created_at: string
          cta_text: string
          faqs: Json
          headline: string
          id: string
          published: boolean
          services: Json
          slug: string
          subheadline: string
          tenant_id: string
          testimonials: Json
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          about?: string
          accent?: string
          created_at?: string
          cta_text?: string
          faqs?: Json
          headline?: string
          id?: string
          published?: boolean
          services?: Json
          slug: string
          subheadline?: string
          tenant_id?: string
          testimonials?: Json
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          about?: string
          accent?: string
          created_at?: string
          cta_text?: string
          faqs?: Json
          headline?: string
          id?: string
          published?: boolean
          services?: Json
          slug?: string
          subheadline?: string
          tenant_id?: string
          testimonials?: Json
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "websites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_operator_credentials: {
        Row: {
          app_id: string
          created_at: string
          id: string
          tenant_id: string
          tenant_token: string
          updated_at: string
          wa_account_id: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          id?: string
          tenant_id: string
          tenant_token: string
          updated_at?: string
          wa_account_id?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          tenant_token?: string
          updated_at?: string
          wa_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_operator_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          event: string
          id: string
          message_id: string | null
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
          tenant_id: string | null
        }
        Insert: {
          event: string
          id?: string
          message_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          tenant_id?: string | null
        }
        Update: {
          event?: string
          id?: string
          message_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_ui_action_receipts: {
        Row: {
          agent_action_id: string
          created_at: string
          external_id: string | null
          id: string
          output_summary: Json
          provider: string
          status: string
          step: string
          tenant_id: string
        }
        Insert: {
          agent_action_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          output_summary?: Json
          provider: string
          status: string
          step: string
          tenant_id: string
        }
        Update: {
          agent_action_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          output_summary?: Json
          provider?: string
          status?: string
          step?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_ui_action_receipts_agent_action_id_fkey"
            columns: ["agent_action_id"]
            isOneToOne: false
            referencedRelation: "zero_ui_agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zero_ui_action_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_ui_agent_actions: {
        Row: {
          action: string
          action_class: string
          agent_run_id: string | null
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          idempotency_key: string
          input: Json
          result: Json
          status: string
          target_id: string | null
          target_type: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          action_class: string
          agent_run_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key: string
          input?: Json
          result?: Json
          status?: string
          target_id?: string | null
          target_type?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          action_class?: string
          agent_run_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string
          input?: Json
          result?: Json
          status?: string
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_ui_agent_actions_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "zero_ui_agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zero_ui_agent_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_ui_agent_runs: {
        Row: {
          completed_at: string | null
          correlation_id: string | null
          error: string | null
          id: string
          input_summary: Json
          intent: string | null
          model: string | null
          output_summary: Json
          provider: string | null
          started_at: string
          status: string
          tenant_id: string
          trigger: string
        }
        Insert: {
          completed_at?: string | null
          correlation_id?: string | null
          error?: string | null
          id?: string
          input_summary?: Json
          intent?: string | null
          model?: string | null
          output_summary?: Json
          provider?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          trigger: string
        }
        Update: {
          completed_at?: string | null
          correlation_id?: string | null
          error?: string | null
          id?: string
          input_summary?: Json
          intent?: string | null
          model?: string | null
          output_summary?: Json
          provider?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_ui_agent_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_ui_approvals: {
        Row: {
          agent_action_id: string
          id: string
          note: string | null
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          agent_action_id: string
          id?: string
          note?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          agent_action_id?: string
          id?: string
          note?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_ui_approvals_agent_action_id_fkey"
            columns: ["agent_action_id"]
            isOneToOne: true
            referencedRelation: "zero_ui_agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zero_ui_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_ui_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          metadata: Json
          result: string
          target_id: string | null
          target_type: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: string
          metadata?: Json
          result?: string
          target_id?: string | null
          target_type?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          result?: string
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_ui_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_ui_configs: {
        Row: {
          auto_followups_enabled: boolean
          automation_enabled: boolean
          created_at: string
          daily_summary_enabled: boolean
          enabled: boolean
          id: string
          owner_alerts_enabled: boolean
          require_followup_approval: boolean
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          auto_followups_enabled?: boolean
          automation_enabled?: boolean
          created_at?: string
          daily_summary_enabled?: boolean
          enabled?: boolean
          id?: string
          owner_alerts_enabled?: boolean
          require_followup_approval?: boolean
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          auto_followups_enabled?: boolean
          automation_enabled?: boolean
          created_at?: string
          daily_summary_enabled?: boolean
          enabled?: boolean
          id?: string
          owner_alerts_enabled?: boolean
          require_followup_approval?: boolean
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_ui_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_ui_followups: {
        Row: {
          agent_action_id: string | null
          attempt_count: number
          created_at: string
          error: string | null
          id: string
          lead_id: string
          message: string
          reason: string
          scheduled_at: string
          sent_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          agent_action_id?: string | null
          attempt_count?: number
          created_at?: string
          error?: string | null
          id?: string
          lead_id: string
          message: string
          reason?: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          agent_action_id?: string | null
          attempt_count?: number
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string
          message?: string
          reason?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_ui_followups_agent_action_id_fkey"
            columns: ["agent_action_id"]
            isOneToOne: false
            referencedRelation: "zero_ui_agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zero_ui_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zero_ui_followups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zero_ui_platform_settings: {
        Row: {
          enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      zero_ui_usage_events: {
        Row: {
          event_type: string
          id: string
          idempotency_key: string | null
          metadata: Json
          occurred_at: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          event_type: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          occurred_at?: string
          quantity?: number
          tenant_id: string
        }
        Update: {
          event_type?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          occurred_at?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zero_ui_usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      market_intelligence_competitors: {
        Row: {
          created_at: string
          discovered_at: string
          id: string
          last_checked_at: string | null
          name: string
          source: string
          status: string
          tenant_id: string
          updated_at: string
          website_url: string
        }
        Insert: {
          created_at?: string
          discovered_at?: string
          id?: string
          last_checked_at?: string | null
          name: string
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          website_url: string
        }
        Update: {
          created_at?: string
          discovered_at?: string
          id?: string
          last_checked_at?: string | null
          name?: string
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_intelligence_competitors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      market_intelligence_documents: {
        Row: {
          author: string | null
          content: string
          content_hash: string
          created_at: string
          discovered_at: string
          external_id: string | null
          id: string
          metadata: Json
          processed_at: string | null
          processing_error: string | null
          published_at: string | null
          source: string
          source_type: string
          source_url: string
          status: string
          tenant_id: string
          title: string
        }
        Insert: {
          author?: string | null
          content: string
          content_hash: string
          created_at?: string
          discovered_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          processed_at?: string | null
          processing_error?: string | null
          published_at?: string | null
          source: string
          source_type: string
          source_url: string
          status?: string
          tenant_id?: string
          title?: string
        }
        Update: {
          author?: string | null
          content?: string
          content_hash?: string
          created_at?: string
          discovered_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          processed_at?: string | null
          processing_error?: string | null
          published_at?: string | null
          source?: string
          source_type?: string
          source_url?: string
          status?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_intelligence_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      market_intelligence_evidence: {
        Row: {
          author: string | null
          created_at: string
          discovered_at: string
          evidence_hash: string
          evidence_text: string
          external_id: string | null
          id: string
          published_at: string | null
          signal_id: string
          source: string
          source_metadata: Json
          source_type: string
          source_url: string
          tenant_id: string
          title: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          discovered_at?: string
          evidence_hash: string
          evidence_text: string
          external_id?: string | null
          id?: string
          published_at?: string | null
          signal_id: string
          source: string
          source_metadata?: Json
          source_type: string
          source_url: string
          tenant_id?: string
          title?: string
        }
        Update: {
          author?: string | null
          created_at?: string
          discovered_at?: string
          evidence_hash?: string
          evidence_text?: string
          external_id?: string | null
          id?: string
          published_at?: string | null
          signal_id?: string
          source?: string
          source_metadata?: Json
          source_type?: string
          source_url?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_intelligence_evidence_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "market_intelligence_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_intelligence_evidence_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      market_intelligence_platform_settings: {
        Row: {
          enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      market_intelligence_runs: {
        Row: {
          accepted_signals: number
          candidate_signals: number
          completed_at: string | null
          documents_collected: number
          duplicates_removed: number
          error: string | null
          failures: number
          id: string
          metrics: Json
          mode: string
          started_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          accepted_signals?: number
          candidate_signals?: number
          completed_at?: string | null
          documents_collected?: number
          duplicates_removed?: number
          error?: string | null
          failures?: number
          id?: string
          metrics?: Json
          mode?: string
          started_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          accepted_signals?: number
          candidate_signals?: number
          completed_at?: string | null
          documents_collected?: number
          duplicates_removed?: number
          error?: string | null
          failures?: number
          id?: string
          metrics?: Json
          mode?: string
          started_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_intelligence_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      market_intelligence_signals: {
        Row: {
          category: string
          cluster_key: string
          confidence: number
          created_at: string
          expires_at: string | null
          evidence_strength: string
          first_observed_at: string
          freshness_score: number
          id: string
          inference: string
          last_observed_at: string
          recommended_action: string
          recurrence_count: number
          relevance_score: number
          source_diversity: number
          status: string
          summary: string
          tenant_id: string
          title: string
          updated_at: string
          observed_claim: string
        }
        Insert: {
          category: string
          cluster_key: string
          confidence?: number
          created_at?: string
          expires_at?: string | null
          evidence_strength?: string
          first_observed_at?: string
          freshness_score?: number
          id?: string
          inference: string
          last_observed_at?: string
          recommended_action: string
          recurrence_count?: number
          relevance_score?: number
          source_diversity?: number
          status?: string
          summary: string
          tenant_id?: string
          title: string
          updated_at?: string
          observed_claim: string
        }
        Update: {
          category?: string
          cluster_key?: string
          confidence?: number
          created_at?: string
          expires_at?: string | null
          evidence_strength?: string
          first_observed_at?: string
          freshness_score?: number
          id?: string
          inference?: string
          last_observed_at?: string
          recommended_action?: string
          recurrence_count?: number
          relevance_score?: number
          source_diversity?: number
          status?: string
          summary?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          observed_claim?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_intelligence_signals_tenant_id_fkey"
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
      complete_onboarding: {
        Args: {
          p_business_name: string
          p_contact_phone: string
          p_end?: string
          p_start?: string
          p_suburb: string
          p_trade: string
        }
        Returns: string
      }
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
      action_status: "pending" | "processing" | "done" | "failed"
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
      lead_status:
        | "new"
        | "replied"
        | "qualified"
        | "quoted"
        | "won"
        | "lost"
        | "closed"
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
      action_status: ["pending", "processing", "done", "failed"],
      app_role: ["owner", "admin", "agent", "viewer"],
      campaign_status: ["draft", "scheduled", "running", "paused", "completed"],
      confidence_level: ["high", "medium", "estimated"],
      conversation_status: ["open", "waiting", "escalated", "closed"],
      import_status: ["pending", "processing", "completed", "failed"],
      lead_status: [
        "new",
        "replied",
        "qualified",
        "quoted",
        "won",
        "lost",
        "closed",
      ],
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
