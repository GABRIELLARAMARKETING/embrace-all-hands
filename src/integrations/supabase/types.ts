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
      profiles: {
        Row: {
          avatar_url: string | null
          coins: number
          created_at: string
          display_name: string | null
          id: string
          level: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          id: string
          level?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          id?: string
          level?: number
          updated_at?: string
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
