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
      downtime_categories: {
        Row: {
          ad: string
          created_at: string
          id: string
        }
        Insert: {
          ad: string
          created_at?: string
          id?: string
        }
        Update: {
          ad?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      downtime_logs: {
        Row: {
          baslangic: string | null
          bitis: string | null
          category_id: string
          created_at: string
          id: string
          machine_id: string
          notlar: string | null
          operator_id: string
          sure_dakika: number
          vardiya: Database["public"]["Enums"]["shift_type"]
        }
        Insert: {
          baslangic?: string | null
          bitis?: string | null
          category_id: string
          created_at?: string
          id?: string
          machine_id: string
          notlar?: string | null
          operator_id: string
          sure_dakika: number
          vardiya: Database["public"]["Enums"]["shift_type"]
        }
        Update: {
          baslangic?: string | null
          bitis?: string | null
          category_id?: string
          created_at?: string
          id?: string
          machine_id?: string
          notlar?: string | null
          operator_id?: string
          sure_dakika?: number
          vardiya?: Database["public"]["Enums"]["shift_type"]
        }
        Relationships: [
          {
            foreignKeyName: "downtime_logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "downtime_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downtime_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          ad: string
          aktif: boolean
          created_at: string
          id: string
          kod: string
        }
        Insert: {
          ad: string
          aktif?: boolean
          created_at?: string
          id?: string
          kod: string
        }
        Update: {
          ad?: string
          aktif?: boolean
          created_at?: string
          id?: string
          kod?: string
        }
        Relationships: []
      }
      plasma_cuts: {
        Row: {
          baslangic: string
          bitis: string
          created_at: string
          genislik_mm: number
          id: string
          kalinlik_mm: number
          levha_adedi: number
          levha_agirlik_kg: number | null
          machine_id: string
          notlar: string | null
          operator_id: string
          sac_tipi: string | null
          sure_dakika: number | null
          toplam_agirlik_kg: number | null
          updated_at: string
          uzunluk_mm: number
          vardiya: Database["public"]["Enums"]["shift_type"]
          yogunluk: number
        }
        Insert: {
          baslangic: string
          bitis: string
          created_at?: string
          genislik_mm: number
          id?: string
          kalinlik_mm: number
          levha_adedi?: number
          levha_agirlik_kg?: number | null
          machine_id: string
          notlar?: string | null
          operator_id: string
          sac_tipi?: string | null
          sure_dakika?: number | null
          toplam_agirlik_kg?: number | null
          updated_at?: string
          uzunluk_mm: number
          vardiya: Database["public"]["Enums"]["shift_type"]
          yogunluk?: number
        }
        Update: {
          baslangic?: string
          bitis?: string
          created_at?: string
          genislik_mm?: number
          id?: string
          kalinlik_mm?: number
          levha_adedi?: number
          levha_agirlik_kg?: number | null
          machine_id?: string
          notlar?: string | null
          operator_id?: string
          sac_tipi?: string | null
          sure_dakika?: number | null
          toplam_agirlik_kg?: number | null
          updated_at?: string
          uzunluk_mm?: number
          vardiya?: Database["public"]["Enums"]["shift_type"]
          yogunluk?: number
        }
        Relationships: [
          {
            foreignKeyName: "plasma_cuts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      product_operations: {
        Row: {
          ad: string
          created_at: string
          id: string
          product_id: string
          sira: number
        }
        Insert: {
          ad: string
          created_at?: string
          id?: string
          product_id: string
          sira: number
        }
        Update: {
          ad?: string
          created_at?: string
          id?: string
          product_id?: string
          sira?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_operations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          miktar: number
          operation_id: string
          operator_id: string
          product_id: string
          vardiya: Database["public"]["Enums"]["shift_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          miktar: number
          operation_id: string
          operator_id: string
          product_id: string
          vardiya: Database["public"]["Enums"]["shift_type"]
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          miktar?: number
          operation_id?: string
          operator_id?: string
          product_id?: string
          vardiya?: Database["public"]["Enums"]["shift_type"]
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_logs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "product_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_sessions: {
        Row: {
          baslangic: string
          bitis: string | null
          created_at: string
          durum: string
          durus_sayisi: number
          genislik_mm: number | null
          hurda: number
          id: string
          kalinlik_mm: number | null
          levha_adedi: number | null
          machine_id: string
          miktar: number | null
          notlar: string | null
          operation_id: string | null
          operator_id: string
          product_id: string | null
          sac_tipi: string | null
          stok_dusuldu: boolean
          stok_id: string | null
          sure_dakika: number | null
          toplam_agirlik_kg: number | null
          toplam_durus_dakika: number
          updated_at: string
          uzunluk_mm: number | null
          vardiya: Database["public"]["Enums"]["shift_type"]
          yogunluk: number | null
        }
        Insert: {
          baslangic?: string
          bitis?: string | null
          created_at?: string
          durum?: string
          durus_sayisi?: number
          genislik_mm?: number | null
          hurda?: number
          id?: string
          kalinlik_mm?: number | null
          levha_adedi?: number | null
          machine_id: string
          miktar?: number | null
          notlar?: string | null
          operation_id?: string | null
          operator_id: string
          product_id?: string | null
          sac_tipi?: string | null
          stok_dusuldu?: boolean
          stok_id?: string | null
          sure_dakika?: number | null
          toplam_agirlik_kg?: number | null
          toplam_durus_dakika?: number
          updated_at?: string
          uzunluk_mm?: number | null
          vardiya: Database["public"]["Enums"]["shift_type"]
          yogunluk?: number | null
        }
        Update: {
          baslangic?: string
          bitis?: string | null
          created_at?: string
          durum?: string
          durus_sayisi?: number
          genislik_mm?: number | null
          hurda?: number
          id?: string
          kalinlik_mm?: number | null
          levha_adedi?: number | null
          machine_id?: string
          miktar?: number | null
          notlar?: string | null
          operation_id?: string | null
          operator_id?: string
          product_id?: string | null
          sac_tipi?: string | null
          stok_dusuldu?: boolean
          stok_id?: string | null
          sure_dakika?: number | null
          toplam_agirlik_kg?: number | null
          toplam_durus_dakika?: number
          updated_at?: string
          uzunluk_mm?: number | null
          vardiya?: Database["public"]["Enums"]["shift_type"]
          yogunluk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_sessions_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "product_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_sessions_stok_id_fkey"
            columns: ["stok_id"]
            isOneToOne: false
            referencedRelation: "sheet_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ad: string
          created_at: string
          id: string
          ideal_cevrim_saniye: number | null
          kod: string
        }
        Insert: {
          ad: string
          created_at?: string
          id?: string
          ideal_cevrim_saniye?: number | null
          kod: string
        }
        Update: {
          ad?: string
          created_at?: string
          id?: string
          ideal_cevrim_saniye?: number | null
          kod?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ad_soyad: string
          created_at: string
          departman: string | null
          id: string
          personel_id: string
          unvan: string | null
        }
        Insert: {
          ad_soyad: string
          created_at?: string
          departman?: string | null
          id: string
          personel_id: string
          unvan?: string | null
        }
        Update: {
          ad_soyad?: string
          created_at?: string
          departman?: string | null
          id?: string
          personel_id?: string
          unvan?: string | null
        }
        Relationships: []
      }
      quality_logs: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          notlar: string | null
          operator_id: string
          product_id: string
          red_miktari: number
          vardiya: Database["public"]["Enums"]["shift_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          notlar?: string | null
          operator_id: string
          product_id: string
          red_miktari: number
          vardiya: Database["public"]["Enums"]["shift_type"]
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          notlar?: string | null
          operator_id?: string
          product_id?: string
          red_miktari?: number
          vardiya?: Database["public"]["Enums"]["shift_type"]
        }
        Relationships: [
          {
            foreignKeyName: "quality_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      session_pauses: {
        Row: {
          baslangic: string
          bitis: string | null
          created_at: string
          id: string
          neden: string
          notlar: string | null
          operator_id: string
          session_id: string
          sure_dakika: number | null
          updated_at: string
        }
        Insert: {
          baslangic?: string
          bitis?: string | null
          created_at?: string
          id?: string
          neden: string
          notlar?: string | null
          operator_id: string
          session_id: string
          sure_dakika?: number | null
          updated_at?: string
        }
        Update: {
          baslangic?: string
          bitis?: string | null
          created_at?: string
          id?: string
          neden?: string
          notlar?: string | null
          operator_id?: string
          session_id?: string
          sure_dakika?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_pauses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "production_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_stock: {
        Row: {
          adet: number
          created_at: string
          genislik_mm: number
          id: string
          kalinlik_mm: number
          kritik_adet: number
          notlar: string | null
          sac_tipi: string
          updated_at: string
          uzunluk_mm: number
          yogunluk: number
        }
        Insert: {
          adet?: number
          created_at?: string
          genislik_mm: number
          id?: string
          kalinlik_mm: number
          kritik_adet?: number
          notlar?: string | null
          sac_tipi: string
          updated_at?: string
          uzunluk_mm: number
          yogunluk?: number
        }
        Update: {
          adet?: number
          created_at?: string
          genislik_mm?: number
          id?: string
          kalinlik_mm?: number
          kritik_adet?: number
          notlar?: string | null
          sac_tipi?: string
          updated_at?: string
          uzunluk_mm?: number
          yogunluk?: number
        }
        Relationships: []
      }
      sheet_stock_moves: {
        Row: {
          created_at: string
          degisim: number
          id: string
          notlar: string | null
          session_id: string | null
          stock_id: string | null
          tip: string
        }
        Insert: {
          created_at?: string
          degisim: number
          id?: string
          notlar?: string | null
          session_id?: string | null
          stock_id?: string | null
          tip: string
        }
        Update: {
          created_at?: string
          degisim?: number
          id?: string
          notlar?: string | null
          session_id?: string | null
          stock_id?: string | null
          tip?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_stock_moves_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "sheet_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_machines: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_settings: {
        Row: {
          durus_url: string | null
          id: number
          kalite_url: string | null
          updated_at: string
          uretim_url: string | null
        }
        Insert: {
          durus_url?: string | null
          id?: number
          kalite_url?: string | null
          updated_at?: string
          uretim_url?: string | null
        }
        Update: {
          durus_url?: string | null
          id?: number
          kalite_url?: string | null
          updated_at?: string
          uretim_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "operator" | "supervisor"
      shift_type: "Sabah" | "Akşam" | "Gece"
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
      app_role: ["operator", "supervisor"],
      shift_type: ["Sabah", "Akşam", "Gece"],
    },
  },
} as const
