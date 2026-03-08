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
      bingo_claims: {
        Row: {
          cartela_id: number | null
          claimed_at: string
          game_id: string
          id: string
          is_valid: boolean | null
          strike_count: number
          user_id: string
        }
        Insert: {
          cartela_id?: number | null
          claimed_at?: string
          game_id?: string
          id?: string
          is_valid?: boolean | null
          strike_count?: number
          user_id: string
        }
        Update: {
          cartela_id?: number | null
          claimed_at?: string
          game_id?: string
          id?: string
          is_valid?: boolean | null
          strike_count?: number
          user_id?: string
        }
        Relationships: []
      }
      cartelas: {
        Row: {
          created_at: string
          id: number
          is_favorite: boolean
          is_used: boolean
          numbers: Json
          owner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          is_favorite?: boolean
          is_used?: boolean
          numbers: Json
          owner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          is_favorite?: boolean
          is_used?: boolean
          numbers?: Json
          owner_id?: string | null
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          bank: string
          created_at: string
          id: string
          reference: string
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank: string
          created_at?: string
          id?: string
          reference: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank?: string
          created_at?: string
          id?: string
          reference?: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_chat: {
        Row: {
          created_at: string
          game_id: string
          id: string
          is_reaction: boolean
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id?: string
          id?: string
          is_reaction?: boolean
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          is_reaction?: boolean
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      game_history: {
        Row: {
          created_at: string
          drawn_numbers: Json
          game_id: string
          id: string
          pattern: string
          players_count: number
          prize: number
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          drawn_numbers?: Json
          game_id: string
          id?: string
          pattern?: string
          players_count?: number
          prize?: number
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          drawn_numbers?: Json
          game_id?: string
          id?: string
          pattern?: string
          players_count?: number
          prize?: number
          winner_id?: string | null
        }
        Relationships: []
      }
      game_numbers: {
        Row: {
          created_at: string
          game_id: string
          id: number
          number: number
        }
        Insert: {
          created_at?: string
          game_id?: string
          id?: number
          number: number
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: number
          number?: number
        }
        Relationships: []
      }
      games: {
        Row: {
          cartela_price: number
          created_at: string
          draw_speed: number
          id: string
          pattern: string
          prize_amount: number
          status: string
          winner_id: string | null
        }
        Insert: {
          cartela_price?: number
          created_at?: string
          draw_speed?: number
          id?: string
          pattern?: string
          prize_amount?: number
          status?: string
          winner_id?: string | null
        }
        Update: {
          cartela_price?: number
          created_at?: string
          draw_speed?: number
          id?: string
          pattern?: string
          prize_amount?: number
          status?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          account_number: string
          amount: number
          bank: string
          created_at: string
          id: string
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          amount: number
          bank: string
          created_at?: string
          id?: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          amount?: number
          bank?: string
          created_at?: string
          id?: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
