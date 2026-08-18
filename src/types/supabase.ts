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
    PostgrestVersion: "14.15"
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
      accounting_periods: {
        Row: {
          branch_id: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          period_end: string
          period_start: string
          reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_periods_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      ai_action_requests: {
        Row: {
          action_payload: Json
          action_type: string
          branch_id: string
          confirmation_text: string | null
          confirmed_at: string | null
          conversation_id: string | null
          created_at: string
          executed_at: string | null
          execution_result: Json | null
          id: string
          risk_level: string
          status: string
          user_id: string
        }
        Insert: {
          action_payload?: Json
          action_type: string
          branch_id: string
          confirmation_text?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          risk_level?: string
          status?: string
          user_id: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          branch_id?: string
          confirmation_text?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          risk_level?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_cfo_briefings: {
        Row: {
          branch_id: string
          briefing: Json
          generated_at: string
          id: string
          period_end: string | null
          period_start: string | null
          user_id: string | null
        }
        Insert: {
          branch_id: string
          briefing?: Json
          generated_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string
          briefing?: Json
          generated_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_cfo_briefings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_cfo_briefings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      ai_cfo_memory: {
        Row: {
          active: boolean
          branch_id: string
          content: string
          created_at: string
          id: string
          memory_type: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          branch_id: string
          content: string
          created_at?: string
          id?: string
          memory_type: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          branch_id?: string
          content?: string
          created_at?: string
          id?: string
          memory_type?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_cfo_memory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_cfo_memory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      ai_cfo_preferences: {
        Row: {
          branch_id: string
          briefing_frequency: string
          default_currency: string
          preferred_tone: string
          proactive_alerts: boolean
          show_forecasts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          briefing_frequency?: string
          default_currency?: string
          preferred_tone?: string
          proactive_alerts?: boolean
          show_forecasts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          briefing_frequency?: string
          default_currency?: string
          preferred_tone?: string
          proactive_alerts?: boolean
          show_forecasts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_cfo_preferences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_cfo_preferences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      ai_cfo_reports: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          period_end: string | null
          period_start: string | null
          report_data: Json
          report_type: string
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_data?: Json
          report_type: string
          status?: string
          title: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_data?: Json
          report_type?: string
          status?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_cfo_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_cfo_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_financial_insights: {
        Row: {
          branch_id: string
          classification: string
          created_at: string
          evidence: Json
          id: string
          insight_type: string
          message: string
          period_end: string | null
          period_start: string | null
          title: string
        }
        Insert: {
          branch_id: string
          classification: string
          created_at?: string
          evidence?: Json
          id?: string
          insight_type: string
          message: string
          period_end?: string | null
          period_start?: string | null
          title: string
        }
        Update: {
          branch_id?: string
          classification?: string
          created_at?: string
          evidence?: Json
          id?: string
          insight_type?: string
          message?: string
          period_end?: string | null
          period_start?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_financial_insights_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_financial_insights_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          citations: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string
          role: string
        }
        Insert: {
          citations?: Json
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string
          role: string
        }
        Update: {
          citations?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_scenarios: {
        Row: {
          assumptions: Json
          branch_id: string
          classification: string
          created_at: string
          id: string
          name: string
          result: Json
          user_id: string
        }
        Insert: {
          assumptions?: Json
          branch_id: string
          classification?: string
          created_at?: string
          id?: string
          name: string
          result?: Json
          user_id: string
        }
        Update: {
          assumptions?: Json
          branch_id?: string
          classification?: string
          created_at?: string
          id?: string
          name?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      allocation_approvals: {
        Row: {
          allocation_id: string
          branch_id: string
          id: string
          reason: string | null
          requested_at: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          allocation_id: string
          branch_id: string
          id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          allocation_id?: string
          branch_id?: string
          id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_approvals_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: true
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_approvals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_approvals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      allocation_proofs: {
        Row: {
          account_id: string | null
          actual_amount_kes: number
          allocation_id: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          expected_amount_kes: number
          id: string
          proof_date: string | null
          proof_reference: string | null
          proof_status: string
          reason: string | null
          verification_note: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_id?: string | null
          actual_amount_kes?: number
          allocation_id?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          expected_amount_kes?: number
          id?: string
          proof_date?: string | null
          proof_reference?: string | null
          proof_status?: string
          reason?: string | null
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_id?: string | null
          actual_amount_kes?: number
          allocation_id?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          expected_amount_kes?: number
          id?: string
          proof_date?: string | null
          proof_reference?: string | null
          proof_status?: string
          reason?: string | null
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_proofs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_proofs_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_proofs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_proofs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      allocations: {
        Row: {
          amount_kes: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          bucket: string
          computed_at: string
          id: string
          period: string
          proof_note: string | null
          transfer_reference: string | null
          transfer_status: string
          transferred_amount_kes: number
          transferred_at: string | null
          transferred_by: string | null
          variance_kes: number | null
        }
        Insert: {
          amount_kes: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          bucket: string
          computed_at?: string
          id?: string
          period: string
          proof_note?: string | null
          transfer_reference?: string | null
          transfer_status?: string
          transferred_amount_kes?: number
          transferred_at?: string | null
          transferred_by?: string | null
          variance_kes?: number | null
        }
        Update: {
          amount_kes?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          bucket?: string
          computed_at?: string
          id?: string
          period?: string
          proof_note?: string | null
          transfer_reference?: string | null
          transfer_status?: string
          transferred_amount_kes?: number
          transferred_at?: string | null
          transferred_by?: string | null
          variance_kes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      anomaly_events: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          branch_id: string
          created_at: string
          id: string
          message: string
          rule_type: string
          score: number | null
          severity: string
          status: string
          transaction_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          branch_id: string
          created_at?: string
          id?: string
          message: string
          rule_type: string
          score?: number | null
          severity?: string
          status?: string
          transaction_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          message?: string
          rule_type?: string
          score?: number | null
          severity?: string
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomaly_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "anomaly_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      anomaly_rules: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          rule_type: string
          threshold: number
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          rule_type: string
          threshold: number
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          rule_type?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomaly_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      app_state: {
        Row: {
          data: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data?: Json
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      attachments: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          executed_at: string | null
          execution_details: Json | null
          id: string
          rule_id: string | null
          status: string
        }
        Insert: {
          executed_at?: string | null
          execution_details?: Json | null
          id?: string
          rule_id?: string | null
          status: string
        }
        Update: {
          executed_at?: string | null
          execution_details?: Json | null
          id?: string
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          company_id: string
          conditions: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_event: string
        }
        Insert: {
          actions?: Json
          company_id: string
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_event: string
        }
        Update: {
          actions?: Json
          company_id?: string
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_misc_state: {
        Row: {
          branch_id: string
          data: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          data?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_misc_state_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_misc_state_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      branches: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_approvals: {
        Row: {
          branch_id: string
          budget_id: string
          id: string
          reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          branch_id: string
          budget_id: string
          id?: string
          reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          branch_id?: string
          budget_id?: string
          id?: string
          reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_approvals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_approvals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "budget_approvals_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: true
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          branch_id: string
          budget_kes: number
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          period: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          budget_kes: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          period: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          budget_kes?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount_kes: number
          branch_id: string | null
          created_at: string | null
          description: string | null
          direction: string
          financial_transaction_id: string | null
          from_account_id: string | null
          id: string
          is_deleted: boolean
          movement_date: string
          movement_type: string
          reason: string | null
          source_ref: string | null
          to_account_id: string | null
        }
        Insert: {
          amount_kes?: number
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          direction: string
          financial_transaction_id?: string | null
          from_account_id?: string | null
          id?: string
          is_deleted?: boolean
          movement_date?: string
          movement_type?: string
          reason?: string | null
          source_ref?: string | null
          to_account_id?: string | null
        }
        Update: {
          amount_kes?: number
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          direction?: string
          financial_transaction_id?: string | null
          from_account_id?: string | null
          id?: string
          is_deleted?: boolean
          movement_date?: string
          movement_type?: string
          reason?: string | null
          source_ref?: string | null
          to_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "cash_movements_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_reconciliations: {
        Row: {
          account_id: string
          account_name: string | null
          approved_by: string | null
          branch_id: string | null
          cleared_balance: number
          closing_statement_balance: number
          completed_at: string | null
          id: string
          ledger_balance: number | null
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          opening_statement_balance: number
          period_end: string | null
          period_start: string | null
          prepared_by: string | null
          reconciled_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          statement_balance: number | null
          statement_date: string
          statement_ending_balance: number
          statement_file_name: string | null
          statement_source: string
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          tolerance_kes: number
          updated_at: string | null
        }
        Insert: {
          account_id: string
          account_name?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cleared_balance: number
          closing_statement_balance?: number
          completed_at?: string | null
          id?: string
          ledger_balance?: number | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          opening_statement_balance?: number
          period_end?: string | null
          period_start?: string | null
          prepared_by?: string | null
          reconciled_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          statement_balance?: number | null
          statement_date: string
          statement_ending_balance: number
          statement_file_name?: string | null
          statement_source?: string
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          tolerance_kes?: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cleared_balance?: number
          closing_statement_balance?: number
          completed_at?: string | null
          id?: string
          ledger_balance?: number | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          opening_statement_balance?: number
          period_end?: string | null
          period_start?: string | null
          prepared_by?: string | null
          reconciled_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          statement_balance?: number | null
          statement_date?: string
          statement_ending_balance?: number
          statement_file_name?: string | null
          statement_source?: string
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          tolerance_kes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_reconciliations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_reconciliations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_reconciliations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      categories: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          branch_id: string
          cash_flow_category: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_control: boolean
          name: string
          parent_id: string | null
        }
        Insert: {
          account_type: string
          branch_id: string
          cash_flow_category?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_control?: boolean
          name: string
          parent_id?: string | null
        }
        Update: {
          account_type?: string
          branch_id?: string
          cash_flow_category?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_control?: boolean
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          exchange_rate_to_base: number | null
          is_active: boolean | null
          name: string
          symbol: string
          updated_at: string | null
        }
        Insert: {
          code: string
          exchange_rate_to_base?: number | null
          is_active?: boolean | null
          name: string
          symbol: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          exchange_rate_to_base?: number | null
          is_active?: boolean | null
          name?: string
          symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      document_intelligence_queue: {
        Row: {
          branch_id: string
          confidence: number | null
          created_at: string
          document_type: string
          extracted_data: Json | null
          id: string
          processed_at: string | null
          status: string
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          branch_id: string
          confidence?: number | null
          created_at?: string
          document_type: string
          extracted_data?: Json | null
          id?: string
          processed_at?: string | null
          status?: string
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          branch_id?: string
          confidence?: number | null
          created_at?: string
          document_type?: string
          extracted_data?: Json | null
          id?: string
          processed_at?: string | null
          status?: string
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount_kes: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          category_id: string | null
          charges_kes: number
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          is_deleted: boolean
          owner_funded: boolean
          paid_to: string | null
          source: string
          status: string
          supplier_id: string | null
          txn_ref: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_kes: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          category_id?: string | null
          charges_kes?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date: string
          id?: string
          is_deleted?: boolean
          owner_funded?: boolean
          paid_to?: string | null
          source?: string
          status?: string
          supplier_id?: string | null
          txn_ref?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_kes?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          category_id?: string | null
          charges_kes?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_deleted?: boolean
          owner_funded?: boolean
          paid_to?: string | null
          source?: string
          status?: string
          supplier_id?: string | null
          txn_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      financial_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          branch_id: string
          created_at: string
          id: string
          message: string
          metric_value: number | null
          severity: string
          status: string
          threshold_value: number | null
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          branch_id: string
          created_at?: string
          id?: string
          message: string
          metric_value?: number | null
          severity?: string
          status?: string
          threshold_value?: number | null
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          branch_id?: string
          created_at?: string
          id?: string
          message?: string
          metric_value?: number | null
          severity?: string
          status?: string
          threshold_value?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      financial_import_batches: {
        Row: {
          branch_id: string
          file_name: string | null
          id: string
          imported_at: string
          imported_by: string | null
          notes: string | null
          rows_created: number
          rows_received: number
          rows_review: number
          rows_skipped: number
          source_system: string
          status: string
        }
        Insert: {
          branch_id: string
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          rows_created?: number
          rows_received?: number
          rows_review?: number
          rows_skipped?: number
          source_system: string
          status?: string
        }
        Update: {
          branch_id?: string
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          rows_created?: number
          rows_received?: number
          rows_review?: number
          rows_skipped?: number
          source_system?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_import_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_import_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      financial_recommendations: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          evidence: Json
          expected_impact: Json
          id: string
          recommendation: string
          recommendation_type: string
          resolved_at: string | null
          status: string
          title: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          evidence?: Json
          expected_impact?: Json
          id?: string
          recommendation: string
          recommendation_type: string
          resolved_at?: string | null
          status?: string
          title: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          evidence?: Json
          expected_impact?: Json
          id?: string
          recommendation?: string
          recommendation_type?: string
          resolved_at?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      financial_report_runs: {
        Row: {
          branch_id: string
          comparative_end: string | null
          comparative_start: string | null
          generated_at: string
          generated_by: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          report_type: string
        }
        Insert: {
          branch_id: string
          comparative_end?: string | null
          comparative_start?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          report_type: string
        }
        Update: {
          branch_id?: string
          comparative_end?: string | null
          comparative_start?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_report_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_report_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      financial_statement_snapshots: {
        Row: {
          branch_id: string
          created_at: string
          generated_by: string | null
          id: string
          payload: Json
          period_end: string
          period_start: string
          statement_type: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          generated_by?: string | null
          id?: string
          payload?: Json
          period_end: string
          period_start: string
          statement_type: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          generated_by?: string | null
          id?: string
          payload?: Json
          period_end?: string
          period_start?: string
          statement_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_statement_snapshots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_statement_snapshots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          branch_id: string
          category_id: string | null
          change_reason: string | null
          charges_kes: number
          classification_status: string
          counterparty: string | null
          created_at: string
          created_by: string | null
          description: string | null
          direction: string
          expense_id: string | null
          external_ref: string | null
          gross_amount_kes: number
          id: string
          import_batch_id: string | null
          is_deleted: boolean
          loan_id: string | null
          net_amount_kes: number
          raw_data: Json | null
          reconciled: boolean
          report_group: string | null
          revenue_entry_id: string | null
          source_record_hash: string | null
          source_ref: string
          source_status: string | null
          source_system: string
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          branch_id: string
          category_id?: string | null
          change_reason?: string | null
          charges_kes?: number
          classification_status?: string
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction: string
          expense_id?: string | null
          external_ref?: string | null
          gross_amount_kes: number
          id?: string
          import_batch_id?: string | null
          is_deleted?: boolean
          loan_id?: string | null
          net_amount_kes: number
          raw_data?: Json | null
          reconciled?: boolean
          report_group?: string | null
          revenue_entry_id?: string | null
          source_record_hash?: string | null
          source_ref: string
          source_status?: string | null
          source_system: string
          transaction_date: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          branch_id?: string
          category_id?: string | null
          change_reason?: string | null
          charges_kes?: number
          classification_status?: string
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string
          expense_id?: string | null
          external_ref?: string | null
          gross_amount_kes?: number
          id?: string
          import_batch_id?: string | null
          is_deleted?: boolean
          loan_id?: string | null
          net_amount_kes?: number
          raw_data?: Json | null
          reconciled?: boolean
          report_group?: string | null
          revenue_entry_id?: string | null
          source_record_hash?: string | null
          source_ref?: string
          source_status?: string | null
          source_system?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "financial_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_revenue_entry_id_fkey"
            columns: ["revenue_entry_id"]
            isOneToOne: false
            referencedRelation: "revenue_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      hfms_automation_events: {
        Row: {
          action: string
          branch_id: string
          created_at: string
          event_key: string
          id: string
          message: string
          observed_value: number | null
          rule_key: string
          run_id: string | null
          severity: string
          threshold_value: number | null
        }
        Insert: {
          action?: string
          branch_id: string
          created_at?: string
          event_key: string
          id?: string
          message: string
          observed_value?: number | null
          rule_key: string
          run_id?: string | null
          severity: string
          threshold_value?: number | null
        }
        Update: {
          action?: string
          branch_id?: string
          created_at?: string
          event_key?: string
          id?: string
          message?: string
          observed_value?: number | null
          rule_key?: string
          run_id?: string | null
          severity?: string
          threshold_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hfms_automation_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_automation_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "hfms_automation_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "hfms_automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      hfms_automation_rules: {
        Row: {
          auto_execute: boolean
          branch_id: string
          channel: string
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          id: string
          lead_days: number
          name: string
          rule_key: string
          severity: string
          threshold_kes: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_execute?: boolean
          branch_id: string
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          lead_days?: number
          name: string
          rule_key: string
          severity?: string
          threshold_kes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_execute?: boolean
          branch_id?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          lead_days?: number
          name?: string
          rule_key?: string
          severity?: string
          threshold_kes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hfms_automation_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_automation_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      hfms_automation_runs: {
        Row: {
          actions_executed: number
          actions_prepared: number
          branches_scanned: number
          error_message: string | null
          finished_at: string | null
          id: string
          notifications_created: number
          notifications_sent: number
          rules_evaluated: number
          started_at: string
          status: string
          summary: Json
          trigger: string
        }
        Insert: {
          actions_executed?: number
          actions_prepared?: number
          branches_scanned?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          notifications_created?: number
          notifications_sent?: number
          rules_evaluated?: number
          started_at?: string
          status?: string
          summary?: Json
          trigger: string
        }
        Update: {
          actions_executed?: number
          actions_prepared?: number
          branches_scanned?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          notifications_created?: number
          notifications_sent?: number
          rules_evaluated?: number
          started_at?: string
          status?: string
          summary?: Json
          trigger?: string
        }
        Relationships: []
      }
      hfms_executive_briefings: {
        Row: {
          branch_id: string
          briefing_type: string
          created_at: string
          created_by: string | null
          facts: Json
          headline: string | null
          id: string
          period_end: string
          period_start: string
          priorities: Json
          recommendations: Json
          risks: Json
        }
        Insert: {
          branch_id: string
          briefing_type?: string
          created_at?: string
          created_by?: string | null
          facts?: Json
          headline?: string | null
          id?: string
          period_end: string
          period_start: string
          priorities?: Json
          recommendations?: Json
          risks?: Json
        }
        Update: {
          branch_id?: string
          briefing_type?: string
          created_at?: string
          created_by?: string | null
          facts?: Json
          headline?: string | null
          id?: string
          period_end?: string
          period_start?: string
          priorities?: Json
          recommendations?: Json
          risks?: Json
        }
        Relationships: []
      }
      hfms_executive_decisions: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          evidence: Json
          id: string
          owner_user_id: string | null
          priority: string
          recommended_action: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence?: Json
          id?: string
          owner_user_id?: string | null
          priority?: string
          recommended_action?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence?: Json
          id?: string
          owner_user_id?: string | null
          priority?: string
          recommended_action?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hfms_executive_kpi_targets: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          metric_key: string
          period_end: string
          period_start: string
          status: string
          target_value: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metric_key: string
          period_end: string
          period_start: string
          status?: string
          target_value: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metric_key?: string
          period_end?: string
          period_start?: string
          status?: string
          target_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      hfms_notification_deliveries: {
        Row: {
          alert_id: string | null
          branch_id: string
          channel: string
          error_message: string | null
          id: string
          provider: string | null
          provider_message_id: string | null
          queued_at: string
          recipient: string
          sent_at: string | null
          status: string
        }
        Insert: {
          alert_id?: string | null
          branch_id: string
          channel: string
          error_message?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string
          recipient: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          alert_id?: string | null
          branch_id?: string
          channel?: string
          error_message?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string
          recipient?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfms_notification_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "financial_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_notification_deliveries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_notification_deliveries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      hfms_notification_queue: {
        Row: {
          attempts: number
          body: string
          branch_id: string
          channel: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          recipient: string | null
          rule_key: string
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          body: string
          branch_id: string
          channel: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          recipient?: string | null
          rule_key: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          body?: string
          branch_id?: string
          channel?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          recipient?: string | null
          rule_key?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfms_notification_queue_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_notification_queue_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      hfms_opening_balances: {
        Row: {
          account_id: string
          amount_kes: number
          branch_id: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          reason: string
        }
        Insert: {
          account_id: string
          amount_kes: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          reason: string
        }
        Update: {
          account_id?: string
          amount_kes?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfms_opening_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_opening_balances_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_opening_balances_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      hfms_reconciliation_matches: {
        Row: {
          difference_kes: number
          external_row_id: string | null
          financial_transaction_id: string | null
          id: string
          match_type: string
          matched_amount_kes: number
          matched_at: string
          matched_by: string | null
          reason: string | null
          reconciliation_id: string
        }
        Insert: {
          difference_kes?: number
          external_row_id?: string | null
          financial_transaction_id?: string | null
          id?: string
          match_type?: string
          matched_amount_kes?: number
          matched_at?: string
          matched_by?: string | null
          reason?: string | null
          reconciliation_id: string
        }
        Update: {
          difference_kes?: number
          external_row_id?: string | null
          financial_transaction_id?: string | null
          id?: string
          match_type?: string
          matched_amount_kes?: number
          matched_at?: string
          matched_by?: string | null
          reason?: string | null
          reconciliation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hfms_reconciliation_matches_external_row_id_fkey"
            columns: ["external_row_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_reconciliation_matches_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_reconciliation_matches_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "cash_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      hfms_security_controls: {
        Row: {
          control_key: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          implementation: string | null
          name: string
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          control_key: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          implementation?: string | null
          name: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          control_key?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          implementation?: string | null
          name?: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hfms_security_events: {
        Row: {
          action: string
          actor_user_id: string | null
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          payload: Json | null
          resource: string | null
          result: string
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: string
          actor_user_id?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          payload?: Json | null
          resource?: string | null
          result?: string
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          payload?: Json | null
          resource?: string | null
          result?: string
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hfms_security_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_security_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "hfms_security_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          branch_id: string | null
          company_id: string
          created_by: string | null
          description: string | null
          entry_date: string
          entry_number: string
          id: string
          posted_at: string | null
          reversal_of: string | null
          reversal_reason: string | null
          source_id: string | null
          source_type: string
          status: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number: string
          id?: string
          posted_at?: string | null
          reversal_of?: string | null
          reversal_reason?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          posted_at?: string | null
          reversal_of?: string | null
          reversal_reason?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_line_items: {
        Row: {
          account_id: string
          credit: number | null
          debit: number | null
          id: string
          journal_entry_id: string
          memo: string | null
        }
        Insert: {
          account_id: string
          credit?: number | null
          debit?: number | null
          id?: string
          journal_entry_id: string
          memo?: string | null
        }
        Update: {
          account_id?: string
          credit?: number | null
          debit?: number | null
          id?: string
          journal_entry_id?: string
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_line_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_line_items_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          credit_kes: number
          debit_kes: number
          id: string
          journal_entry_id: string
          memo: string | null
        }
        Insert: {
          account_id: string
          credit_kes?: number
          debit_kes?: number
          id?: string
          journal_entry_id: string
          memo?: string | null
        }
        Update: {
          account_id?: string
          credit_kes?: number
          debit_kes?: number
          id?: string
          journal_entry_id?: string
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          amount_kes: number
          created_at: string
          created_by: string | null
          id: string
          is_deleted: boolean
          loan_id: string
          note: string | null
          payment_date: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_deleted?: boolean
          loan_id: string
          note?: string | null
          payment_date: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_deleted?: boolean
          loan_id?: string
          note?: string | null
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          annual_interest_rate_pct: number
          branch_id: string
          created_at: string
          current_balance_kes: number
          debt_name: string
          id: string
          is_deleted: boolean
          lender: string | null
          min_monthly_payment_kes: number
          original_principal_kes: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          annual_interest_rate_pct?: number
          branch_id: string
          created_at?: string
          current_balance_kes: number
          debt_name: string
          id?: string
          is_deleted?: boolean
          lender?: string | null
          min_monthly_payment_kes?: number
          original_principal_kes: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          annual_interest_rate_pct?: number
          branch_id?: string
          created_at?: string
          current_balance_kes?: number
          debt_name?: string
          id?: string
          is_deleted?: boolean
          lender?: string | null
          min_monthly_payment_kes?: number
          original_principal_kes?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          body: string
          branch_id: string
          channel: string
          created_at: string
          event_key: string
          id: string
          last_error: string | null
          recipient: string | null
          sent_at: string | null
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          attempts?: number
          body: string
          branch_id: string
          channel: string
          created_at?: string
          event_key: string
          id?: string
          last_error?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          attempts?: number
          body?: string
          branch_id?: string
          channel?: string
          created_at?: string
          event_key?: string
          id?: string
          last_error?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          branch_id: string
          created_at: string
          email: boolean
          enabled: boolean
          event_key: string
          id: string
          in_app: boolean
          sms: boolean
          threshold: number | null
          user_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          email?: boolean
          enabled?: boolean
          event_key: string
          id?: string
          in_app?: boolean
          sms?: boolean
          threshold?: number | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          email?: boolean
          enabled?: boolean
          event_key?: string
          id?: string
          in_app?: boolean
          sms?: boolean
          threshold?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          branch_id: string | null
          channel: string
          created_at: string
          error_message: string | null
          id: string
          message: string
          metadata: Json
          notification_type: string
          recipient_user_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          branch_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message: string
          metadata?: Json
          notification_type: string
          recipient_user_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          branch_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          metadata?: Json
          notification_type?: string
          recipient_user_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      profit_first_compliance: {
        Row: {
          allocation_count: number
          branch_id: string
          calculated_at: string
          coaching_message: string | null
          id: string
          period: string
          score: number
          status: string
          target_kes: number
          transferred_kes: number
          variance_kes: number
          verified_count: number
        }
        Insert: {
          allocation_count?: number
          branch_id: string
          calculated_at?: string
          coaching_message?: string | null
          id?: string
          period: string
          score?: number
          status?: string
          target_kes?: number
          transferred_kes?: number
          variance_kes?: number
          verified_count?: number
        }
        Update: {
          allocation_count?: number
          branch_id?: string
          calculated_at?: string
          coaching_message?: string | null
          id?: string
          period?: string
          score?: number
          status?: string
          target_kes?: number
          transferred_kes?: number
          variance_kes?: number
          verified_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profit_first_compliance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_first_compliance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      profit_first_cycles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          period: string
          prepared_at: string | null
          prepared_by: string | null
          requested_at: string | null
          requested_by: string | null
          revenue_kes: number
          status: string
          target_pct_total: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          period: string
          prepared_at?: string | null
          prepared_by?: string | null
          requested_at?: string | null
          requested_by?: string | null
          revenue_kes?: number
          status?: string
          target_pct_total?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          period?: string
          prepared_at?: string | null
          prepared_by?: string | null
          requested_at?: string | null
          requested_by?: string | null
          revenue_kes?: number
          status?: string
          target_pct_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profit_first_cycles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_first_cycles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      profit_first_settings: {
        Row: {
          branch_id: string
          debt_paydown_split_pct: number
          effective_from: string
          monthly_revenue_target_kes: number
          opening_opex_account_balance_kes: number
          pct_opex: number
          pct_owner_debt: number
          pct_profit: number
          pct_tax: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          debt_paydown_split_pct?: number
          effective_from?: string
          monthly_revenue_target_kes?: number
          opening_opex_account_balance_kes?: number
          pct_opex?: number
          pct_owner_debt?: number
          pct_profit?: number
          pct_tax?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          debt_paydown_split_pct?: number
          effective_from?: string
          monthly_revenue_target_kes?: number
          opening_opex_account_balance_kes?: number
          pct_opex?: number
          pct_owner_debt?: number
          pct_profit?: number
          pct_tax?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profit_first_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_first_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      profit_first_settings_history: {
        Row: {
          branch_id: string
          changed_at: string
          changed_by: string | null
          config: Json
          id: string
          reason: string | null
        }
        Insert: {
          branch_id: string
          changed_at?: string
          changed_by?: string | null
          config: Json
          id?: string
          reason?: string | null
        }
        Update: {
          branch_id?: string
          changed_at?: string
          changed_by?: string | null
          config?: Json
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profit_first_settings_history_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_first_settings_history_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      reconciliation_audit_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_data: Json
          event_type: string
          id: string
          reconciliation_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          reconciliation_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          reconciliation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_audit_events_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "cash_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_exceptions: {
        Row: {
          amount_kes: number
          created_at: string
          description: string
          exception_type: string
          id: string
          import_row_id: string | null
          reconciliation_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
        }
        Insert: {
          amount_kes?: number
          created_at?: string
          description: string
          exception_type: string
          id?: string
          import_row_id?: string | null
          reconciliation_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          description?: string
          exception_type?: string
          id?: string
          import_row_id?: string | null
          reconciliation_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_exceptions_import_row_id_fkey"
            columns: ["import_row_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_exceptions_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "cash_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_import_rows: {
        Row: {
          candidate_transaction_id: string | null
          created_at: string
          excluded_reason: string | null
          external_amount: number
          external_balance: number | null
          external_date: string | null
          external_description: string | null
          external_direction: string
          external_reference: string | null
          id: string
          match_score: number | null
          match_status: string
          matched_transaction_id: string | null
          reconciliation_id: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_hash: string | null
          source_row_number: number | null
        }
        Insert: {
          candidate_transaction_id?: string | null
          created_at?: string
          excluded_reason?: string | null
          external_amount?: number
          external_balance?: number | null
          external_date?: string | null
          external_description?: string | null
          external_direction: string
          external_reference?: string | null
          id?: string
          match_score?: number | null
          match_status?: string
          matched_transaction_id?: string | null
          reconciliation_id: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_hash?: string | null
          source_row_number?: number | null
        }
        Update: {
          candidate_transaction_id?: string | null
          created_at?: string
          excluded_reason?: string | null
          external_amount?: number
          external_balance?: number | null
          external_date?: string | null
          external_description?: string | null
          external_direction?: string
          external_reference?: string | null
          id?: string
          match_score?: number | null
          match_status?: string
          matched_transaction_id?: string | null
          reconciliation_id?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_hash?: string | null
          source_row_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_import_rows_candidate_transaction_id_fkey"
            columns: ["candidate_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_import_rows_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_import_rows_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "cash_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_lines: {
        Row: {
          actual_amount_kes: number
          branch_id: string
          created_at: string
          description: string | null
          expected_amount_kes: number
          id: string
          line_date: string | null
          reconciliation_id: string
          source_ref: string | null
          status: string
          variance_kes: number | null
        }
        Insert: {
          actual_amount_kes?: number
          branch_id: string
          created_at?: string
          description?: string | null
          expected_amount_kes?: number
          id?: string
          line_date?: string | null
          reconciliation_id: string
          source_ref?: string | null
          status?: string
          variance_kes?: number | null
        }
        Update: {
          actual_amount_kes?: number
          branch_id?: string
          created_at?: string
          description?: string | null
          expected_amount_kes?: number
          id?: string
          line_date?: string | null
          reconciliation_id?: string
          source_ref?: string | null
          status?: string
          variance_kes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "reconciliation_lines_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "cash_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_matches: {
        Row: {
          created_at: string
          external_amount: number | null
          external_date: string | null
          external_reference: string | null
          id: string
          ledger_transaction_id: string | null
          match_note: string | null
          match_status: string
          reconciliation_id: string
        }
        Insert: {
          created_at?: string
          external_amount?: number | null
          external_date?: string | null
          external_reference?: string | null
          id?: string
          ledger_transaction_id?: string | null
          match_note?: string | null
          match_status?: string
          reconciliation_id: string
        }
        Update: {
          created_at?: string
          external_amount?: number | null
          external_date?: string | null
          external_reference?: string | null
          id?: string
          ledger_transaction_id?: string | null
          match_note?: string | null
          match_status?: string
          reconciliation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_matches_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "cash_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expense_runs: {
        Row: {
          amount_kes: number
          branch_id: string
          created_at: string
          created_by: string | null
          error_message: string | null
          financial_transaction_id: string | null
          id: string
          recurring_expense_id: string
          run_period: string
          status: string
        }
        Insert: {
          amount_kes?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          financial_transaction_id?: string | null
          id?: string
          recurring_expense_id: string
          run_period: string
          status?: string
        }
        Update: {
          amount_kes?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          financial_transaction_id?: string | null
          id?: string
          recurring_expense_id?: string
          run_period?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expense_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expense_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "recurring_expense_runs_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expense_runs_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          amount_kes: number
          branch_id: string | null
          created_at: string | null
          frequency: string
          id: string
          is_active: boolean | null
          next_run_date: string
          title: string
        }
        Insert: {
          amount_kes?: number
          branch_id?: string | null
          created_at?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          next_run_date: string
          title: string
        }
        Update: {
          amount_kes?: number
          branch_id?: string | null
          created_at?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          next_run_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      revenue_entries: {
        Row: {
          account_id: string | null
          amount_kes: number
          branch_id: string
          category_id: string | null
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          is_deleted: boolean
          notes: string | null
          source: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_kes: number
          branch_id: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date: string
          id?: string
          is_deleted?: boolean
          notes?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_kes?: number
          branch_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          is_deleted?: boolean
          notes?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "revenue_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_aliases: {
        Row: {
          alias: string
          branch_id: string | null
          created_at: string
          id: string
          supplier_id: string
        }
        Insert: {
          alias: string
          branch_id?: string | null
          created_at?: string
          id?: string
          supplier_id: string
        }
        Update: {
          alias?: string
          branch_id?: string | null
          created_at?: string
          id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_aliases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_aliases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "supplier_aliases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_statements: {
        Row: {
          branch_id: string
          generated_at: string
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          supplier_id: string
          total_expenses_kes: number
          transaction_count: number
        }
        Insert: {
          branch_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          supplier_id: string
          total_expenses_kes?: number
          transaction_count?: number
        }
        Update: {
          branch_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          supplier_id?: string
          total_expenses_kes?: number
          transaction_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_statements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_statements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "supplier_statements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          branch_id: string
          canonical_name: string | null
          contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          branch_id: string
          canonical_name?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          branch_id?: string
          canonical_name?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      tax_compliance_events: {
        Row: {
          actor_id: string | null
          branch_id: string
          created_at: string
          event_type: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          reason: string | null
          tax_period_id: string | null
        }
        Insert: {
          actor_id?: string | null
          branch_id: string
          created_at?: string
          event_type: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
          tax_period_id?: string | null
        }
        Update: {
          actor_id?: string | null
          branch_id?: string
          created_at?: string
          event_type?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
          tax_period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_compliance_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_compliance_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "tax_compliance_events_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_deadline_rules: {
        Row: {
          active: boolean
          authority: string
          created_at: string
          due_rule: string
          effective_from: string | null
          effective_to: string | null
          filing_due_rule: string | null
          frequency: string
          id: string
          jurisdiction: string
          source_note: string | null
          source_url: string | null
          tax_type: string
          verified_at: string | null
        }
        Insert: {
          active?: boolean
          authority?: string
          created_at?: string
          due_rule: string
          effective_from?: string | null
          effective_to?: string | null
          filing_due_rule?: string | null
          frequency: string
          id?: string
          jurisdiction?: string
          source_note?: string | null
          source_url?: string | null
          tax_type: string
          verified_at?: string | null
        }
        Update: {
          active?: boolean
          authority?: string
          created_at?: string
          due_rule?: string
          effective_from?: string | null
          effective_to?: string | null
          filing_due_rule?: string | null
          frequency?: string
          id?: string
          jurisdiction?: string
          source_note?: string | null
          source_url?: string | null
          tax_type?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      tax_evidence: {
        Row: {
          created_at: string
          evidence_type: string
          id: string
          notes: string | null
          reference: string | null
          storage_path: string | null
          tax_period_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          evidence_type: string
          id?: string
          notes?: string | null
          reference?: string | null
          storage_path?: string | null
          tax_period_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          evidence_type?: string
          id?: string
          notes?: string | null
          reference?: string | null
          storage_path?: string | null
          tax_period_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_evidence_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_obligations: {
        Row: {
          applicable: boolean
          branch_id: string
          due_day_of_month: number | null
          estimated_amount_kes: number
          filing_authority: string | null
          frequency: string
          id: string
          manual_next_due_date: string | null
          notes: string | null
          tax_type: string
        }
        Insert: {
          applicable?: boolean
          branch_id: string
          due_day_of_month?: number | null
          estimated_amount_kes?: number
          filing_authority?: string | null
          frequency?: string
          id?: string
          manual_next_due_date?: string | null
          notes?: string | null
          tax_type: string
        }
        Update: {
          applicable?: boolean
          branch_id?: string
          due_day_of_month?: number | null
          estimated_amount_kes?: number
          filing_authority?: string | null
          frequency?: string
          id?: string
          manual_next_due_date?: string | null
          notes?: string | null
          tax_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_obligations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_obligations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      tax_payments: {
        Row: {
          amount_kes: number
          created_at: string
          created_by: string | null
          id: string
          payment_date: string
          reference: string | null
          tax_obligation_id: string
        }
        Insert: {
          amount_kes: number
          created_at?: string
          created_by?: string | null
          id?: string
          payment_date: string
          reference?: string | null
          tax_obligation_id: string
        }
        Update: {
          amount_kes?: number
          created_at?: string
          created_by?: string | null
          id?: string
          payment_date?: string
          reference?: string | null
          tax_obligation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_payments_tax_obligation_id_fkey"
            columns: ["tax_obligation_id"]
            isOneToOne: false
            referencedRelation: "tax_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_periods: {
        Row: {
          amount_due_kes: number
          amount_paid_kes: number
          branch_id: string
          created_at: string
          created_by: string | null
          filed_at: string | null
          filing_due_date: string | null
          filing_reference: string | null
          filing_status: string
          id: string
          notes: string | null
          payment_due_date: string | null
          payment_reference: string | null
          payment_status: string
          period_end: string
          period_start: string
          tax_obligation_id: string | null
          updated_at: string
        }
        Insert: {
          amount_due_kes?: number
          amount_paid_kes?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          filed_at?: string | null
          filing_due_date?: string | null
          filing_reference?: string | null
          filing_status?: string
          id?: string
          notes?: string | null
          payment_due_date?: string | null
          payment_reference?: string | null
          payment_status?: string
          period_end: string
          period_start: string
          tax_obligation_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_due_kes?: number
          amount_paid_kes?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          filed_at?: string | null
          filing_due_date?: string | null
          filing_reference?: string | null
          filing_status?: string
          id?: string
          notes?: string | null
          payment_due_date?: string | null
          payment_reference?: string | null
          payment_status?: string
          period_end?: string
          period_start?: string
          tax_obligation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_periods_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_periods_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "tax_periods_tax_obligation_id_fkey"
            columns: ["tax_obligation_id"]
            isOneToOne: false
            referencedRelation: "tax_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_profile: {
        Row: {
          accounting_year_end_month: number
          branch_id: string
          etims_compliant: boolean | null
          kra_pin: string | null
          last_tcc_check_date: string | null
          notes: string | null
          tax_agent_contact: string | null
          tax_agent_name: string | null
          taxpayer_name: string | null
          tcc_expiry_date: string | null
          tcc_status: string
          updated_at: string
          updated_by: string | null
          vat_registered: boolean | null
        }
        Insert: {
          accounting_year_end_month?: number
          branch_id: string
          etims_compliant?: boolean | null
          kra_pin?: string | null
          last_tcc_check_date?: string | null
          notes?: string | null
          tax_agent_contact?: string | null
          tax_agent_name?: string | null
          taxpayer_name?: string | null
          tcc_expiry_date?: string | null
          tcc_status?: string
          updated_at?: string
          updated_by?: string | null
          vat_registered?: boolean | null
        }
        Update: {
          accounting_year_end_month?: number
          branch_id?: string
          etims_compliant?: boolean | null
          kra_pin?: string | null
          last_tcc_check_date?: string | null
          notes?: string | null
          tax_agent_contact?: string | null
          tax_agent_name?: string | null
          taxpayer_name?: string | null
          tcc_expiry_date?: string | null
          tcc_status?: string
          updated_at?: string
          updated_by?: string | null
          vat_registered?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_profile_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_profile_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      user_branch_access: {
        Row: {
          branch_id: string
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          branch_id: string
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          branch_id?: string
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          full_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ai_financial_health: {
        Row: {
          branch_id: string | null
          expenses: number | null
          owner_loan_funding: number | null
          owner_loan_repayment: number | null
          revenue: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      hfms_branch_executive_position: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          expenses_kes: number | null
          owner_funding_kes: number | null
          owner_repayment_kes: number | null
          revenue_kes: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
      hfms_daily_financial_position: {
        Row: {
          branch_id: string | null
          expenses_kes: number | null
          net_cash_movement_kes: number | null
          owner_funding_kes: number | null
          owner_repayment_kes: number | null
          revenue_kes: number | null
          transaction_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_financial_daily_summary: {
        Row: {
          branch_id: string | null
          expense_kes: number | null
          owner_loan_funding_kes: number | null
          revenue_kes: number | null
          total_inflows_kes: number | null
          total_outflows_kes: number | null
          transaction_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_hfms_budget_vs_actual: {
        Row: {
          actual_kes: number | null
          branch_id: string | null
          budget_kes: number | null
          category_id: string | null
          period: string | null
          variance_kes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      v_hfms_financial_position: {
        Row: {
          branch_id: string | null
          expenses_kes: number | null
          net_ledger_movement_kes: number | null
          owner_loan_funding_kes: number | null
          owner_loan_repayment_kes: number | null
          revenue_kes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_hfms_management_kpis: {
        Row: {
          branch_id: string | null
          cash_in_kes: number | null
          cash_out_kes: number | null
          expenses_kes: number | null
          owner_funding_kes: number | null
          owner_repayment_kes: number | null
          revenue_kes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_hfms_monthly_summary: {
        Row: {
          branch_id: string | null
          expense_kes: number | null
          owner_loan_funding_kes: number | null
          owner_loan_repayment_kes: number | null
          period: string | null
          revenue_kes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_hfms_opening_balance_summary: {
        Row: {
          branch_id: string | null
          entries: number | null
          total_opening_balance_kes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hfms_opening_balances_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hfms_opening_balances_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_hfms_supplier_monthly: {
        Row: {
          branch_id: string | null
          counterparty: string | null
          period: string | null
          total_expenses_kes: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_hfms_trial_balance: {
        Row: {
          account_id: string | null
          account_type: string | null
          branch_id: string | null
          code: string | null
          name: string | null
          net_balance_kes: number | null
          total_credit_kes: number | null
          total_debit_kes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "hfms_branch_executive_position"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_branch_role: {
        Args: {
          b_id: string
          roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: boolean
      }
      hfms_check_journal_balance: {
        Args: { p_entry: string }
        Returns: boolean
      }
      hfms_period_is_closed: {
        Args: { p_branch: string; p_date: string }
        Returns: boolean
      }
      is_head_office: { Args: never; Returns: boolean }
    }
    Enums: {
      user_role:
        | "owner"
        | "finance_manager"
        | "accountant"
        | "branch_manager"
        | "auditor"
        | "viewer"
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
    Enums: {
      user_role: [
        "owner",
        "finance_manager",
        "accountant",
        "branch_manager",
        "auditor",
        "viewer",
      ],
    },
  },
} as const
