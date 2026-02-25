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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clinical_trial_approvals: {
        Row: {
          approval_date: string
          created_at: string
          dev_region: string | null
          id: string
          phase: string
          product_name: string
          seq_number: number
          sponsor: string
          trial_title: string
        }
        Insert: {
          approval_date: string
          created_at?: string
          dev_region?: string | null
          id?: string
          phase: string
          product_name: string
          seq_number: number
          sponsor: string
          trial_title: string
        }
        Update: {
          approval_date?: string
          created_at?: string
          dev_region?: string | null
          id?: string
          phase?: string
          product_name?: string
          seq_number?: number
          sponsor?: string
          trial_title?: string
        }
        Relationships: []
      }
      ibric_reports: {
        Row: {
          affiliation: string | null
          author: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          summary: string | null
          title: string
          url: string
          views: number | null
        }
        Insert: {
          affiliation?: string | null
          author?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          summary?: string | null
          title: string
          url: string
          views?: number | null
        }
        Update: {
          affiliation?: string | null
          author?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          summary?: string | null
          title?: string
          url?: string
          views?: number | null
        }
        Relationships: []
      }
      industry_reports: {
        Row: {
          broker: string
          created_at: string
          date: string
          id: string
          pdf_url: string | null
          report_url: string
          summary: string | null
          title: string
          views: number | null
        }
        Insert: {
          broker: string
          created_at?: string
          date: string
          id?: string
          pdf_url?: string | null
          report_url: string
          summary?: string | null
          title: string
          views?: number | null
        }
        Update: {
          broker?: string
          created_at?: string
          date?: string
          id?: string
          pdf_url?: string | null
          report_url?: string
          summary?: string | null
          title?: string
          views?: number | null
        }
        Relationships: []
      }
      nce_patent_expiry: {
        Row: {
          api_name: string
          api_name_ko: string | null
          company: string | null
          created_at: string
          expiry_date: string
          id: string
          indication: string | null
          market_size: string | null
          product_name: string
          recommendation: number | null
          updated_at: string
        }
        Insert: {
          api_name: string
          api_name_ko?: string | null
          company?: string | null
          created_at?: string
          expiry_date: string
          id?: string
          indication?: string | null
          market_size?: string | null
          product_name: string
          recommendation?: number | null
          updated_at?: string
        }
        Update: {
          api_name?: string
          api_name_ko?: string | null
          company?: string | null
          created_at?: string
          expiry_date?: string
          id?: string
          indication?: string | null
          market_size?: string | null
          product_name?: string
          recommendation?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          api_keywords: string[]
          category: string
          country: string
          created_at: string
          date: string
          id: string
          original_language: string | null
          region: string
          related_keywords: string[]
          source: string
          summary: string
          title: string
          url: string
        }
        Insert: {
          api_keywords?: string[]
          category?: string
          country?: string
          created_at?: string
          date: string
          id?: string
          original_language?: string | null
          region: string
          related_keywords?: string[]
          source: string
          summary: string
          title: string
          url: string
        }
        Update: {
          api_keywords?: string[]
          category?: string
          country?: string
          created_at?: string
          date?: string
          id?: string
          original_language?: string | null
          region?: string
          related_keywords?: string[]
          source?: string
          summary?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      regulatory_notices: {
        Row: {
          created_at: string
          date: string
          id: string
          related_apis: string[]
          source: string
          title: string
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          related_apis?: string[]
          source: string
          title: string
          type: string
          url: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          related_apis?: string[]
          source?: string
          title?: string
          type?: string
          url?: string
        }
        Relationships: []
      }
      substack_posts: {
        Row: {
          created_at: string
          date: string
          id: string
          is_free: boolean
          source: string
          source_label: string
          summary: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_free?: boolean
          source: string
          source_label: string
          summary?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_free?: boolean
          source?: string
          source_label?: string
          summary?: string | null
          title?: string
          url?: string
        }
        Relationships: []
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
