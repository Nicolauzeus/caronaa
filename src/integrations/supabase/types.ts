export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      product_events: {
        Row: { event_id: string; event_name: Database["public"]["Enums"]["product_event_name"]; user_id: string; ride_id: string | null; match_id: string | null; status: string | null; source: string | null; campaign: string | null; created_at: string; metadata: Json };
        Insert: { event_id?: string; event_name: Database["public"]["Enums"]["product_event_name"]; user_id: string; ride_id?: string | null; match_id?: string | null; status?: string | null; source?: string | null; campaign?: string | null; created_at?: string; metadata?: Json };
        Update: { event_id?: string; event_name?: Database["public"]["Enums"]["product_event_name"]; user_id?: string; ride_id?: string | null; match_id?: string | null; status?: string | null; source?: string | null; campaign?: string | null; created_at?: string; metadata?: Json };
        Relationships: [];
      };
      form_funnel_events: {
        Row: {
          anonymous_session_id: string;
          campaign: string | null;
          campaign_event: string;
          created_at: string;
          event_id: string;
          event_name: string;
          event_step: string | null;
          idempotency_key: string;
          source: string;
          user_id: string | null;
        };
        Insert: {
          anonymous_session_id: string;
          campaign?: string | null;
          campaign_event: string;
          created_at?: string;
          event_id?: string;
          event_name: string;
          event_step?: string | null;
          idempotency_key: string;
          source: string;
          user_id?: string | null;
        };
        Update: {
          anonymous_session_id?: string;
          campaign?: string | null;
          campaign_event?: string;
          created_at?: string;
          event_id?: string;
          event_name?: string;
          event_step?: string | null;
          idempotency_key?: string;
          source?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      form_submission_pain_points: {
        Row: {
          codigo_dor: Database["public"]["Enums"]["form_dor_codigo"];
          created_at: string;
          intensidade: number | null;
          principal: boolean;
          selecionada: boolean;
          submission_id: string;
        };
        Insert: {
          codigo_dor: Database["public"]["Enums"]["form_dor_codigo"];
          created_at?: string;
          intensidade?: number | null;
          principal?: boolean;
          selecionada?: boolean;
          submission_id: string;
        };
        Update: {
          codigo_dor?: Database["public"]["Enums"]["form_dor_codigo"];
          created_at?: string;
          intensidade?: number | null;
          principal?: boolean;
          selecionada?: boolean;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "form_submission_pain_points_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "form_submissions";
            referencedColumns: ["submission_id"];
          },
        ];
      };
      form_submissions: {
        Row: {
          anonymous_session_id: string | null;
          campaign: string | null;
          campaign_event: string;
          consentimento: boolean;
          created_at: string;
          custo_atual_faixa: string | null;
          custo_referencia: Database["public"]["Enums"]["form_custo_referencia"] | null;
          destino_trajeto: string;
          email: string | null;
          faixa_horario: string | null;
          frequencia_semanal: string | null;
          intencao_motorista: Database["public"]["Enums"]["form_intencao"] | null;
          intencao_passageiro: Database["public"]["Enums"]["form_intencao"] | null;
          nome: string;
          ocupacao: string | null;
          origem_trajeto: string | null;
          raw_payload: Json;
          source: string;
          submission_id: string;
          tipo_usuario: Database["public"]["Enums"]["form_tipo_usuario"];
          transporte_atual: string | null;
          user_id: string | null;
          whatsapp: string;
        };
        Insert: {
          anonymous_session_id?: string | null;
          campaign?: string | null;
          campaign_event: string;
          consentimento?: boolean;
          created_at?: string;
          custo_atual_faixa?: string | null;
          custo_referencia?: Database["public"]["Enums"]["form_custo_referencia"] | null;
          destino_trajeto: string;
          email?: string | null;
          faixa_horario?: string | null;
          frequencia_semanal?: string | null;
          intencao_motorista?: Database["public"]["Enums"]["form_intencao"] | null;
          intencao_passageiro?: Database["public"]["Enums"]["form_intencao"] | null;
          nome: string;
          ocupacao?: string | null;
          origem_trajeto?: string | null;
          raw_payload?: Json;
          source: string;
          submission_id?: string;
          tipo_usuario: Database["public"]["Enums"]["form_tipo_usuario"];
          transporte_atual?: string | null;
          user_id?: string | null;
          whatsapp: string;
        };
        Update: {
          anonymous_session_id?: string | null;
          campaign?: string | null;
          campaign_event?: string;
          consentimento?: boolean;
          created_at?: string;
          custo_atual_faixa?: string | null;
          custo_referencia?: Database["public"]["Enums"]["form_custo_referencia"] | null;
          destino_trajeto?: string;
          email?: string | null;
          faixa_horario?: string | null;
          frequencia_semanal?: string | null;
          intencao_motorista?: Database["public"]["Enums"]["form_intencao"] | null;
          intencao_passageiro?: Database["public"]["Enums"]["form_intencao"] | null;
          nome?: string;
          ocupacao?: string | null;
          origem_trajeto?: string | null;
          raw_payload?: Json;
          source?: string;
          submission_id?: string;
          tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"];
          transporte_atual?: string | null;
          user_id?: string | null;
          whatsapp?: string;
        };
        Relationships: [];
      };
      form_starts: {
        Row: {
          anonymous_session_id: string | null;
          campaign: string | null;
          campaign_event: string;
          created_at: string;
          ocupacao: string | null;
          raw_payload: Json;
          source: string;
          start_id: string;
          tipo_usuario: Database["public"]["Enums"]["form_tipo_usuario"] | null;
          user_id: string | null;
        };
        Insert: {
          anonymous_session_id?: string | null;
          campaign?: string | null;
          campaign_event: string;
          created_at?: string;
          ocupacao?: string | null;
          raw_payload?: Json;
          source: string;
          start_id?: string;
          tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"] | null;
          user_id?: string | null;
        };
        Update: {
          anonymous_session_id?: string | null;
          campaign?: string | null;
          campaign_event?: string;
          created_at?: string;
          ocupacao?: string | null;
          raw_payload?: Json;
          source?: string;
          start_id?: string;
          tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"] | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      funnel_events: {
        Row: {
          anonymous_session_id: string | null;
          campaign: string | null;
          campaign_event: string;
          created_at: string;
          device_category: string | null;
          event_id: string;
          event_name: Database["public"]["Enums"]["funnel_event_name"];
          form_step: string | null;
          metadata: Json;
          source: string;
          submission_id: string | null;
          user_id: string | null;
        };
        Insert: {
          anonymous_session_id?: string | null;
          campaign?: string | null;
          campaign_event: string;
          created_at?: string;
          device_category?: string | null;
          event_id?: string;
          event_name: Database["public"]["Enums"]["funnel_event_name"];
          form_step?: string | null;
          metadata?: Json;
          source: string;
          submission_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          anonymous_session_id?: string | null;
          campaign?: string | null;
          campaign_event?: string;
          created_at?: string;
          device_category?: string | null;
          event_id?: string;
          event_name?: Database["public"]["Enums"]["funnel_event_name"];
          form_step?: string | null;
          metadata?: Json;
          source?: string;
          submission_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "funnel_events_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "form_submissions";
            referencedColumns: ["submission_id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          city: string | null;
          created_at: string;
          full_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          city?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          city?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      teste_backup_caronaa: {
        Row: {
          criado_em: string;
          email: string | null;
          id: number;
          nome: string;
          observacao: string | null;
          origem: string | null;
        };
        Insert: {
          criado_em?: string;
          email?: string | null;
          id?: number;
          nome: string;
          observacao?: string | null;
          origem?: string | null;
        };
        Update: {
          criado_em?: string;
          email?: string | null;
          id?: number;
          nome?: string;
          observacao?: string | null;
          origem?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_form_funnel_metrics: {
        Args: {
          p_campaign?: string | null;
          p_event?: string | null;
          p_ocupacao?: string | null;
          p_period_end?: string | null;
          p_period_start?: string | null;
          p_source?: string | null;
          p_tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"] | null;
        };
        Returns: Json;
      };
      get_form_metrics: {
        Args: {
          p_campaign?: string | null;
          p_event?: string | null;
          p_ocupacao?: string | null;
          p_period_end?: string | null;
          p_period_start?: string | null;
          p_source?: string | null;
          p_tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"] | null;
        };
        Returns: Json;
      };
      get_form_pain_analysis: {
        Args: {
          p_campaign?: string | null;
          p_event?: string | null;
          p_frequency_weight?: number | null;
          p_intensity_weight?: number | null;
          p_interest_weight?: number | null;
          p_ocupacao?: string | null;
          p_period_end?: string | null;
          p_period_start?: string | null;
          p_primary_weight?: number | null;
          p_sort_by?: string | null;
          p_source?: string | null;
          p_tipo_usuario?: Database["public"]["Enums"]["form_tipo_usuario"] | null;
        };
        Returns: Json;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
      form_custo_referencia: "TRECHO" | "DIA";
      form_dor_codigo: "DOR_01" | "DOR_02" | "DOR_03" | "DOR_04" | "DOR_05" | "DOR_06";
      form_intencao: "HOJE" | "PROVAVELMENTE" | "TALVEZ" | "PROVAVELMENTE_NAO" | "NAO";
      form_tipo_usuario: "PASSAGEIRO" | "MOTORISTA" | "AMBOS";
      funnel_event_name:
        "landing_view" | "form_started" | "form_step_completed" | "form_completed" | "lead_created";
      product_event_name:
        | "USER_REGISTERED"
        | "RIDE_REQUEST_CREATED"
        | "RIDE_OFFER_CREATED"
        | "MATCH_CREATED"
        | "RIDE_STARTED"
        | "RIDE_COMPLETED"
        | "PAYMENT_COMPLETED"
        | "RIDE_REPEATED";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      form_custo_referencia: ["TRECHO", "DIA"],
      form_dor_codigo: ["DOR_01", "DOR_02", "DOR_03", "DOR_04", "DOR_05", "DOR_06"],
      form_intencao: ["HOJE", "PROVAVELMENTE", "TALVEZ", "PROVAVELMENTE_NAO", "NAO"],
      form_tipo_usuario: ["PASSAGEIRO", "MOTORISTA", "AMBOS"],
    },
  },
} as const;
