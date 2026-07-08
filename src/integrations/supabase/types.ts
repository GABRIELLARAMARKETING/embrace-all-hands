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
      affiliate_withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          note: string | null
          paid_at: string | null
          pix_key: string | null
          rejection_reason: string | null
          request_ip: string | null
          request_user_agent: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          pix_key?: string | null
          rejection_reason?: string | null
          request_ip?: string | null
          request_user_agent?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          pix_key?: string | null
          rejection_reason?: string | null
          request_ip?: string | null
          request_user_agent?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          affiliate_id: string
          amount: number
          available_at: string | null
          base_amount: number
          created_at: string
          deposit_id: string | null
          id: string
          level: number | null
          manager_id: string | null
          percentage: number
          source_user_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          available_at?: string | null
          base_amount: number
          created_at?: string
          deposit_id?: string | null
          id?: string
          level?: number | null
          manager_id?: string | null
          percentage: number
          source_user_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          available_at?: string | null
          base_amount?: number
          created_at?: string
          deposit_id?: string | null
          id?: string
          level?: number | null
          manager_id?: string | null
          percentage?: number
          source_user_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_account_batches: {
        Row: {
          created_at: string
          id: string
          initial_balance: number
          manager_id: string
          name_pattern: string
          password_pattern: string | null
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          initial_balance?: number
          manager_id: string
          name_pattern: string
          password_pattern?: string | null
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          initial_balance?: number
          manager_id?: string
          name_pattern?: string
          password_pattern?: string | null
          quantity?: number
        }
        Relationships: []
      }
      demo_accounts: {
        Row: {
          affiliate_code: string
          balance: number
          batch_id: string | null
          created_at: string
          display_name: string
          id: string
          manager_id: string
          phone: string
        }
        Insert: {
          affiliate_code: string
          balance?: number
          batch_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          manager_id: string
          phone: string
        }
        Update: {
          affiliate_code?: string
          balance?: number
          batch_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          manager_id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_accounts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "demo_account_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          external_id: string | null
          id: string
          payment_method: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          payment_method?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          payment_method?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          finished_at: string | null
          id: string
          level_reached: number
          score: number
          status: string
          theme_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          finished_at?: string | null
          id?: string
          level_reached?: number
          score?: number
          status?: string
          theme_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          finished_at?: string | null
          id?: string
          level_reached?: number
          score?: number
          status?: string
          theme_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "game_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      game_themes: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          gameplay_config: Json
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          min_level: number
          name: string
          preview_config: Json
          rarity: string
          slug: string
          sort_order: number
          ui_config: Json
          unlock_price: number
          unlock_type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          gameplay_config: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          label: string
          min_level?: number
          name: string
          preview_config: Json
          rarity?: string
          slug: string
          sort_order?: number
          ui_config: Json
          unlock_price?: number
          unlock_type?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          gameplay_config?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          min_level?: number
          name?: string
          preview_config?: Json
          rarity?: string
          slug?: string
          sort_order?: number
          ui_config?: Json
          unlock_price?: number
          unlock_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_matches: {
        Row: {
          created_at: string
          expires_at: string | null
          fake_or_real: string
          id: string
          status: string
          theme_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          fake_or_real?: string
          id?: string
          status?: string
          theme_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          fake_or_real?: string
          id?: string
          status?: string
          theme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_matches_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "game_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          reason: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      manager_profiles: {
        Row: {
          created_at: string
          id: string
          level1_percent: number
          level2_percent: number
          level3_percent: number
          total_budget_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level1_percent?: number
          level2_percent?: number
          level3_percent?: number
          total_budget_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level1_percent?: number
          level2_percent?: number
          level3_percent?: number
          total_budget_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_critical: boolean
          key: string
          type: string
          updated_at: string
          updated_by_id: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_critical?: boolean
          key: string
          type?: string
          updated_at?: string
          updated_by_id?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_critical?: boolean
          key?: string
          type?: string
          updated_at?: string
          updated_by_id?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          affiliate_balance: number
          affiliate_code: string | null
          avatar_url: string | null
          coins: number
          created_at: string
          display_name: string | null
          id: string
          is_demo: boolean
          is_influencer: boolean
          level: number
          manager_id: string | null
          referred_by_id: string | null
          status: string
          total_received: number
          updated_at: string
        }
        Insert: {
          affiliate_balance?: number
          affiliate_code?: string | null
          avatar_url?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          id: string
          is_demo?: boolean
          is_influencer?: boolean
          level?: number
          manager_id?: string | null
          referred_by_id?: string | null
          status?: string
          total_received?: number
          updated_at?: string
        }
        Update: {
          affiliate_balance?: number
          affiliate_code?: string | null
          avatar_url?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          id?: string
          is_demo?: boolean
          is_influencer?: boolean
          level?: number
          manager_id?: string | null
          referred_by_id?: string | null
          status?: string
          total_received?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_logs: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          referred_id: string | null
          referrer_id: string | null
          source_code: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          referred_id?: string | null
          referrer_id?: string | null
          source_code?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          referred_id?: string | null
          referrer_id?: string | null
          source_code?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          level: number
          manager_id: string | null
          referred_id: string
          referrer_id: string
          source_code: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level: number
          manager_id?: string | null
          referred_id: string
          referrer_id: string
          source_code?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          manager_id?: string | null
          referred_id?: string
          referrer_id?: string
          source_code?: string | null
        }
        Relationships: []
      }
      report_exports: {
        Row: {
          created_at: string
          file_url: string | null
          filters: Json | null
          id: string
          requested_by_id: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          requested_by_id?: string | null
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          requested_by_id?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      risk_alerts: {
        Row: {
          assigned_to_id: string | null
          created_at: string
          description: string | null
          id: string
          severity: Database["public"]["Enums"]["risk_severity"]
          status: Database["public"]["Enums"]["risk_alert_status"]
          title: string
          type: string
          updated_at: string
          user_id: string | null
          withdrawal_id: string | null
        }
        Insert: {
          assigned_to_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["risk_severity"]
          status?: Database["public"]["Enums"]["risk_alert_status"]
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
          withdrawal_id?: string | null
        }
        Update: {
          assigned_to_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          severity?: Database["public"]["Enums"]["risk_severity"]
          status?: Database["public"]["Enums"]["risk_alert_status"]
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_alerts_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "affiliate_withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_theme_inventory: {
        Row: {
          id: string
          source: string
          theme_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          source?: string
          theme_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          source?: string
          theme_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_theme_inventory_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "game_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_theme_preferences: {
        Row: {
          id: string
          selected_theme_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          selected_theme_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          selected_theme_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_theme_preferences_selected_theme_id_fkey"
            columns: ["selected_theme_id"]
            isOneToOne: false
            referencedRelation: "game_themes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      live_matches_public: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string | null
          status: string | null
          theme_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          status?: string | null
          theme_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          status?: string | null
          theme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_matches_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "game_themes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_affiliate_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      process_deposit_commissions: {
        Args: { _deposit_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "gerente" | "afiliado"
      commission_status:
        | "pending"
        | "approved"
        | "canceled"
        | "available"
        | "disputed"
      deposit_status:
        | "pending"
        | "approved"
        | "paid"
        | "rejected"
        | "canceled"
        | "failed"
      risk_alert_status: "open" | "reviewing" | "resolved" | "ignored"
      risk_severity: "low" | "medium" | "high" | "critical"
      transaction_type:
        | "commission_created"
        | "commission_approved"
        | "commission_canceled"
        | "withdrawal_requested"
        | "withdrawal_approved"
        | "withdrawal_paid"
        | "withdrawal_rejected"
        | "manual_adjustment_positive"
        | "manual_adjustment_negative"
      withdrawal_status:
        | "pending"
        | "in_review"
        | "approved"
        | "paid"
        | "rejected"
        | "cancelled"
        | "failed"
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
      app_role: ["super_admin", "admin", "gerente", "afiliado"],
      commission_status: [
        "pending",
        "approved",
        "canceled",
        "available",
        "disputed",
      ],
      deposit_status: [
        "pending",
        "approved",
        "paid",
        "rejected",
        "canceled",
        "failed",
      ],
      risk_alert_status: ["open", "reviewing", "resolved", "ignored"],
      risk_severity: ["low", "medium", "high", "critical"],
      transaction_type: [
        "commission_created",
        "commission_approved",
        "commission_canceled",
        "withdrawal_requested",
        "withdrawal_approved",
        "withdrawal_paid",
        "withdrawal_rejected",
        "manual_adjustment_positive",
        "manual_adjustment_negative",
      ],
      withdrawal_status: [
        "pending",
        "in_review",
        "approved",
        "paid",
        "rejected",
        "cancelled",
        "failed",
      ],
    },
  },
} as const
