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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_department_assignment_events: {
        Row: {
          actor_id: string | null
          created_at: string
          department: string
          id: string
          new_can_write: boolean | null
          operation: string
          previous_can_write: boolean | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          department: string
          id?: string
          new_can_write?: boolean | null
          operation: string
          previous_can_write?: boolean | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          department?: string
          id?: string
          new_can_write?: boolean | null
          operation?: string
          previous_can_write?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      admin_department_assignments: {
        Row: {
          assigned_by: string | null
          can_write: boolean
          created_at: string
          department: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          can_write?: boolean
          created_at?: string
          department: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          can_write?: boolean
          created_at?: string
          department?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_driver_reviews: {
        Row: {
          document_verified: boolean
          evidence_note: string
          reviewed_at: string
          reviewed_by: string
          user_id: string
          vehicle_verified: boolean
        }
        Insert: {
          document_verified?: boolean
          evidence_note: string
          reviewed_at?: string
          reviewed_by: string
          user_id: string
          vehicle_verified?: boolean
        }
        Update: {
          document_verified?: boolean
          evidence_note?: string
          reviewed_at?: string
          reviewed_by?: string
          user_id?: string
          vehicle_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "admin_driver_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_checkout_intents: {
        Row: {
          accepted_at: string
          actual_fee_cents: number | null
          asaas_customer_id: string | null
          asaas_net_cents: number | null
          asaas_payment_id: string | null
          created_at: string
          driver_fixed_cents: number
          driver_user_id: string
          driver_wallet_id: string
          fare_cents: number
          fee_source: string
          id: string
          passenger_total_cents: number
          payer_user_id: string
          platform_target_cents: number
          processing_fee_cents: number
          quote_expires_at: string
          ride_id: string
          split_settled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at: string
          actual_fee_cents?: number | null
          asaas_customer_id?: string | null
          asaas_net_cents?: number | null
          asaas_payment_id?: string | null
          created_at?: string
          driver_fixed_cents: number
          driver_user_id: string
          driver_wallet_id: string
          fare_cents: number
          fee_source: string
          id?: string
          passenger_total_cents: number
          payer_user_id: string
          platform_target_cents: number
          processing_fee_cents: number
          quote_expires_at: string
          ride_id: string
          split_settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string
          actual_fee_cents?: number | null
          asaas_customer_id?: string | null
          asaas_net_cents?: number | null
          asaas_payment_id?: string | null
          created_at?: string
          driver_fixed_cents?: number
          driver_user_id?: string
          driver_wallet_id?: string
          fare_cents?: number
          fee_source?: string
          id?: string
          passenger_total_cents?: number
          payer_user_id?: string
          platform_target_cents?: number
          processing_fee_cents?: number
          quote_expires_at?: string
          ride_id?: string
          split_settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_checkout_intents_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["ride_id"]
          },
        ]
      }
      asaas_webhook_inbox: {
        Row: {
          event_id: string
          event_type: string
          payload: Json
          payment_id: string
          process_error: string | null
          processed_at: string | null
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          payload: Json
          payment_id: string
          process_error?: string | null
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          payload?: Json
          payment_id?: string
          process_error?: string | null
          processed_at?: string | null
          received_at?: string
        }
        Relationships: []
      }
      compliance_record_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          new_status: string
          previous_status: string | null
          record_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          previous_status?: string | null
          record_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          previous_status?: string | null
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_record_events_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "compliance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_records: {
        Row: {
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          id: string
          kind: string
          municipality: string | null
          reference_url: string | null
          status: string
          title: string
          updated_at: string
          version_label: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          kind: string
          municipality?: string | null
          reference_url?: string | null
          status?: string
          title: string
          updated_at?: string
          version_label?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          kind?: string
          municipality?: string | null
          reference_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          version_label?: string | null
        }
        Relationships: []
      }
      corporate_research_access_audit: {
        Row: {
          action: string
          created_at: string
          form_id: string
          id: number
          operator_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          form_id: string
          id?: number
          operator_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          form_id?: string
          id?: number
          operator_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_research_access_audit_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_research_answer_owners: {
        Row: {
          answer_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_research_answer_owners_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "research_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_research_memberships: {
        Row: {
          form_id: string
          revoked_at: string | null
          user_id: string
          verification_reference: string
          verified_at: string
          verified_by: string
        }
        Insert: {
          form_id: string
          revoked_at?: string | null
          user_id: string
          verification_reference: string
          verified_at?: string
          verified_by: string
        }
        Update: {
          form_id?: string
          revoked_at?: string | null
          user_id?: string
          verification_reference?: string
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "corporate_research_memberships_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          channel: string
          code: string
          created_at: string
          created_by: string
          id: string
          institution: string | null
          name: string
          status: string
        }
        Insert: {
          channel?: string
          code: string
          created_at?: string
          created_by?: string
          id?: string
          institution?: string | null
          name: string
          status?: string
        }
        Update: {
          channel?: string
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          institution?: string | null
          name?: string
          status?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          account_id: string | null
          campaign_id: string | null
          contact_consent: boolean
          created_at: string
          created_by: string
          display_name: string
          email: string | null
          id: string
          notes: string
          source_form_id: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          account_id?: string | null
          campaign_id?: string | null
          contact_consent?: boolean
          created_at?: string
          created_by?: string
          display_name: string
          email?: string | null
          id?: string
          notes?: string
          source_form_id?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          account_id?: string | null
          campaign_id?: string | null
          contact_consent?: boolean
          created_at?: string
          created_by?: string
          display_name?: string
          email?: string | null
          id?: string
          notes?: string
          source_form_id?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_source_form_id_fkey"
            columns: ["source_form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_pix_settings: {
        Row: {
          pix_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          pix_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          pix_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_pix_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_record_history: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          record_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          record_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_record_history_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "executive_records"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_records: {
        Row: {
          actual_value: number | null
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          id: string
          kind: string
          owner_id: string | null
          priority: string
          status: string
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          kind: string
          owner_id?: string | null
          priority?: string
          status?: string
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          kind?: string
          owner_id?: string | null
          priority?: string
          status?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      form_funnel_events: {
        Row: {
          anonymous_session_id: string
          campaign: string | null
          campaign_event: string
          created_at: string
          event_id: string
          event_name: string
          event_step: string | null
          idempotency_key: string
          source: string
          user_id: string | null
        }
        Insert: {
          anonymous_session_id: string
          campaign?: string | null
          campaign_event: string
          created_at?: string
          event_id?: string
          event_name: string
          event_step?: string | null
          idempotency_key: string
          source: string
          user_id?: string | null
        }
        Update: {
          anonymous_session_id?: string
          campaign?: string | null
          campaign_event?: string
          created_at?: string
          event_id?: string
          event_name?: string
          event_step?: string | null
          idempotency_key?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      form_ride_publications: {
        Row: {
          created_at: string
          kind: string
          offer_id: string | null
          request_id: string | null
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kind: string
          offer_id?: string | null
          request_id?: string | null
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          offer_id?: string | null
          request_id?: string | null
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_ride_publications_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "form_ride_publications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "form_ride_publications_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "form_ride_publications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_starts: {
        Row: {
          anonymous_session_id: string | null
          campaign: string | null
          campaign_event: string
          created_at: string
          ocupacao: string | null
          raw_payload: Json
          source: string
          start_id: string
          tipo_usuario: Database["public"]["Enums"]["form_tipo_usuario"] | null
          user_id: string | null
        }
        Insert: {
          anonymous_session_id?: string | null
          campaign?: string | null
          campaign_event: string
          created_at?: string
          ocupacao?: string | null
          raw_payload?: Json
          source: string
          start_id?: string
          tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"] | null
          user_id?: string | null
        }
        Update: {
          anonymous_session_id?: string | null
          campaign?: string | null
          campaign_event?: string
          created_at?: string
          ocupacao?: string | null
          raw_payload?: Json
          source?: string
          start_id?: string
          tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      form_submission_account_links: {
        Row: {
          confirmed_at: string | null
          linked_at: string
          onboarding_completed_at: string | null
          submission_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          linked_at?: string
          onboarding_completed_at?: string | null
          submission_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          linked_at?: string
          onboarding_completed_at?: string | null
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submission_account_links_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "form_submissions"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "form_submission_account_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submission_pain_points: {
        Row: {
          codigo_dor: Database["public"]["Enums"]["form_dor_codigo"]
          created_at: string
          intensidade: number | null
          principal: boolean
          selecionada: boolean
          submission_id: string
        }
        Insert: {
          codigo_dor: Database["public"]["Enums"]["form_dor_codigo"]
          created_at?: string
          intensidade?: number | null
          principal?: boolean
          selecionada?: boolean
          submission_id: string
        }
        Update: {
          codigo_dor?: Database["public"]["Enums"]["form_dor_codigo"]
          created_at?: string
          intensidade?: number | null
          principal?: boolean
          selecionada?: boolean
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submission_pain_points_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          anonymous_session_id: string | null
          campaign: string | null
          campaign_event: string
          consentimento: boolean
          created_at: string
          custo_atual_faixa: string | null
          custo_referencia:
            | Database["public"]["Enums"]["form_custo_referencia"]
            | null
          destino_trajeto: string
          email: string | null
          faixa_horario: string | null
          frequencia_semanal: string | null
          intencao_motorista:
            | Database["public"]["Enums"]["form_intencao"]
            | null
          intencao_passageiro:
            | Database["public"]["Enums"]["form_intencao"]
            | null
          nome: string
          ocupacao: string | null
          origem_trajeto: string | null
          raw_payload: Json
          research_form_id: string | null
          research_version_id: string | null
          source: string
          submission_id: string
          tipo_usuario: Database["public"]["Enums"]["form_tipo_usuario"]
          transporte_atual: string | null
          user_id: string | null
          whatsapp: string
        }
        Insert: {
          anonymous_session_id?: string | null
          campaign?: string | null
          campaign_event: string
          consentimento?: boolean
          created_at?: string
          custo_atual_faixa?: string | null
          custo_referencia?:
            | Database["public"]["Enums"]["form_custo_referencia"]
            | null
          destino_trajeto: string
          email?: string | null
          faixa_horario?: string | null
          frequencia_semanal?: string | null
          intencao_motorista?:
            | Database["public"]["Enums"]["form_intencao"]
            | null
          intencao_passageiro?:
            | Database["public"]["Enums"]["form_intencao"]
            | null
          nome: string
          ocupacao?: string | null
          origem_trajeto?: string | null
          raw_payload?: Json
          research_form_id?: string | null
          research_version_id?: string | null
          source: string
          submission_id?: string
          tipo_usuario: Database["public"]["Enums"]["form_tipo_usuario"]
          transporte_atual?: string | null
          user_id?: string | null
          whatsapp: string
        }
        Update: {
          anonymous_session_id?: string | null
          campaign?: string | null
          campaign_event?: string
          consentimento?: boolean
          created_at?: string
          custo_atual_faixa?: string | null
          custo_referencia?:
            | Database["public"]["Enums"]["form_custo_referencia"]
            | null
          destino_trajeto?: string
          email?: string | null
          faixa_horario?: string | null
          frequencia_semanal?: string | null
          intencao_motorista?:
            | Database["public"]["Enums"]["form_intencao"]
            | null
          intencao_passageiro?:
            | Database["public"]["Enums"]["form_intencao"]
            | null
          nome?: string
          ocupacao?: string | null
          origem_trajeto?: string | null
          raw_payload?: Json
          research_form_id?: string | null
          research_version_id?: string | null
          source?: string
          submission_id?: string
          tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"]
          transporte_atual?: string | null
          user_id?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_research_form_id_fkey"
            columns: ["research_form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_research_version_id_fkey"
            columns: ["research_version_id"]
            isOneToOne: false
            referencedRelation: "research_form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          anonymous_session_id: string | null
          campaign: string | null
          campaign_event: string
          created_at: string
          device_category: string | null
          event_id: string
          event_name: Database["public"]["Enums"]["funnel_event_name"]
          form_step: string | null
          metadata: Json
          source: string
          submission_id: string | null
          trusted_source: boolean
          user_id: string | null
        }
        Insert: {
          anonymous_session_id?: string | null
          campaign?: string | null
          campaign_event: string
          created_at?: string
          device_category?: string | null
          event_id?: string
          event_name: Database["public"]["Enums"]["funnel_event_name"]
          form_step?: string | null
          metadata?: Json
          source: string
          submission_id?: string | null
          trusted_source?: boolean
          user_id?: string | null
        }
        Update: {
          anonymous_session_id?: string | null
          campaign?: string | null
          campaign_event?: string
          created_at?: string
          device_category?: string | null
          event_id?: string
          event_name?: Database["public"]["Enums"]["funnel_event_name"]
          form_step?: string | null
          metadata?: Json
          source?: string
          submission_id?: string | null
          trusted_source?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["submission_id"]
          },
        ]
      }
      offer_route_quotes: {
        Row: {
          created_at: string
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number
          expires_at: string
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          passenger_price: number
          quote_id: string
          route_duration_minutes: number | null
          route_path: Json | null
          tariff_reference: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km: number
          expires_at?: string
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          passenger_price: number
          quote_id?: string
          route_duration_minutes?: number | null
          route_path?: Json | null
          tariff_reference: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number
          expires_at?: string
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          passenger_price?: number
          quote_id?: string
          route_duration_minutes?: number | null
          route_path?: Json | null
          tariff_reference?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_organizations: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_by: string
          id: string
          kind: string
          municipality: string
          name: string
          notes: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kind: string
          municipality: string
          name: string
          notes?: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          municipality?: string
          name?: string
          notes?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_pilots: {
        Row: {
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          municipality: string
          objective: string
          outcomes: string
          partner_id: string
          research_form_id: string | null
          start_date: string | null
          status: string
          success_criteria: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          municipality: string
          objective?: string
          outcomes?: string
          partner_id: string
          research_form_id?: string | null
          start_date?: string | null
          status?: string
          success_criteria?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          municipality?: string
          objective?: string
          outcomes?: string
          partner_id?: string
          research_form_id?: string | null
          start_date?: string | null
          status?: string
          success_criteria?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_pilots_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_pilots_research_form_id_fkey"
            columns: ["research_form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          paid_at: string | null
          payer_user_id: string
          payment_id: string
          provider: string
          provider_reference: string | null
          ride_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          paid_at?: string | null
          payer_user_id: string
          payment_id?: string
          provider: string
          provider_reference?: string | null
          ride_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          paid_at?: string | null
          payer_user_id?: string
          payment_id?: string
          provider?: string
          provider_reference?: string | null
          ride_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["ride_id"]
          },
        ]
      }
      pitch_contacts: {
        Row: {
          consent_contact: boolean
          consent_newsletter: boolean
          created_at: string
          email: string | null
          id: string
          institution_address: string | null
          institution_name: string | null
          institution_type: string | null
          interest: string
          investor_update_preference: string | null
          message: string
          name: string
          notes: string | null
          partnership_type: string | null
          partnership_type_custom: string | null
          phone: string | null
          raw_payload: Json | null
          same_phone_whatsapp: boolean
          source: string
          status: string
          suggestion_status: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          consent_contact?: boolean
          consent_newsletter?: boolean
          created_at?: string
          email?: string | null
          id?: string
          institution_address?: string | null
          institution_name?: string | null
          institution_type?: string | null
          interest: string
          investor_update_preference?: string | null
          message: string
          name: string
          notes?: string | null
          partnership_type?: string | null
          partnership_type_custom?: string | null
          phone?: string | null
          raw_payload?: Json | null
          same_phone_whatsapp?: boolean
          source?: string
          status?: string
          suggestion_status?: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          consent_contact?: boolean
          consent_newsletter?: boolean
          created_at?: string
          email?: string | null
          id?: string
          institution_address?: string | null
          institution_name?: string | null
          institution_type?: string | null
          interest?: string
          investor_update_preference?: string | null
          message?: string
          name?: string
          notes?: string | null
          partnership_type?: string | null
          partnership_type_custom?: string | null
          phone?: string | null
          raw_payload?: Json | null
          same_phone_whatsapp?: boolean
          source?: string
          status?: string
          suggestion_status?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      price_catalog_items: {
        Row: {
          billing_type: string
          category: string
          code: string
          created_at: string
          description_pt: string | null
          id: string
          is_active: boolean
          is_coming_soon: boolean
          is_pass_through_cost: boolean
          is_starting_from: boolean
          name_pt: string
          quote_required: boolean
          requires_onsite: boolean
          sort_order: number
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          billing_type: string
          category: string
          code: string
          created_at?: string
          description_pt?: string | null
          id?: string
          is_active?: boolean
          is_coming_soon?: boolean
          is_pass_through_cost?: boolean
          is_starting_from?: boolean
          name_pt: string
          quote_required?: boolean
          requires_onsite?: boolean
          sort_order?: number
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          billing_type?: string
          category?: string
          code?: string
          created_at?: string
          description_pt?: string | null
          id?: string
          is_active?: boolean
          is_coming_soon?: boolean
          is_pass_through_cost?: boolean
          is_starting_from?: boolean
          name_pt?: string
          quote_required?: boolean
          requires_onsite?: boolean
          sort_order?: number
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      price_catalog_prices: {
        Row: {
          currency: string
          id: string
          is_available: boolean
          item_id: string
          price_max: number
          price_min: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          currency: string
          id?: string
          is_available?: boolean
          item_id: string
          price_max?: number
          price_min?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          currency?: string
          id?: string
          is_available?: boolean
          item_id?: string
          price_max?: number
          price_min?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_catalog_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "price_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_catalog_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "public_price_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      price_change_log: {
        Row: {
          changed_by: string | null
          created_at: string
          currency: string | null
          entity_id: string
          entity_type: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          currency?: string | null
          entity_id: string
          entity_type: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          currency?: string | null
          entity_id?: string
          entity_type?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          applies_to: string
          code: string
          conditions: Json
          created_at: string
          id: string
          is_active: boolean
          name_pt: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          applies_to?: string
          code: string
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name_pt: string
          type: string
          updated_at?: string
          value?: number
        }
        Update: {
          applies_to?: string
          code?: string
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name_pt?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          default_currency_by_country: Json
          entrada_percent: number
          estimate_validity_days: number
          id: string
          rounding_rule: Json
          show_estimate_to_client: string
          updated_at: string
        }
        Insert: {
          default_currency_by_country?: Json
          entrada_percent?: number
          estimate_validity_days?: number
          id?: string
          rounding_rule?: Json
          show_estimate_to_client?: string
          updated_at?: string
        }
        Update: {
          default_currency_by_country?: Json
          entrada_percent?: number
          estimate_validity_days?: number
          id?: string
          rounding_rule?: Json
          show_estimate_to_client?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_events: {
        Row: {
          campaign: string | null
          created_at: string
          driver_user_id: string | null
          event_id: string
          event_name: Database["public"]["Enums"]["product_event_name"]
          match_id: string | null
          metadata: Json
          offer_id: string | null
          passenger_user_id: string | null
          payment_id: string | null
          request_id: string | null
          ride_id: string | null
          source: string | null
          status: string | null
          trusted_source: boolean
          user_id: string
        }
        Insert: {
          campaign?: string | null
          created_at?: string
          driver_user_id?: string | null
          event_id?: string
          event_name: Database["public"]["Enums"]["product_event_name"]
          match_id?: string | null
          metadata?: Json
          offer_id?: string | null
          passenger_user_id?: string | null
          payment_id?: string | null
          request_id?: string | null
          ride_id?: string | null
          source?: string | null
          status?: string | null
          trusted_source?: boolean
          user_id: string
        }
        Update: {
          campaign?: string | null
          created_at?: string
          driver_user_id?: string | null
          event_id?: string
          event_name?: Database["public"]["Enums"]["product_event_name"]
          match_id?: string | null
          metadata?: Json
          offer_id?: string | null
          passenger_user_id?: string | null
          payment_id?: string | null
          request_id?: string | null
          ride_id?: string | null
          source?: string | null
          status?: string | null
          trusted_source?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "product_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "product_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["request_id"]
          },
        ]
      }
      professional_driver_authorizations: {
        Row: {
          approved: boolean
          approved_at: string | null
          updated_at: string
          user_id: string
          vehicle_type: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          updated_at?: string
          user_id: string
          vehicle_type?: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_driver_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_driver_locations: {
        Row: {
          accuracy_m: number
          lat: number
          lng: number
          municipality: string
          sampled_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_m: number
          lat: number
          lng: number
          municipality: string
          sampled_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number
          lat?: number
          lng?: number
          municipality?: string
          sampled_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_driver_locations_municipality_fkey"
            columns: ["municipality"]
            isOneToOne: false
            referencedRelation: "professional_service_regions"
            referencedColumns: ["municipality"]
          },
          {
            foreignKeyName: "professional_driver_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_presence: {
        Row: {
          is_available: boolean
          last_seen_at: string
          mode: string
          municipality: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          is_available?: boolean
          last_seen_at?: string
          mode?: string
          municipality?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          is_available?: boolean
          last_seen_at?: string
          mode?: string
          municipality?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_quick_rides: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          destination_label: string
          destination_lat: number
          destination_lng: number
          driver_id: string | null
          expires_at: string
          id: string
          municipality: string
          origin_label: string
          origin_lat: number
          origin_lng: number
          passenger_id: string
          pickup_confirmed_at: string | null
          requested_at: string
          status: string
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          destination_label: string
          destination_lat: number
          destination_lng: number
          driver_id?: string | null
          expires_at?: string
          id?: string
          municipality: string
          origin_label: string
          origin_lat: number
          origin_lng: number
          passenger_id: string
          pickup_confirmed_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          vehicle_type: string
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          destination_label?: string
          destination_lat?: number
          destination_lng?: number
          driver_id?: string | null
          expires_at?: string
          id?: string
          municipality?: string
          origin_label?: string
          origin_lat?: number
          origin_lng?: number
          passenger_id?: string
          pickup_confirmed_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_quick_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_quick_rides_municipality_fkey"
            columns: ["municipality"]
            isOneToOne: false
            referencedRelation: "professional_service_regions"
            referencedColumns: ["municipality"]
          },
          {
            foreignKeyName: "professional_quick_rides_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_service_regions: {
        Row: {
          dispatch_enabled: boolean
          municipality: string
          public_discovery_enabled: boolean
          updated_at: string
        }
        Insert: {
          dispatch_enabled?: boolean
          municipality: string
          public_discovery_enabled?: boolean
          updated_at?: string
        }
        Update: {
          dispatch_enabled?: boolean
          municipality?: string
          public_discovery_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          full_name: string
          gender: string | null
          id: string
          ride_opportunity_alerts_enabled: boolean
          travel_preferences: Json
          travel_preferences_consented_at: string | null
          updated_at: string
          vehicle_brand: string | null
          vehicle_description: string | null
          vehicle_plate: string | null
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id: string
          ride_opportunity_alerts_enabled?: boolean
          travel_preferences?: Json
          travel_preferences_consented_at?: string | null
          updated_at?: string
          vehicle_brand?: string | null
          vehicle_description?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          ride_opportunity_alerts_enabled?: boolean
          travel_preferences?: Json
          travel_preferences_consented_at?: string | null
          updated_at?: string
          vehicle_brand?: string | null
          vehicle_description?: string | null
          vehicle_plate?: string | null
        }
        Relationships: []
      }
      research_answers: {
        Row: {
          answers: Json
          client_submission_key: string
          consent_accepted: boolean
          form_id: string
          id: string
          submitted_at: string
          version_id: string
        }
        Insert: {
          answers: Json
          client_submission_key?: string
          consent_accepted?: boolean
          form_id: string
          id?: string
          submitted_at?: string
          version_id: string
        }
        Update: {
          answers?: Json
          client_submission_key?: string
          consent_accepted?: boolean
          form_id?: string
          id?: string
          submitted_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_answers_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_answers_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "research_form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      research_configuration_history: {
        Row: {
          created_at: string
          created_by: string
          form_id: string
          revision: number
          settings: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          form_id: string
          revision: number
          settings: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          form_id?: string
          revision?: number
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "research_configuration_history_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      research_configurations: {
        Row: {
          form_id: string
          revision: number
          settings: Json
          updated_at: string
          updated_by: string
        }
        Insert: {
          form_id: string
          revision: number
          settings: Json
          updated_at?: string
          updated_by: string
        }
        Update: {
          form_id?: string
          revision?: number
          settings?: Json
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_configurations_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: true
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      research_form_lifecycle_audit: {
        Row: {
          action: string
          actor_id: string | null
          answer_count: number
          created_at: string
          form_code: string
          form_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          answer_count?: number
          created_at?: string
          form_code: string
          form_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          answer_count?: number
          created_at?: string
          form_code?: string
          form_id?: string
          id?: string
        }
        Relationships: []
      }
      research_form_versions: {
        Row: {
          form_id: string
          id: string
          published_at: string | null
          schema_json: Json
          version_number: number
        }
        Insert: {
          form_id: string
          id?: string
          published_at?: string | null
          schema_json?: Json
          version_number: number
        }
        Update: {
          form_id?: string
          id?: string
          published_at?: string | null
          schema_json?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      research_forms: {
        Row: {
          audience: string
          brand_display_name: string | null
          brand_image_alt: string | null
          brand_image_path: string | null
          caronaa_presence_at: string | null
          caronaa_presence_on: string | null
          code: string
          created_at: string
          id: string
          is_enabled: boolean
          mobility_configured: boolean
          mobility_mode: string
          municipality: string | null
          nature: string
          status: string
          survey_ends_at: string | null
          survey_ends_on: string | null
          survey_starts_at: string | null
          survey_starts_on: string | null
          title: string
          trash_previous_status: string | null
          trashed_at: string | null
          trashed_by: string | null
        }
        Insert: {
          audience?: string
          brand_display_name?: string | null
          brand_image_alt?: string | null
          brand_image_path?: string | null
          caronaa_presence_at?: string | null
          caronaa_presence_on?: string | null
          code: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          mobility_configured?: boolean
          mobility_mode?: string
          municipality?: string | null
          nature: string
          status?: string
          survey_ends_at?: string | null
          survey_ends_on?: string | null
          survey_starts_at?: string | null
          survey_starts_on?: string | null
          title: string
          trash_previous_status?: string | null
          trashed_at?: string | null
          trashed_by?: string | null
        }
        Update: {
          audience?: string
          brand_display_name?: string | null
          brand_image_alt?: string | null
          brand_image_path?: string | null
          caronaa_presence_at?: string | null
          caronaa_presence_on?: string | null
          code?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          mobility_configured?: boolean
          mobility_mode?: string
          municipality?: string | null
          nature?: string
          status?: string
          survey_ends_at?: string | null
          survey_ends_on?: string | null
          survey_starts_at?: string | null
          survey_starts_on?: string | null
          title?: string
          trash_previous_status?: string | null
          trashed_at?: string | null
          trashed_by?: string | null
        }
        Relationships: []
      }
      research_interest_requests: {
        Row: {
          answer_id: string
          consent_accepted: boolean
          created_at: string
          journey: Json
          profile: string
          status: string
        }
        Insert: {
          answer_id: string
          consent_accepted: boolean
          created_at?: string
          journey: Json
          profile: string
          status: string
        }
        Update: {
          answer_id?: string
          consent_accepted?: boolean
          created_at?: string
          journey?: Json
          profile?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_interest_requests_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "research_journeys"
            referencedColumns: ["answer_id"]
          },
        ]
      }
      research_journeys: {
        Row: {
          answer_id: string
          configuration_revision: number
          configuration_snapshot: Json
          created_at: string
          journey: Json
        }
        Insert: {
          answer_id: string
          configuration_revision: number
          configuration_snapshot: Json
          created_at?: string
          journey: Json
        }
        Update: {
          answer_id?: string
          configuration_revision?: number
          configuration_snapshot?: Json
          created_at?: string
          journey?: Json
        }
        Relationships: [
          {
            foreignKeyName: "research_journeys_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "research_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      research_launch_release_audit: {
        Row: {
          action: string
          actor_id: string | null
          changed_at: string
          form_id: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          changed_at?: string
          form_id: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          changed_at?: string
          form_id?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "research_launch_release_audit_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      research_launch_releases: {
        Row: {
          form_id: string
          released_at: string | null
          released_by: string | null
          updated_at: string
        }
        Insert: {
          form_id: string
          released_at?: string | null
          released_by?: string | null
          updated_at?: string
        }
        Update: {
          form_id?: string
          released_at?: string | null
          released_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_launch_releases_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: true
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      research_lead_contacts: {
        Row: {
          answer_id: string
          captured_at: string
          consent_version: string
          form_id: string
          institutional_domain_recognized: boolean
          linkage_consent: boolean
          marketing_consent: boolean
          normalized_email: string
        }
        Insert: {
          answer_id: string
          captured_at?: string
          consent_version?: string
          form_id: string
          institutional_domain_recognized?: boolean
          linkage_consent: boolean
          marketing_consent?: boolean
          normalized_email: string
        }
        Update: {
          answer_id?: string
          captured_at?: string
          consent_version?: string
          form_id?: string
          institutional_domain_recognized?: boolean
          linkage_consent?: boolean
          marketing_consent?: boolean
          normalized_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_lead_contacts_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "research_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_lead_contacts_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      research_participation_badges: {
        Row: {
          answer_id: string
          form_id: string
          id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          answer_id: string
          form_id: string
          id?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          answer_id?: string
          form_id?: string
          id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_participation_badges_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "research_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_participation_badges_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      research_whatsapp_contacts: {
        Row: {
          answer_id: string
          captured_at: string
          contact_consent: boolean
          form_id: string
          linkage_consent: boolean
          whatsapp_e164: string
        }
        Insert: {
          answer_id: string
          captured_at?: string
          contact_consent?: boolean
          form_id: string
          linkage_consent: boolean
          whatsapp_e164: string
        }
        Update: {
          answer_id?: string
          captured_at?: string
          contact_consent?: boolean
          form_id?: string
          linkage_consent?: boolean
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_whatsapp_contacts_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "research_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_whatsapp_contacts_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_boarding_codes: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          failed_attempts: number
          locked_until: string | null
          ride_id: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          ride_id: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_boarding_codes_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: true
            referencedRelation: "rides"
            referencedColumns: ["ride_id"]
          },
        ]
      }
      ride_completion_confirmations: {
        Row: {
          confirmed_at: string
          ride_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          ride_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string
          ride_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_completion_confirmations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["ride_id"]
          },
        ]
      }
      ride_locations: {
        Row: {
          accuracy_m: number
          captured_at: string
          latitude: number
          longitude: number
          ride_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_m: number
          captured_at: string
          latitude: number
          longitude: number
          ride_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number
          captured_at?: string
          latitude?: number
          longitude?: number
          ride_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_locations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["ride_id"]
          },
        ]
      }
      ride_matches: {
        Row: {
          created_at: string
          driver_user_id: string
          match_id: string
          offer_id: string
          passenger_user_id: string
          request_id: string
          ride_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          driver_user_id: string
          match_id?: string
          offer_id: string
          passenger_user_id: string
          request_id: string
          ride_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          driver_user_id?: string
          match_id?: string
          offer_id?: string
          passenger_user_id?: string
          request_id?: string
          ride_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_matches_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "ride_matches_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["request_id"]
          },
        ]
      }
      ride_notifications: {
        Row: {
          created_at: string
          event_name: string
          match_id: string
          notification_id: string
          read_at: string | null
          ride_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          match_id: string
          notification_id?: string
          read_at?: string | null
          ride_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          match_id?: string
          notification_id?: string
          read_at?: string | null
          ride_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ride_matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "ride_notifications_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["ride_id"]
          },
        ]
      }
      ride_offers: {
        Row: {
          accepts_quoted_fares: boolean
          available_seats: number
          created_at: string
          departure_time: string
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          idempotency_key: string | null
          meeting_lat: number | null
          meeting_lng: number | null
          meeting_point: string | null
          notes: string | null
          offer_id: string
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          passenger_gender_preference: string
          passenger_price: number | null
          ride_date: string
          route_distance_km: number | null
          route_duration_minutes: number | null
          route_path: Json | null
          route_quote_id: string | null
          routine_date: string | null
          routine_id: string | null
          routine_override: boolean
          routine_suppressed: boolean
          seats_remaining: number
          status: string
          time_tolerance_minutes: number
          total_price: number
          travel_preferences: Json | null
          updated_at: string
          user_id: string
          vehicle_description: string | null
        }
        Insert: {
          accepts_quoted_fares?: boolean
          available_seats: number
          created_at?: string
          departure_time: string
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          idempotency_key?: string | null
          meeting_lat?: number | null
          meeting_lng?: number | null
          meeting_point?: string | null
          notes?: string | null
          offer_id?: string
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          passenger_gender_preference?: string
          passenger_price?: number | null
          ride_date: string
          route_distance_km?: number | null
          route_duration_minutes?: number | null
          route_path?: Json | null
          route_quote_id?: string | null
          routine_date?: string | null
          routine_id?: string | null
          routine_override?: boolean
          routine_suppressed?: boolean
          seats_remaining: number
          status?: string
          time_tolerance_minutes?: number
          total_price?: number
          travel_preferences?: Json | null
          updated_at?: string
          user_id: string
          vehicle_description?: string | null
        }
        Update: {
          accepts_quoted_fares?: boolean
          available_seats?: number
          created_at?: string
          departure_time?: string
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          idempotency_key?: string | null
          meeting_lat?: number | null
          meeting_lng?: number | null
          meeting_point?: string | null
          notes?: string | null
          offer_id?: string
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          passenger_gender_preference?: string
          passenger_price?: number | null
          ride_date?: string
          route_distance_km?: number | null
          route_duration_minutes?: number | null
          route_path?: Json | null
          route_quote_id?: string | null
          routine_date?: string | null
          routine_id?: string | null
          routine_override?: boolean
          routine_suppressed?: boolean
          seats_remaining?: number
          status?: string
          time_tolerance_minutes?: number
          total_price?: number
          travel_preferences?: Json | null
          updated_at?: string
          user_id?: string
          vehicle_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_route_quote_id_fkey"
            columns: ["route_quote_id"]
            isOneToOne: false
            referencedRelation: "offer_route_quotes"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "ride_offers_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "ride_routines"
            referencedColumns: ["routine_id"]
          },
        ]
      }
      ride_opportunity_alerts: {
        Row: {
          alert_id: string
          created_at: string
          offer_id: string
          read_at: string | null
          request_id: string
          user_id: string
        }
        Insert: {
          alert_id?: string
          created_at?: string
          offer_id: string
          read_at?: string | null
          request_id: string
          user_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          offer_id?: string
          read_at?: string | null
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_opportunity_alerts_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "ride_opportunity_alerts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["request_id"]
          },
        ]
      }
      ride_qr_tokens: {
        Row: {
          consumed_at: string | null
          expires_at: string
          ride_id: string
          token: string
        }
        Insert: {
          consumed_at?: string | null
          expires_at?: string
          ride_id: string
          token?: string
        }
        Update: {
          consumed_at?: string | null
          expires_at?: string
          ride_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_qr_tokens_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["ride_id"]
          },
        ]
      }
      ride_ratings: {
        Row: {
          comment: string
          created_at: string
          rated_user_id: string
          reviewer_user_id: string
          ride_id: string
          score: number
        }
        Insert: {
          comment?: string
          created_at?: string
          rated_user_id: string
          reviewer_user_id: string
          ride_id: string
          score: number
        }
        Update: {
          comment?: string
          created_at?: string
          rated_user_id?: string
          reviewer_user_id?: string
          ride_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ride_ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["ride_id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          created_at: string
          departure_time: string
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          idempotency_key: string | null
          notes: string | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          original_requested_at: string | null
          passenger_count: number
          passenger_group_total: number | null
          passenger_price: number | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_point: string | null
          price: number | null
          request_id: string
          ride_date: string
          route_distance_km: number | null
          route_quote_id: string | null
          routine_date: string | null
          routine_id: string | null
          routine_override: boolean
          routine_suppressed: boolean
          status: string
          target_offer_id: string | null
          tariff_reference: string | null
          time_tolerance_minutes: number
          travel_preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          departure_time: string
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          idempotency_key?: string | null
          notes?: string | null
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          original_requested_at?: string | null
          passenger_count: number
          passenger_group_total?: number | null
          passenger_price?: number | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_point?: string | null
          price?: number | null
          request_id?: string
          ride_date: string
          route_distance_km?: number | null
          route_quote_id?: string | null
          routine_date?: string | null
          routine_id?: string | null
          routine_override?: boolean
          routine_suppressed?: boolean
          status?: string
          target_offer_id?: string | null
          tariff_reference?: string | null
          time_tolerance_minutes?: number
          travel_preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          departure_time?: string
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          idempotency_key?: string | null
          notes?: string | null
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          original_requested_at?: string | null
          passenger_count?: number
          passenger_group_total?: number | null
          passenger_price?: number | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_point?: string | null
          price?: number | null
          request_id?: string
          ride_date?: string
          route_distance_km?: number | null
          route_quote_id?: string | null
          routine_date?: string | null
          routine_id?: string | null
          routine_override?: boolean
          routine_suppressed?: boolean
          status?: string
          target_offer_id?: string | null
          tariff_reference?: string | null
          time_tolerance_minutes?: number
          travel_preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_route_quote_id_fkey"
            columns: ["route_quote_id"]
            isOneToOne: false
            referencedRelation: "offer_route_quotes"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "ride_requests_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "ride_routines"
            referencedColumns: ["routine_id"]
          },
          {
            foreignKeyName: "ride_requests_target_offer_id_fkey"
            columns: ["target_offer_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["offer_id"]
          },
        ]
      }
      ride_road_assessments: {
        Row: {
          added_duration_minutes: number
          assessment_id: string
          expires_at: string
          inventory_version: string
          offer_id: string
          quote_id: string | null
          request_id: string | null
          user_id: string
        }
        Insert: {
          added_duration_minutes: number
          assessment_id?: string
          expires_at?: string
          inventory_version: string
          offer_id: string
          quote_id?: string | null
          request_id?: string | null
          user_id: string
        }
        Update: {
          added_duration_minutes?: number
          assessment_id?: string
          expires_at?: string
          inventory_version?: string
          offer_id?: string
          quote_id?: string | null
          request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_road_assessments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "ride_road_assessments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "offer_route_quotes"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "ride_road_assessments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["request_id"]
          },
        ]
      }
      ride_routines: {
        Row: {
          active: boolean
          created_at: string
          days: number[]
          departure_time: string
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          end_date: string | null
          generated_on: string | null
          kind: string
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          routine_id: string
          seat_count: number
          start_date: string
          time_tolerance_minutes: number
          total_price: number
          travel_preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days: number[]
          departure_time: string
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          end_date?: string | null
          generated_on?: string | null
          kind: string
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          routine_id?: string
          seat_count: number
          start_date: string
          time_tolerance_minutes?: number
          total_price?: number
          travel_preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days?: number[]
          departure_time?: string
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          end_date?: string | null
          generated_on?: string | null
          kind?: string
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          routine_id?: string
          seat_count?: number
          start_date?: string
          time_tolerance_minutes?: number
          total_price?: number
          travel_preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ride_status_history: {
        Row: {
          actor_user_id: string | null
          created_at: string
          from_status: string | null
          history_id: string
          ride_id: string
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          history_id?: string
          ride_id: string
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          history_id?: string
          ride_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_status_history_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["ride_id"]
          },
        ]
      }
      rides: {
        Row: {
          boarded_at: string | null
          completed_at: string | null
          created_at: string
          driver_accepted_at: string | null
          driver_user_id: string
          match_id: string
          offer_id: string
          passenger_accepted_at: string | null
          passenger_contribution: number
          passenger_group_total: number | null
          passenger_price: number | null
          passenger_user_id: string
          pickup_estimated_at: string | null
          request_id: string
          response_expires_at: string
          ride_id: string
          route_distance_km: number | null
          route_quote_id: string | null
          status: string
          tariff_reference: string | null
          total_price: number
          transit_stage: string
          updated_at: string
        }
        Insert: {
          boarded_at?: string | null
          completed_at?: string | null
          created_at?: string
          driver_accepted_at?: string | null
          driver_user_id: string
          match_id: string
          offer_id: string
          passenger_accepted_at?: string | null
          passenger_contribution?: number
          passenger_group_total?: number | null
          passenger_price?: number | null
          passenger_user_id: string
          pickup_estimated_at?: string | null
          request_id: string
          response_expires_at?: string
          ride_id?: string
          route_distance_km?: number | null
          route_quote_id?: string | null
          status: string
          tariff_reference?: string | null
          total_price?: number
          transit_stage?: string
          updated_at?: string
        }
        Update: {
          boarded_at?: string | null
          completed_at?: string | null
          created_at?: string
          driver_accepted_at?: string | null
          driver_user_id?: string
          match_id?: string
          offer_id?: string
          passenger_accepted_at?: string | null
          passenger_contribution?: number
          passenger_group_total?: number | null
          passenger_price?: number | null
          passenger_user_id?: string
          pickup_estimated_at?: string | null
          request_id?: string
          response_expires_at?: string
          ride_id?: string
          route_distance_km?: number | null
          route_quote_id?: string | null
          status?: string
          tariff_reference?: string | null
          total_price?: number
          transit_stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rides_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "ride_matches"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "rides_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["offer_id"]
          },
          {
            foreignKeyName: "rides_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "rides_route_quote_id_fkey"
            columns: ["route_quote_id"]
            isOneToOne: false
            referencedRelation: "offer_route_quotes"
            referencedColumns: ["quote_id"]
          },
        ]
      }
      safety_case_events: {
        Row: {
          actor_id: string | null
          case_id: string
          created_at: string
          id: string
          new_status: string
          note: string | null
          previous_status: string | null
        }
        Insert: {
          actor_id?: string | null
          case_id: string
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          previous_status?: string | null
        }
        Update: {
          actor_id?: string | null
          case_id?: string
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "safety_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_cases: {
        Row: {
          assigned_to: string | null
          case_number: number
          created_at: string
          created_by: string
          description: string
          due_at: string | null
          id: string
          kind: string
          priority: string
          reporter_user_id: string | null
          resolved_at: string | null
          status: string
          subject_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_number?: never
          created_at?: string
          created_by?: string
          description?: string
          due_at?: string | null
          id?: string
          kind: string
          priority?: string
          reporter_user_id?: string | null
          resolved_at?: string | null
          status?: string
          subject_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_number?: never
          created_at?: string
          created_by?: string
          description?: string
          due_at?: string | null
          id?: string
          kind?: string
          priority?: string
          reporter_user_id?: string | null
          resolved_at?: string | null
          status?: string
          subject_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          admin_adjusted_total: number | null
          admin_notes: string | null
          agreed_deadline: string | null
          agreed_payment_terms: string | null
          agreed_price: number | null
          brand_status: string | null
          business_area: string | null
          business_stage: string | null
          city: string | null
          client_id: string | null
          company_name: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          country: string | null
          created_at: string
          currency: string | null
          desired_deadline_days: number | null
          estimate_snapshot: Json
          estimate_valid_until: string | null
          estimate_version: number
          final_currency: string | null
          global_answers: Json
          id: string
          internal_notes: string | null
          ip_address: string | null
          lead_id: string | null
          primary_goals: string[]
          privacy_policy_accepted: boolean | null
          reference_code: string
          reference_links: string | null
          revision_history: Json
          selected_bundle_code: string | null
          status: string
          trial_requested: boolean | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_adjusted_total?: number | null
          admin_notes?: string | null
          agreed_deadline?: string | null
          agreed_payment_terms?: string | null
          agreed_price?: number | null
          brand_status?: string | null
          business_area?: string | null
          business_stage?: string | null
          city?: string | null
          client_id?: string | null
          company_name?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          desired_deadline_days?: number | null
          estimate_snapshot?: Json
          estimate_valid_until?: string | null
          estimate_version?: number
          final_currency?: string | null
          global_answers?: Json
          id?: string
          internal_notes?: string | null
          ip_address?: string | null
          lead_id?: string | null
          primary_goals?: string[]
          privacy_policy_accepted?: boolean | null
          reference_code: string
          reference_links?: string | null
          revision_history?: Json
          selected_bundle_code?: string | null
          status?: string
          trial_requested?: boolean | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_adjusted_total?: number | null
          admin_notes?: string | null
          agreed_deadline?: string | null
          agreed_payment_terms?: string | null
          agreed_price?: number | null
          brand_status?: string | null
          business_area?: string | null
          business_stage?: string | null
          city?: string | null
          client_id?: string | null
          company_name?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          desired_deadline_days?: number | null
          estimate_snapshot?: Json
          estimate_valid_until?: string | null
          estimate_version?: number
          final_currency?: string | null
          global_answers?: Json
          id?: string
          internal_notes?: string | null
          ip_address?: string | null
          lead_id?: string | null
          primary_goals?: string[]
          privacy_policy_accepted?: boolean | null
          reference_code?: string
          reference_links?: string | null
          revision_history?: Json
          selected_bundle_code?: string | null
          status?: string
          trial_requested?: boolean | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      tech_work_item_events: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          item_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          item_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_work_item_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tech_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_work_items: {
        Row: {
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          external_url: string | null
          id: string
          kind: string
          occurred_at: string | null
          owner_id: string | null
          resolved_at: string | null
          service_name: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          external_url?: string | null
          id?: string
          kind: string
          occurred_at?: string | null
          owner_id?: string | null
          resolved_at?: string | null
          service_name?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          external_url?: string | null
          id?: string
          kind?: string
          occurred_at?: string | null
          owner_id?: string | null
          resolved_at?: string | null
          service_name?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      teste_backup_caronaa: {
        Row: {
          criado_em: string
          email: string | null
          id: number
          nome: string
          observacao: string | null
          origem: string | null
        }
        Insert: {
          criado_em?: string
          email?: string | null
          id?: number
          nome: string
          observacao?: string | null
          origem?: string | null
        }
        Update: {
          criado_em?: string
          email?: string | null
          id?: number
          nome?: string
          observacao?: string | null
          origem?: string | null
        }
        Relationships: []
      }
      unified_crm_contact_statuses: {
        Row: {
          contact_key: string
          status: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          contact_key: string
          status?: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          contact_key?: string
          status?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      unifor_prelaunch_intents: {
        Row: {
          answer_id: string
          created_at: string
          departure_time: string | null
          destination_area: string | null
          form_id: string
          intent_kind: string
          origin_area: string | null
          scheduled_date: string
          status: string
          user_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          departure_time?: string | null
          destination_area?: string | null
          form_id: string
          intent_kind: string
          origin_area?: string | null
          scheduled_date?: string
          status?: string
          user_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          departure_time?: string | null
          destination_area?: string | null
          form_id?: string
          intent_kind?: string
          origin_area?: string | null
          scheduled_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unifor_prelaunch_intents_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "research_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unifor_prelaunch_intents_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "research_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_places: {
        Row: {
          kind: string
          label: string
          latitude: number
          longitude: number
          updated_at: string
          user_id: string
        }
        Insert: {
          kind: string
          label: string
          latitude: number
          longitude: number
          updated_at?: string
          user_id: string
        }
        Update: {
          kind?: string
          label?: string
          latitude?: number
          longitude?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding_events: {
        Row: {
          event_type: string
          recorded_at: string
          step: string
          user_id: string
        }
        Insert: {
          event_type: string
          recorded_at?: string
          step: string
          user_id: string
        }
        Update: {
          event_type?: string
          recorded_at?: string
          step?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding_progress: {
        Row: {
          affiliation_type: string | null
          completed_at: string | null
          current_step: string
          institution_code: string | null
          region_code: string | null
          status: string
          updated_at: string
          usage_role: string | null
          user_id: string
        }
        Insert: {
          affiliation_type?: string | null
          completed_at?: string | null
          current_step?: string
          institution_code?: string | null
          region_code?: string | null
          status?: string
          updated_at?: string
          usage_role?: string | null
          user_id: string
        }
        Update: {
          affiliation_type?: string | null
          completed_at?: string | null
          current_step?: string
          institution_code?: string | null
          region_code?: string | null
          status?: string
          updated_at?: string
          usage_role?: string | null
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
      user_verifications: {
        Row: {
          created_at: string
          id: string
          institution_name: string | null
          source: Database["public"]["Enums"]["user_verification_source"]
          source_reference_id: string | null
          status: Database["public"]["Enums"]["user_verification_status"]
          type: Database["public"]["Enums"]["user_verification_type"]
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_email: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          institution_name?: string | null
          source: Database["public"]["Enums"]["user_verification_source"]
          source_reference_id?: string | null
          status?: Database["public"]["Enums"]["user_verification_status"]
          type: Database["public"]["Enums"]["user_verification_type"]
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_email?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          institution_name?: string | null
          source?: Database["public"]["Enums"]["user_verification_source"]
          source_reference_id?: string | null
          status?: Database["public"]["Enums"]["user_verification_status"]
          type?: Database["public"]["Enums"]["user_verification_type"]
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_price_catalog: {
        Row: {
          billing_type: string | null
          category: string | null
          code: string | null
          currency: string | null
          description_pt: string | null
          id: string | null
          is_available: boolean | null
          is_coming_soon: boolean | null
          is_pass_through_cost: boolean | null
          is_starting_from: boolean | null
          name_pt: string | null
          price_max: number | null
          price_min: number | null
          quote_required: boolean | null
          requires_onsite: boolean | null
          sort_order: number | null
          unit_label: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_operate_ride: {
        Args: {
          p_action: string
          p_document?: boolean
          p_id: string
          p_note?: string
          p_offer_id?: string
          p_vehicle?: boolean
        }
        Returns: string
      }
      admin_quick_ride_overview: { Args: never; Returns: Json }
      admin_set_quick_ride_driver: {
        Args: { p_approved: boolean; p_email: string; p_vehicle_type: string }
        Returns: string
      }
      admin_set_quick_ride_region: {
        Args: {
          p_discovery: boolean
          p_dispatch: boolean
          p_municipality: string
        }
        Returns: undefined
      }
      are_ride_routes_compatible: {
        Args: {
          offer_destination: string
          offer_destination_lat: number
          offer_destination_lng: number
          offer_origin: string
          offer_origin_lat: number
          offer_origin_lng: number
          request_destination: string
          request_destination_lat: number
          request_destination_lng: number
          request_origin: string
          request_origin_lat: number
          request_origin_lng: number
          tolerance_km?: number
        }
        Returns: boolean
      }
      assert_corporate_research_driver: {
        Args: {
          p_answers: Json
          p_form_id: string
          p_journey: Json
          p_version_id: string
        }
        Returns: undefined
      }
      can_access_restricted_research: {
        Args: { p_form_id: string }
        Returns: boolean
      }
      capture_research_lead: {
        Args: {
          p_email: string
          p_form_id: string
          p_linkage_consent: boolean
          p_marketing_consent?: boolean
          p_submission_key: string
        }
        Returns: string
      }
      capture_research_whatsapp: {
        Args: {
          p_contact_consent?: boolean
          p_form_id: string
          p_linkage_consent: boolean
          p_submission_key: string
          p_whatsapp: string
        }
        Returns: string
      }
      change_ride_routine_occurrence: {
        Args: {
          p_cancel?: boolean
          p_changes?: Json
          p_id: string
          p_kind: string
        }
        Returns: undefined
      }
      choose_ride_opportunity: {
        Args: {
          p_expected_pickup: string
          p_offer_id: string
          p_request_id: string
        }
        Returns: string
      }
      claim_research_participation: {
        Args: { p_submission_key: string }
        Returns: Json
      }
      confirm_form_account_activation: {
        Args: { p_changes?: Json; p_submission_id: string }
        Returns: Json
      }
      confirm_ride_by_qr: { Args: { p_token: string }; Returns: Json }
      create_configured_research_form: {
        Args: { p_metadata: Json; p_schema: Json; p_settings: Json }
        Returns: string
      }
      create_preferred_ride: {
        Args: { p_details: Json; p_kind: string; p_preferences?: Json }
        Returns: string
      }
      create_priced_ride_request: {
        Args: {
          p_departure_time: string
          p_passenger_count?: number
          p_preferences?: Json
          p_quote_id: string
          p_ride_date: string
          p_time_tolerance_minutes?: number
        }
        Returns: string
      }
      create_research_form_draft: {
        Args: {
          p_audience: string
          p_code: string
          p_municipality: string
          p_nature: string
          p_schema: Json
          p_title: string
        }
        Returns: string
      }
      create_ride_offer:
        | {
            Args: {
              p_available_seats: number
              p_departure_time: string
              p_destination: string
              p_destination_lat?: number
              p_destination_lng?: number
              p_origin: string
              p_origin_lat?: number
              p_origin_lng?: number
              p_ride_date: string
              p_time_tolerance_minutes?: number
              p_total_price?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_available_seats: number
              p_departure_time: string
              p_destination: string
              p_destination_lat: number
              p_destination_lng: number
              p_origin: string
              p_origin_lat: number
              p_origin_lng: number
              p_passenger_gender_preference: string
              p_ride_date: string
              p_time_tolerance_minutes: number
              p_total_price: number
            }
            Returns: string
          }
      create_ride_request: {
        Args: {
          p_departure_time: string
          p_destination: string
          p_destination_lat?: number
          p_destination_lng?: number
          p_origin: string
          p_origin_lat?: number
          p_origin_lng?: number
          p_passenger_count: number
          p_price?: number
          p_ride_date: string
          p_time_tolerance_minutes?: number
        }
        Returns: string
      }
      create_scheduled_research_form:
        | {
            Args: {
              p_caronaa_on: string
              p_ends_on: string
              p_metadata: Json
              p_schema: Json
              p_settings: Json
              p_starts_on: string
            }
            Returns: string
          }
        | {
            Args: {
              p_caronaa_at: string
              p_caronaa_on: string
              p_ends_at: string
              p_ends_on: string
              p_metadata: Json
              p_schema: Json
              p_settings: Json
              p_starts_at: string
              p_starts_on: string
            }
            Returns: string
          }
      delete_empty_research_draft: {
        Args: { p_form_id: string }
        Returns: boolean
      }
      delete_unanswered_research_form: {
        Args: { p_confirm_code: string; p_form_id: string }
        Returns: boolean
      }
      discover_approximate_professional_drivers: {
        Args: { p_municipality: string }
        Returns: {
          driver_key: string
          lat: number
          lng: number
          seen_at: string
        }[]
      }
      discover_ride_opportunities: { Args: { p_search?: Json }; Returns: Json }
      distance_km: {
        Args: { lat_a: number; lat_b: number; lng_a: number; lng_b: number }
        Returns: number
      }
      distance_point_to_segment_km: {
        Args: {
          end_lat: number
          end_lng: number
          point_lat: number
          point_lng: number
          start_lat: number
          start_lng: number
        }
        Returns: number
      }
      duplicate_research_form: { Args: { p_form_id: string }; Returns: string }
      evaluate_ride_candidate: {
        Args: { o: Database["public"]["Tables"]["ride_offers"]["Row"]; q: Json }
        Returns: Json
      }
      expire_ride_match_proposals: { Args: never; Returns: number }
      generate_ride_qr_token: { Args: { p_ride_id: string }; Returns: Json }
      get_acquisition_funnel_metrics: {
        Args: {
          p_campaign?: string
          p_event?: string
          p_period_end?: string
          p_period_start?: string
          p_profile?: string
          p_source?: string
        }
        Returns: Json
      }
      get_admin_finance_recent: {
        Args: { p_limit?: number; p_since?: string }
        Returns: {
          amount: number
          created_at: string
          currency: string
          payment_id: string
          payment_status: string
          provider: string
        }[]
      }
      get_admin_finance_summary: {
        Args: { p_since?: string }
        Returns: {
          currency: string
          payment_status: string
          provider: string
          total_amount: number
          transactions: number
        }[]
      }
      get_admin_operation_data: { Args: never; Returns: Json }
      get_admin_research_crm_rows: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json[]
      }
      get_admin_research_lead_metrics: {
        Args: { p_form_id?: string }
        Returns: Json
      }
      get_admin_research_lead_sources: {
        Args: never
        Returns: {
          contact_count: number
          form_id: string
          form_title: string
          source_code: string
        }[]
      }
      get_admin_research_leads: {
        Args: {
          p_form_id?: string
          p_limit?: number
          p_marketing_only?: boolean
          p_offset?: number
          p_status?: string
        }
        Returns: {
          captured_at: string
          email: string
          form_id: string
          form_title: string
          marketing_consent: boolean
          registration_status: string
          source_code: string
          total_count: number
        }[]
      }
      get_admin_users: { Args: { p_user_id?: string }; Returns: Json }
      get_configured_research_summary: {
        Args: { p_filters?: Json }
        Returns: {
          answered: number
          category: string
          eligible: number
          semantic_code: string
          total: number
          version_id: string
          version_number: number
        }[]
      }
      get_form_account_activation: { Args: never; Returns: Json }
      get_form_funnel_metrics: {
        Args: {
          p_campaign?: string
          p_event?: string
          p_ocupacao?: string
          p_period_end?: string
          p_period_start?: string
          p_source?: string
          p_tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"]
        }
        Returns: Json
      }
      get_form_metrics: {
        Args: {
          p_campaign?: string
          p_event?: string
          p_ocupacao?: string
          p_period_end?: string
          p_period_start?: string
          p_source?: string
          p_tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"]
        }
        Returns: Json
      }
      get_form_pain_analysis: {
        Args: {
          p_campaign?: string
          p_event?: string
          p_frequency_weight?: number
          p_intensity_weight?: number
          p_interest_weight?: number
          p_ocupacao?: string
          p_period_end?: string
          p_period_start?: string
          p_primary_weight?: number
          p_sort_by?: string
          p_source?: string
          p_tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"]
        }
        Returns: Json
      }
      get_main_funnel_metrics: {
        Args: {
          p_campaign?: string
          p_cohort_event?: string
          p_event?: string
          p_period_end?: string
          p_period_start?: string
          p_profile?: string
          p_source?: string
        }
        Returns: Json
      }
      get_municipal_research_overview: { Args: never; Returns: Json }
      get_my_admin_scope: { Args: never; Returns: Json }
      get_my_onboarding_research_suggestions: { Args: never; Returns: Json }
      get_my_pix_key: { Args: never; Returns: string }
      get_my_research_launch_state: { Args: never; Returns: Json }
      get_my_research_participation_badges: {
        Args: never
        Returns: {
          form_code: string
          form_id: string
          form_title: string
          verified_at: string
        }[]
      }
      get_my_ride_opportunities: {
        Args: { p_offer_id?: string }
        Returns: Json
      }
      get_my_ride_routines: { Args: never; Returns: Json }
      get_my_travel_preferences: { Args: never; Returns: Json }
      get_my_unifor_launch_state: { Args: never; Returns: Json }
      get_offer_preference_bonuses: {
        Args: { p_offer_ids: string[] }
        Returns: {
          bonus: number
          offer_id: string
        }[]
      }
      get_offer_publication_prices: {
        Args: { p_offer_ids: string[] }
        Returns: {
          offer_id: string
          passenger_price: number
          route_distance_km: number
        }[]
      }
      get_offer_schedule_types: {
        Args: { p_offer_ids: string[] }
        Returns: {
          is_recurring: boolean
          offer_id: string
        }[]
      }
      get_operational_metrics: {
        Args: {
          p_campaign?: string
          p_destination?: string
          p_origin?: string
          p_period_end?: string
          p_period_start?: string
          p_profile?: string
          p_source?: string
          p_time_window?: string
        }
        Returns: Json
      }
      get_opportunity_route_context: {
        Args: { p_offer_id: string; p_quote_id?: string; p_request_id?: string }
        Returns: Json
      }
      get_public_research_configuration: {
        Args: { p_code: string }
        Returns: Json
      }
      get_research_answer_summary: {
        Args: { p_form_id: string }
        Returns: Json
      }
      get_research_bi: {
        Args: {
          p_form_id?: string
          p_nature?: string
          p_occupation?: string
          p_profile?: string
        }
        Returns: Json
      }
      get_research_form_code_availability: {
        Args: { p_code: string }
        Returns: Json
      }
      get_research_form_removal_eligibility: {
        Args: { p_form_id: string }
        Returns: Json
      }
      get_research_launch_admin_state: {
        Args: { p_form_id: string }
        Returns: Json
      }
      get_research_legacy_metrics: {
        Args: {
          p_form_id?: string
          p_nature?: string
          p_occupation?: string
          p_pain_code?: string
          p_profile?: string
        }
        Returns: Json
      }
      get_research_mobility_dimensions: {
        Args: {
          p_form_id?: string
          p_nature?: string
          p_occupation?: string
          p_pain_code?: string
          p_profile?: string
        }
        Returns: Json
      }
      get_research_semantic_summary: {
        Args: { p_form_id: string }
        Returns: {
          category: string
          semantic_code: string
          total: number
        }[]
      }
      get_research_unified_bi: {
        Args: {
          p_form_id?: string
          p_nature?: string
          p_occupation?: string
          p_pain_code?: string
          p_profile?: string
        }
        Returns: Json
      }
      get_research_window_state: { Args: { p_code: string }; Returns: Json }
      get_retention_metrics: {
        Args: {
          p_campaign?: string
          p_period_end?: string
          p_period_start?: string
          p_source?: string
          p_tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"]
        }
        Returns: Json
      }
      get_ride_pix: { Args: { p_ride_id: string }; Returns: Json }
      get_ride_safety: { Args: { p_ride_id: string }; Returns: Json }
      get_strategic_crossings: {
        Args: {
          p_campaign?: string
          p_period_end?: string
          p_period_start?: string
          p_source?: string
        }
        Returns: Json
      }
      get_sts_ride_seed: { Args: never; Returns: Json }
      get_validation_export: {
        Args: {
          p_campaign?: string
          p_event?: string
          p_kind: string
          p_period_end?: string
          p_period_start?: string
          p_source?: string
          p_tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"]
        }
        Returns: Json
      }
      grant_corporate_research_access: {
        Args: { p_form_id: string; p_reference: string; p_user_id: string }
        Returns: boolean
      }
      has_admin_department_access: {
        Args: { p_department: string; p_write?: boolean }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_route_coordinates: {
        Args: {
          destination_lat: number
          destination_lng: number
          origin_lat: number
          origin_lng: number
        }
        Returns: boolean
      }
      has_valid_route_path: { Args: { p_path: Json }; Returns: boolean }
      is_admin_or_team:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_point_compatible_with_route: {
        Args: {
          endpoint_lat: number
          endpoint_lng: number
          point_lat: number
          point_lng: number
          route_destination_lat: number
          route_destination_lng: number
          route_origin_lat: number
          route_origin_lng: number
          tolerance_km: number
        }
        Returns: boolean
      }
      is_research_launch_locked: { Args: { p_user: string }; Returns: boolean }
      is_restricted_research: { Args: { p_form_id: string }; Returns: boolean }
      is_super_admin:
        | { Args: never; Returns: boolean }
        | { Args: { p_user_id: string }; Returns: boolean }
      is_unifor_prelaunch_locked: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      issue_ride_boarding_code: {
        Args: { p_ride_id: string }
        Returns: undefined
      }
      list_corporate_research_access: {
        Args: { p_form_id: string }
        Returns: {
          revoked_at: string
          user_id: string
          verified_at: string
        }[]
      }
      mark_ride_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_ride_opportunity_alerts_read: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      materialize_ride_routine: {
        Args: { p_routine_id: string }
        Returns: undefined
      }
      opportunity_request_input: {
        Args: {
          p_gender: string
          r: Database["public"]["Tables"]["ride_requests"]["Row"]
        }
        Returns: Json
      }
      permanently_delete_trashed_research_form: {
        Args: {
          p_confirm_code: string
          p_confirm_phrase: string
          p_expected_answers: number
          p_form_id: string
        }
        Returns: boolean
      }
      persist_ride_route_quote: {
        Args: {
          p_group_total: number
          p_passenger_price: number
          p_ride_id: string
          p_route_distance_km: number
          p_tariff_reference: string
        }
        Returns: boolean
      }
      professional_location_opt_in: {
        Args: {
          p_accuracy_m: number
          p_lat: number
          p_lng: number
          p_municipality: string
        }
        Returns: boolean
      }
      professional_location_stop: { Args: never; Returns: undefined }
      project_ride_route: {
        Args: { p_lat: number; p_lng: number; p_path: Json }
        Returns: Json
      }
      publish_priced_offer: {
        Args: { p_details: Json; p_preferences?: Json; p_quote_id: string }
        Returns: string
      }
      publish_research_form: {
        Args: { p_form_id: string; p_schema: Json; p_version_id: string }
        Returns: boolean
      }
      publish_sts_ride: {
        Args: { p_details: Json; p_kind: string; p_submission_id: string }
        Returns: string
      }
      quick_ride_accept: { Args: { p_id: string }; Returns: boolean }
      quick_ride_confirm_pickup: { Args: { p_id: string }; Returns: boolean }
      quick_ride_driver_queue: {
        Args: { p_municipality: string }
        Returns: {
          destination_label: string
          expires_at: string
          id: string
          origin_label: string
          requested_at: string
          vehicle_type: string
        }[]
      }
      quick_ride_my_requests: {
        Args: never
        Returns: {
          destination_label: string
          expires_at: string
          id: string
          municipality: string
          origin_label: string
          requested_at: string
          role: string
          status: string
          vehicle_type: string
        }[]
      }
      quick_ride_request: {
        Args: {
          p_destination_label: string
          p_destination_lat: number
          p_destination_lng: number
          p_municipality: string
          p_origin_label: string
          p_origin_lat: number
          p_origin_lng: number
          p_vehicle_type: string
        }
        Returns: string
      }
      quick_ride_transition: {
        Args: { p_id: string; p_status: string }
        Returns: boolean
      }
      rate_ride: {
        Args: { p_comment?: string; p_ride_id: string; p_score: number }
        Returns: undefined
      }
      recalculate_ride_cost_split: {
        Args: { p_offer_id: string }
        Returns: undefined
      }
      refresh_ride_routine_occurrences: { Args: never; Returns: undefined }
      register_research_interest: {
        Args: {
          p_consent: boolean
          p_form_id: string
          p_journey?: Json
          p_profile: string
          p_submission_key: string
        }
        Returns: string
      }
      request_available_ride_offer: {
        Args: { p_offer_id: string; p_passenger_count?: number }
        Returns: string
      }
      request_available_ride_segment: {
        Args: {
          p_departure_time: string
          p_offer_id: string
          p_passenger_count?: number
          p_quote_id: string
          p_ride_date: string
          p_time_tolerance_minutes?: number
        }
        Returns: string
      }
      request_intelligent_ride_segment: {
        Args: {
          p_accept_adjustment?: boolean
          p_departure_time: string
          p_expected_pickup?: string
          p_offer_id: string
          p_passenger_count?: number
          p_quote_id: string
          p_ride_date: string
          p_time_tolerance_minutes?: number
        }
        Returns: string
      }
      require_opportunity_road_assessment: {
        Args: { p_offer_id: string; p_quote_id: string; p_request_id: string }
        Returns: undefined
      }
      research_condition_matches: {
        Args: {
          v_answers: Json
          v_condition: Json
          v_depth?: number
          v_schema: Json
        }
        Returns: boolean
      }
      research_contact_capture_enabled: {
        Args: { p_form_id: string }
        Returns: boolean
      }
      research_launch_instant: { Args: { p_settings: Json }; Returns: string }
      research_launch_participant: {
        Args: { p_form: string; p_user: string }
        Returns: boolean
      }
      research_launch_wait_eligible: {
        Args: { p_form: string; p_user: string }
        Returns: boolean
      }
      research_question_visible: {
        Args: {
          v_answers: Json
          v_depth?: number
          v_id: string
          v_schema: Json
        }
        Returns: boolean
      }
      research_remap_condition: { Args: { c: Json; ids: Json }; Returns: Json }
      respond_to_ride_match: {
        Args: { p_response: string; p_ride_id: string }
        Returns: string
      }
      restore_trashed_research_form: {
        Args: { p_form_id: string }
        Returns: boolean
      }
      revoke_corporate_research_access: {
        Args: { p_form_id: string; p_user_id: string }
        Returns: boolean
      }
      revoke_ride_location: { Args: { p_ride_id: string }; Returns: undefined }
      ride_preferences_compatible: {
        Args: { o: Json; q: Json }
        Returns: boolean
      }
      ride_route_inventory_version: {
        Args: { p_offer_id: string }
        Returns: string
      }
      save_my_pix_key: { Args: { p_key: string }; Returns: undefined }
      save_my_travel_preferences: {
        Args: { p_consent: boolean; p_preferences: Json }
        Returns: undefined
      }
      save_research_configuration: {
        Args: {
          p_expected_revision?: number
          p_form_id: string
          p_settings: Json
        }
        Returns: number
      }
      save_ride_routine: {
        Args: { p_definition: Json; p_routine_id?: string }
        Returns: string
      }
      search_available_ride_offers: {
        Args: {
          p_departure_time?: string
          p_destination?: string
          p_destination_lat?: number
          p_destination_lng?: number
          p_limit?: number
          p_origin?: string
          p_origin_lat?: number
          p_origin_lng?: number
          p_passenger_count?: number
          p_ride_date?: string
          p_time_tolerance_minutes?: number
        }
        Returns: {
          available_seats: number
          avatar_url: string
          city: string
          created_at: string
          departure_time: string
          destination: string
          destination_lat: number
          destination_lng: number
          full_name: string
          offer_id: string
          origin: string
          origin_lat: number
          origin_lng: number
          ride_date: string
          seats_remaining: number
          status: string
          user_id: string
          verifications: Json
        }[]
      }
      set_admin_department_assignment: {
        Args: {
          p_can_write?: boolean
          p_department: string
          p_enabled?: boolean
          p_user_id: string
        }
        Returns: boolean
      }
      set_professional_presence: {
        Args: { p_available: boolean; p_municipality?: string }
        Returns: undefined
      }
      set_research_launch_release: {
        Args: { p_form_id: string; p_released: boolean }
        Returns: Json
      }
      set_ride_opportunity_alerts: {
        Args: { p_enabled?: boolean }
        Returns: boolean
      }
      set_ride_routine_active: {
        Args: { p_active: boolean; p_routine_id: string }
        Returns: undefined
      }
      submit_configured_research_answer: {
        Args: {
          p_answers: Json
          p_form_id: string
          p_journey: Json
          p_research_consent: boolean
          p_revision: number
          p_submission_key: string
          p_version_id: string
        }
        Returns: boolean
      }
      submit_form_response: {
        Args: {
          p_anonymous_session_id?: string
          p_pain_points: Json
          p_submission: Json
        }
        Returns: string
      }
      sync_my_ride_opportunity_alerts: { Args: never; Returns: Json }
      sync_user_verifications: {
        Args: { _user_id: string }
        Returns: undefined
      }
      transition_ride_status: {
        Args: { p_next_status: string; p_ride_id: string }
        Returns: string
      }
      trash_research_form: { Args: { p_form_id: string }; Returns: boolean }
      travel_preference_bonus: { Args: { o: Json; q: Json }; Returns: number }
      travel_route_score: {
        Args: {
          odlat: number
          odlng: number
          oolat: number
          oolng: number
          ot: string
          qdlat: number
          qdlng: number
          qolat: number
          qolng: number
          qt: string
        }
        Returns: number
      }
      try_match_ride_request: {
        Args: { p_preferred_offer_id?: string; p_request_id: string }
        Returns: string
      }
      update_ride_location: {
        Args: {
          p_accuracy_m: number
          p_captured_at: string
          p_latitude: number
          p_longitude: number
          p_ride_id: string
        }
        Returns: undefined
      }
      update_ride_total_cost: {
        Args: { p_ride_id: string; p_total_price: number }
        Returns: number
      }
      update_ride_transit_stage: {
        Args: { p_ride_id: string; p_stage: string }
        Returns: string
      }
      upsert_unifor_prelaunch_intent: {
        Args: { p_answer: string; p_user: string }
        Returns: undefined
      }
      validate_research_configuration: { Args: { p: Json }; Returns: undefined }
      validate_research_journey: { Args: { c: Json; p: Json }; Returns: Json }
      validate_ride_boarding: {
        Args: { p_code: string; p_ride_id: string }
        Returns: string
      }
      validate_travel_preferences: { Args: { p: Json }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      form_custo_referencia: "TRECHO" | "DIA"
      form_dor_codigo:
        | "DOR_01"
        | "DOR_02"
        | "DOR_03"
        | "DOR_04"
        | "DOR_05"
        | "DOR_06"
      form_intencao:
        | "HOJE"
        | "PROVAVELMENTE"
        | "TALVEZ"
        | "PROVAVELMENTE_NAO"
        | "NAO"
      form_tipo_usuario: "PASSAGEIRO" | "MOTORISTA" | "AMBOS"
      funnel_event_name:
        | "landing_view"
        | "form_started"
        | "form_step_completed"
        | "form_completed"
        | "lead_created"
      payment_status:
        | "PENDING"
        | "PROCESSING"
        | "PAID"
        | "FAILED"
        | "CANCELLED"
        | "REFUNDED"
      product_event_name:
        | "USER_REGISTERED"
        | "RIDE_REQUEST_CREATED"
        | "RIDE_OFFER_CREATED"
        | "MATCH_CREATED"
        | "RIDE_STARTED"
        | "RIDE_COMPLETED"
        | "PAYMENT_COMPLETED"
        | "RIDE_REPEATED"
      user_verification_source: "EMAIL_DOMAIN" | "EVENT_FORM" | "ADMIN"
      user_verification_status: "VERIFIED" | "REVOKED"
      user_verification_type: "UNIFOR" | "STS_2026" | "CARONAA_TEST"
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
      app_role: ["admin", "moderator", "user"],
      form_custo_referencia: ["TRECHO", "DIA"],
      form_dor_codigo: [
        "DOR_01",
        "DOR_02",
        "DOR_03",
        "DOR_04",
        "DOR_05",
        "DOR_06",
      ],
      form_intencao: [
        "HOJE",
        "PROVAVELMENTE",
        "TALVEZ",
        "PROVAVELMENTE_NAO",
        "NAO",
      ],
      form_tipo_usuario: ["PASSAGEIRO", "MOTORISTA", "AMBOS"],
      funnel_event_name: [
        "landing_view",
        "form_started",
        "form_step_completed",
        "form_completed",
        "lead_created",
      ],
      payment_status: [
        "PENDING",
        "PROCESSING",
        "PAID",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
      ],
      product_event_name: [
        "USER_REGISTERED",
        "RIDE_REQUEST_CREATED",
        "RIDE_OFFER_CREATED",
        "MATCH_CREATED",
        "RIDE_STARTED",
        "RIDE_COMPLETED",
        "PAYMENT_COMPLETED",
        "RIDE_REPEATED",
      ],
      user_verification_source: ["EMAIL_DOMAIN", "EVENT_FORM", "ADMIN"],
      user_verification_status: ["VERIFIED", "REVOKED"],
      user_verification_type: ["UNIFOR", "STS_2026", "CARONAA_TEST"],
    },
  },
} as const
