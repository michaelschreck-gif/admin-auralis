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
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          payload: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      competitor_reports: {
        Row: {
          id: string
          competitor_id: string
          profile_id: string
          trigger: Database["public"]["Enums"]["trigger_type"]
          visibility_score: number | null
          sentiment: Database["public"]["Enums"]["sentiment_type"] | null
          summary: string | null
          raw_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          competitor_id: string
          profile_id: string
          trigger?: Database["public"]["Enums"]["trigger_type"]
          visibility_score?: number | null
          sentiment?: Database["public"]["Enums"]["sentiment_type"] | null
          summary?: string | null
          raw_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          competitor_id?: string
          profile_id?: string
          trigger?: Database["public"]["Enums"]["trigger_type"]
          visibility_score?: number | null
          sentiment?: Database["public"]["Enums"]["sentiment_type"] | null
          summary?: string | null
          raw_data?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_reports_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string
          id: string
          language: Database["public"]["Enums"]["language_type"]
          last_analyzed_at: string | null
          last_score: number | null
          name: string
          profile_id: string
          topics: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["language_type"]
          last_analyzed_at?: string | null
          last_score?: number | null
          name: string
          profile_id: string
          topics?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["language_type"]
          last_analyzed_at?: string | null
          last_score?: number | null
          name?: string
          profile_id?: string
          topics?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "competitors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_schedules: {
        Row: {
          created_at: string
          frequency: Database["public"]["Enums"]["frequency_type"]
          id: string
          is_active: boolean
          language: Database["public"]["Enums"]["language_type"]
          last_run_at: string | null
          name: string
          next_run_at: string
          profile_id: string
          query: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency?: Database["public"]["Enums"]["frequency_type"]
          id?: string
          is_active?: boolean
          language?: Database["public"]["Enums"]["language_type"]
          last_run_at?: string | null
          name: string
          next_run_at?: string
          profile_id: string
          query: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: Database["public"]["Enums"]["frequency_type"]
          id?: string
          is_active?: boolean
          language?: Database["public"]["Enums"]["language_type"]
          last_run_at?: string | null
          name?: string
          next_run_at?: string
          profile_id?: string
          query?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_admin: boolean
          language: Database["public"]["Enums"]["language_type"]
          plan: Database["public"]["Enums"]["plan_type"]
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          language?: Database["public"]["Enums"]["language_type"]
          plan?: Database["public"]["Enums"]["plan_type"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          language?: Database["public"]["Enums"]["language_type"]
          plan?: Database["public"]["Enums"]["plan_type"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      query_results: {
        Row: {
          brand_mentioned: boolean
          created_at: string
          id: string
          latency_ms: number | null
          model: string
          position: number | null
          profile_id: string
          prompt: string
          report_id: string
          response: string | null
          sentiment: Database["public"]["Enums"]["sentiment_type"] | null
          tokens_used: number | null
        }
        Insert: {
          brand_mentioned?: boolean
          created_at?: string
          id?: string
          latency_ms?: number | null
          model: string
          position?: number | null
          profile_id: string
          prompt: string
          report_id: string
          response?: string | null
          sentiment?: Database["public"]["Enums"]["sentiment_type"] | null
          tokens_used?: number | null
        }
        Update: {
          brand_mentioned?: boolean
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string
          position?: number | null
          profile_id?: string
          prompt?: string
          report_id?: string
          response?: string | null
          sentiment?: Database["public"]["Enums"]["sentiment_type"] | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "query_results_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_results_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "visibility_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      visibility_reports: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          raw_data: Json | null
          schedule_id: string | null
          sentiment: Database["public"]["Enums"]["sentiment_type"] | null
          summary: string | null
          trigger: Database["public"]["Enums"]["trigger_type"]
          visibility_score: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          raw_data?: Json | null
          schedule_id?: string | null
          sentiment?: Database["public"]["Enums"]["sentiment_type"] | null
          summary?: string | null
          trigger?: Database["public"]["Enums"]["trigger_type"]
          visibility_score?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          raw_data?: Json | null
          schedule_id?: string | null
          sentiment?: Database["public"]["Enums"]["sentiment_type"] | null
          summary?: string | null
          trigger?: Database["public"]["Enums"]["trigger_type"]
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visibility_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_reports_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "monitoring_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_due_schedules: {
        Args: never
        Returns: {
          created_at: string
          frequency: Database["public"]["Enums"]["frequency_type"]
          id: string
          is_active: boolean
          language: Database["public"]["Enums"]["language_type"]
          last_run_at: string | null
          name: string
          next_run_at: string
          profile_id: string
          query: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "monitoring_schedules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      frequency_type: "daily" | "weekly" | "monthly"
      language_type: "de" | "en" | "fr" | "es" | "it" | "nl" | "pt"
      plan_type: "free" | "starter" | "pro" | "enterprise"
      sentiment_type: "positive" | "neutral" | "negative"
      trigger_type: "scheduled" | "manual" | "webhook"
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
  public: {
    Enums: {
      frequency_type: ["daily", "weekly", "monthly"],
      language_type: ["de", "en", "fr", "es", "it", "nl", "pt"],
      plan_type: ["free", "starter", "pro", "enterprise"],
      sentiment_type: ["positive", "neutral", "negative"],
      trigger_type: ["scheduled", "manual", "webhook"],
    },
  },
} as const
