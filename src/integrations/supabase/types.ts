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
          source?: string
          submission_id?: string
          tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"]
          transporte_atual?: string | null
          user_id?: string | null
          whatsapp?: string
        }
        Relationships: []
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
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          full_name: string
          gender: string | null
          id: string
          travel_preferences: Json
          travel_preferences_consented_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id: string
          travel_preferences?: Json
          travel_preferences_consented_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          travel_preferences?: Json
          travel_preferences_consented_at?: string | null
          updated_at?: string
        }
        Relationships: []
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
          ride_date: string
          routine_date: string | null
          routine_id: string | null
          routine_override: boolean
          routine_suppressed: boolean
          seats_remaining: number
          status: string
          time_tolerance_minutes: number
          total_price: number
          travel_preferences: Json | null
          vehicle_description: string | null
          user_id: string
        }
        Insert: {
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
          ride_date: string
          routine_date?: string | null
          routine_id?: string | null
          routine_override?: boolean
          routine_suppressed?: boolean
          seats_remaining: number
          status?: string
          time_tolerance_minutes?: number
          total_price?: number
          travel_preferences?: Json | null
          vehicle_description?: string | null
          user_id: string
        }
        Update: {
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
          ride_date?: string
          routine_date?: string | null
          routine_id?: string | null
          routine_override?: boolean
          routine_suppressed?: boolean
          seats_remaining?: number
          status?: string
          time_tolerance_minutes?: number
          total_price?: number
          travel_preferences?: Json | null
          vehicle_description?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "ride_routines"
            referencedColumns: ["routine_id"]
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
          passenger_count: number
          price: number | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_point: string | null
          request_id: string
          ride_date: string
          routine_date: string | null
          routine_id: string | null
          routine_override: boolean
          routine_suppressed: boolean
          status: string
          target_offer_id: string | null
          time_tolerance_minutes: number
          travel_preferences: Json | null
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
          passenger_count: number
          price?: number | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_point?: string | null
          request_id?: string
          ride_date: string
          routine_date?: string | null
          routine_id?: string | null
          routine_override?: boolean
          routine_suppressed?: boolean
          status?: string
          target_offer_id?: string | null
          time_tolerance_minutes?: number
          travel_preferences?: Json | null
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
          passenger_count?: number
          price?: number | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_point?: string | null
          request_id?: string
          ride_date?: string
          routine_date?: string | null
          routine_id?: string | null
          routine_override?: boolean
          routine_suppressed?: boolean
          status?: string
          target_offer_id?: string | null
          time_tolerance_minutes?: number
          travel_preferences?: Json | null
          user_id?: string
        }
        Relationships: [
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
          passenger_user_id: string
          request_id: string
          response_expires_at: string
          ride_id: string
          status: string
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
          passenger_user_id: string
          request_id: string
          response_expires_at?: string
          ride_id?: string
          status: string
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
          passenger_user_id?: string
          request_id?: string
          response_expires_at?: string
          ride_id?: string
          status?: string
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
        ]
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
      [_ in never]: never
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
      change_ride_routine_occurrence: {
        Args: {
          p_cancel?: boolean
          p_changes?: Json
          p_id: string
          p_kind: string
        }
        Returns: undefined
      }
      confirm_form_account_activation: {
        Args: { p_changes?: Json; p_submission_id: string }
        Returns: Json
      }
      confirm_ride_by_qr: { Args: { p_token: string }; Returns: Json }
      create_preferred_ride: {
        Args: { p_details: Json; p_kind: string; p_preferences?: Json }
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
      get_admin_operation_data: { Args: never; Returns: Json }
      get_admin_users: { Args: { p_user_id?: string }; Returns: Json }
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
      get_my_pix_key: { Args: never; Returns: string }
      get_my_ride_routines: { Args: never; Returns: Json }
      get_my_travel_preferences: { Args: never; Returns: Json }
      get_offer_preference_bonuses: {
        Args: { p_offer_ids: string[] }
        Returns: {
          bonus: number
          offer_id: string
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
      issue_ride_boarding_code: {
        Args: { p_ride_id: string }
        Returns: undefined
      }
      mark_ride_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      materialize_ride_routine: {
        Args: { p_routine_id: string }
        Returns: undefined
      }
      publish_sts_ride: {
        Args: { p_details: Json; p_kind: string; p_submission_id: string }
        Returns: string
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
      request_available_ride_offer: {
        Args: { p_offer_id: string; p_passenger_count?: number }
        Returns: string
      }
      respond_to_ride_match: {
        Args: { p_response: string; p_ride_id: string }
        Returns: string
      }
      revoke_ride_location: { Args: { p_ride_id: string }; Returns: undefined }
      ride_preferences_compatible: {
        Args: { o: Json; q: Json }
        Returns: boolean
      }
      save_my_pix_key: { Args: { p_key: string }; Returns: undefined }
      save_my_travel_preferences: {
        Args: { p_consent: boolean; p_preferences: Json }
        Returns: undefined
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
      set_ride_routine_active: {
        Args: { p_active: boolean; p_routine_id: string }
        Returns: undefined
      }
      submit_form_response: {
        Args: {
          p_anonymous_session_id?: string
          p_pain_points: Json
          p_submission: Json
        }
        Returns: string
      }
      sync_user_verifications: {
        Args: { _user_id: string }
        Returns: undefined
      }
      transition_ride_status: {
        Args: { p_next_status: string; p_ride_id: string }
        Returns: string
      }
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
      user_verification_type: "UNIFOR" | "STS_2026"
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
      user_verification_type: ["UNIFOR", "STS_2026"],
    },
  },
} as const
