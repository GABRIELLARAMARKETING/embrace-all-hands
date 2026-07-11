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
      admin_balance_adjustments: {
        Row: {
          action: string
          admin_user_id: string
          amount: number
          audit_event_id: string | null
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          idempotency_key: string | null
          ip: string | null
          note: string | null
          reason: string
          target_user_id: string
          user_agent: string | null
          wallet_tx_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          amount: number
          audit_event_id?: string | null
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          ip?: string | null
          note?: string | null
          reason: string
          target_user_id: string
          user_agent?: string | null
          wallet_tx_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          amount?: number
          audit_event_id?: string | null
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          ip?: string | null
          note?: string | null
          reason?: string
          target_user_id?: string
          user_agent?: string | null
          wallet_tx_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_balance_adjustments_wallet_tx_id_fkey"
            columns: ["wallet_tx_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          audit_event_id: string | null
          created_at: string
          id: string
          message: string | null
          payload: Json
          read_at: string | null
          severity: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          audit_event_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json
          read_at?: string | null
          severity?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          audit_event_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          payload?: Json
          read_at?: string | null
          severity?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_audit_event_id_fkey"
            columns: ["audit_event_id"]
            isOneToOne: false
            referencedRelation: "audit_events"
            referencedColumns: ["id"]
          },
        ]
      }
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
      audit_events: {
        Row: {
          admin_user_id: string | null
          affiliate_user_id: string | null
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          ip_hash: string | null
          manager_user_id: string | null
          message: string | null
          metadata: Json
          method: string | null
          module: string
          request_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by_admin_id: string | null
          route: string | null
          severity: string
          stack_trace: string | null
          status: string | null
          status_code: number | null
          technical_message: string | null
          title: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          admin_user_id?: string | null
          affiliate_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          ip_hash?: string | null
          manager_user_id?: string | null
          message?: string | null
          metadata?: Json
          method?: string | null
          module: string
          request_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_admin_id?: string | null
          route?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string | null
          status_code?: number | null
          technical_message?: string | null
          title: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          admin_user_id?: string | null
          affiliate_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          ip_hash?: string | null
          manager_user_id?: string | null
          message?: string | null
          metadata?: Json
          method?: string | null
          module?: string
          request_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_admin_id?: string | null
          route?: string | null
          severity?: string
          stack_trace?: string | null
          status?: string | null
          status_code?: number | null
          technical_message?: string | null
          title?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
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
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          percentage: number
          reversed_at: string | null
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
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          percentage: number
          reversed_at?: string | null
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
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          percentage?: number
          reversed_at?: string | null
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
          checkout_url: string | null
          confirmed_at: string | null
          copy_paste_code: string | null
          created_at: string
          credited_at: string | null
          currency: string
          expires_at: string | null
          external_id: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          paid_at: string | null
          payment_method: string | null
          provider: string
          qr_code: string | null
          qr_code_base64: string | null
          request_payload: Json | null
          response_payload: Json | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          webhook_payload: Json | null
        }
        Insert: {
          amount: number
          checkout_url?: string | null
          confirmed_at?: string | null
          copy_paste_code?: string | null
          created_at?: string
          credited_at?: string | null
          currency?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          paid_at?: string | null
          payment_method?: string | null
          provider?: string
          qr_code?: string | null
          qr_code_base64?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id: string
          webhook_payload?: Json | null
        }
        Update: {
          amount?: number
          checkout_url?: string | null
          confirmed_at?: string | null
          copy_paste_code?: string | null
          created_at?: string
          credited_at?: string | null
          currency?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          paid_at?: string | null
          payment_method?: string | null
          provider?: string
          qr_code?: string | null
          qr_code_base64?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id?: string
          webhook_payload?: Json | null
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          anti_fraud_score: number
          created_at: string
          credited_at: string | null
          demo_stake_cents: number | null
          deposit_id: string | null
          duration_seconds: number
          expires_at: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          last_platform_at: string | null
          level_reached: number
          payout_per_platform_cents: number
          platforms_passed: number
          reward_cents: number
          score: number
          status: string
          theme_id: string | null
          user_id: string | null
          validated_platforms_passed: number
        }
        Insert: {
          anti_fraud_score?: number
          created_at?: string
          credited_at?: string | null
          demo_stake_cents?: number | null
          deposit_id?: string | null
          duration_seconds?: number
          expires_at?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_platform_at?: string | null
          level_reached?: number
          payout_per_platform_cents?: number
          platforms_passed?: number
          reward_cents?: number
          score?: number
          status?: string
          theme_id?: string | null
          user_id?: string | null
          validated_platforms_passed?: number
        }
        Update: {
          anti_fraud_score?: number
          created_at?: string
          credited_at?: string | null
          demo_stake_cents?: number | null
          deposit_id?: string | null
          duration_seconds?: number
          expires_at?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_platform_at?: string | null
          level_reached?: number
          payout_per_platform_cents?: number
          platforms_passed?: number
          reward_cents?: number
          score?: number
          status?: string
          theme_id?: string | null
          user_id?: string | null
          validated_platforms_passed?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
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
      helix_platform_events: {
        Row: {
          client_timestamp: number | null
          created_at: string
          delta_time_ms: number | null
          event_hash: string | null
          id: string
          invalid_reason: string | null
          is_valid: boolean
          metadata: Json | null
          platform_index: number
          server_timestamp: string
          session_id: string
          user_id: string
        }
        Insert: {
          client_timestamp?: number | null
          created_at?: string
          delta_time_ms?: number | null
          event_hash?: string | null
          id?: string
          invalid_reason?: string | null
          is_valid?: boolean
          metadata?: Json | null
          platform_index: number
          server_timestamp?: string
          session_id: string
          user_id: string
        }
        Update: {
          client_timestamp?: number | null
          created_at?: string
          delta_time_ms?: number | null
          event_hash?: string | null
          id?: string
          invalid_reason?: string | null
          is_valid?: boolean
          metadata?: Json | null
          platform_index?: number
          server_timestamp?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helix_platform_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          block_reason: string | null
          blocked: boolean
          created_at: string
          id: string
          impersonation_session_id: string
          ip: string | null
          metadata: Json
          method: string | null
          route: string | null
          status_code: number | null
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          block_reason?: string | null
          blocked?: boolean
          created_at?: string
          id?: string
          impersonation_session_id: string
          ip?: string | null
          metadata?: Json
          method?: string | null
          route?: string | null
          status_code?: number | null
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          block_reason?: string | null
          blocked?: boolean
          created_at?: string
          id?: string
          impersonation_session_id?: string
          ip?: string | null
          metadata?: Json
          method?: string | null
          route?: string | null
          status_code?: number | null
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_audit_logs_impersonation_session_id_fkey"
            columns: ["impersonation_session_id"]
            isOneToOne: false
            referencedRelation: "impersonation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          ip: string | null
          metadata: Json
          mode: string
          reason: string
          request_id: string | null
          started_at: string
          status: string
          target_role: string | null
          target_user_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          mode?: string
          reason: string
          request_id?: string | null
          started_at?: string
          status?: string
          target_role?: string | null
          target_user_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          mode?: string
          reason?: string
          request_id?: string | null
          started_at?: string
          status?: string
          target_role?: string | null
          target_user_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      invite_code_audit: {
        Row: {
          action: string
          actor_id: string | null
          code: string
          code_id: string | null
          created_at: string
          detail: Json | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          code: string
          code_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          code?: string
          code_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_audit_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["invite_code_kind"]
          max_uses: number | null
          notes: string | null
          status: Database["public"]["Enums"]["invite_code_status"]
          updated_at: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["invite_code_kind"]
          max_uses?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["invite_code_status"]
          updated_at?: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["invite_code_kind"]
          max_uses?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["invite_code_status"]
          updated_at?: string
          uses?: number
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
      payment_webhook_logs: {
        Row: {
          created_at: string
          event_id: string | null
          headers: Json | null
          id: string
          payload: Json | null
          processed: boolean
          processing_error: string | null
          provider: string
          provider_transaction_id: string | null
          signature_valid: boolean | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          headers?: Json | null
          id?: string
          payload?: Json | null
          processed?: boolean
          processing_error?: string | null
          provider: string
          provider_transaction_id?: string | null
          signature_valid?: boolean | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          headers?: Json | null
          id?: string
          payload?: Json | null
          processed?: boolean
          processing_error?: string | null
          provider?: string
          provider_transaction_id?: string | null
          signature_valid?: boolean | null
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
          balance: number
          coins: number
          cpf: string | null
          created_at: string
          demo_balance: number
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          is_demo: boolean
          is_influencer: boolean
          level: number
          manager_id: string | null
          phone: string | null
          referred_by_id: string | null
          status: string
          total_received: number
          updated_at: string
        }
        Insert: {
          affiliate_balance?: number
          affiliate_code?: string | null
          avatar_url?: string | null
          balance?: number
          coins?: number
          cpf?: string | null
          created_at?: string
          demo_balance?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_demo?: boolean
          is_influencer?: boolean
          level?: number
          manager_id?: string | null
          phone?: string | null
          referred_by_id?: string | null
          status?: string
          total_received?: number
          updated_at?: string
        }
        Update: {
          affiliate_balance?: number
          affiliate_code?: string | null
          avatar_url?: string | null
          balance?: number
          coins?: number
          cpf?: string | null
          created_at?: string
          demo_balance?: number
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_demo?: boolean
          is_influencer?: boolean
          level?: number
          manager_id?: string | null
          phone?: string | null
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
      referral_clicks: {
        Row: {
          code: string
          converted_at: string | null
          converted_user_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          landing_page: string | null
          owner_type: string
          owner_user_id: string | null
          tracking_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          code: string
          converted_at?: string | null
          converted_user_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_page?: string | null
          owner_type?: string
          owner_user_id?: string | null
          tracking_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          code?: string
          converted_at?: string | null
          converted_user_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_page?: string | null
          owner_type?: string
          owner_user_id?: string | null
          tracking_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          deposit_id: string | null
          description: string | null
          id: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          deposit_id?: string | null
          description?: string | null
          id?: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          deposit_id?: string | null
          description?: string | null
          id?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
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
      _test_signup: {
        Args: { _display: string; _id: string; _ref?: string }
        Returns: undefined
      }
      admin_adjust_balance: {
        Args: {
          _action: string
          _amount?: number
          _confirmation?: string
          _idempotency_key?: string
          _ip?: string
          _note?: string
          _reason?: string
          _target_user_id: string
          _user_agent?: string
        }
        Returns: Json
      }
      admin_wallet_history: {
        Args: { _limit?: number; _target_user_id: string }
        Returns: Json
      }
      assert_reconciliation: { Args: never; Returns: string }
      credit_deposit_atomic: {
        Args: {
          _deposit_id: string
          _expected_amount: number
          _provider_tx_id: string
        }
        Returns: Json
      }
      expire_invite_codes: { Args: never; Returns: number }
      generate_affiliate_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      helix_abandon_active_sessions: {
        Args: { _grace_seconds?: number }
        Returns: Json
      }
      helix_create_demo_session: {
        Args: { _amount: number; _theme_id?: string }
        Returns: Json
      }
      helix_create_session: {
        Args: { _deposit_id: string; _theme_id?: string }
        Returns: Json
      }
      helix_finish_session: {
        Args: { _reason?: string; _session_id: string }
        Returns: Json
      }
      helix_minimum_withdraw_cents: {
        Args: { _deposit_amount_cents: number }
        Returns: number
      }
      helix_payout_cents: { Args: { _amount_cents: number }; Returns: number }
      helix_register_platform: {
        Args: {
          _client_ts?: number
          _event_hash?: string
          _platform_index: number
          _session_id: string
        }
        Returns: Json
      }
      helix_withdrawal_rules: { Args: never; Returns: Json }
      impersonation_start: {
        Args: {
          _confirmation: string
          _ip?: string
          _mode?: string
          _reason: string
          _target_user_id: string
          _ttl_minutes?: number
          _user_agent?: string
        }
        Returns: Json
      }
      impersonation_stop: {
        Args: { _reason?: string; _session_id: string }
        Returns: Json
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          _correlation_id?: string
          _entity_id?: string
          _entity_type?: string
          _event_type: string
          _message?: string
          _metadata?: Json
          _module: string
          _severity: string
          _status?: string
          _technical_message?: string
          _title: string
          _user_id?: string
        }
        Returns: string
      }
      manager_credit_demo_balance: {
        Args: { _amount: number; _reason?: string; _target_user_id: string }
        Returns: Json
      }
      process_deposit_commissions: {
        Args: { _deposit_id: string }
        Returns: undefined
      }
      reconcile_payments: {
        Args: never
        Returns: {
          actual: number
          deposit_id: string
          detail: string
          expected: number
          kind: string
          user_id: string
        }[]
      }
      test_demo_account_isolation: { Args: never; Returns: string }
      test_helix_flow: { Args: never; Returns: string }
      test_multilevel_flow: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "gerente" | "afiliado"
      commission_status:
        | "pending"
        | "approved"
        | "canceled"
        | "available"
        | "disputed"
        | "paid"
        | "reversed"
      deposit_status:
        | "pending"
        | "approved"
        | "paid"
        | "rejected"
        | "canceled"
        | "failed"
        | "waiting_payment"
        | "expired"
        | "spent"
      invite_code_kind: "referral" | "affiliate" | "manager" | "invite"
      invite_code_status: "active" | "inactive" | "expired"
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
        "paid",
        "reversed",
      ],
      deposit_status: [
        "pending",
        "approved",
        "paid",
        "rejected",
        "canceled",
        "failed",
        "waiting_payment",
        "expired",
        "spent",
      ],
      invite_code_kind: ["referral", "affiliate", "manager", "invite"],
      invite_code_status: ["active", "inactive", "expired"],
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
