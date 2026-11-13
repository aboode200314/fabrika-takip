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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          aciklama: string | null
          actor_ad: string | null
          actor_id: string | null
          created_at: string
          degisen_alanlar: string[] | null
          eski_veri: Json | null
          id: string
          islem: string
          kayit_id: string | null
          tablo: string
          yeni_veri: Json | null
        }
        Insert: {
          aciklama?: string | null
          actor_ad?: string | null
          actor_id?: string | null
          created_at?: string
          degisen_alanlar?: string[] | null
          eski_veri?: Json | null
          id?: string
          islem: string
          kayit_id?: string | null
          tablo: string
          yeni_veri?: Json | null
        }
        Update: {
          aciklama?: string | null
          actor_ad?: string | null
          actor_id?: string | null
          created_at?: string
          degisen_alanlar?: string[] | null
          eski_veri?: Json | null
          id?: string
          islem?: string
          kayit_id?: string | null
          tablo?: string
          yeni_veri?: Json | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          ad: string
          aktif: boolean
          created_at: string
          id: string
          kod: string
          updated_at: string
        }
        Insert: {
          ad: string
          aktif?: boolean
          created_at?: string
          id?: string
          kod: string
          updated_at?: string
        }
        Update: {
          ad?: string
          aktif?: boolean
          created_at?: string
          id?: string
          kod?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          operation_id: string | null
          operator_id: string
          order_id: string | null
          session_id: string | null
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
          operation_id?: string | null
          operator_id: string
          order_id?: string | null
          session_id?: string | null
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
          operation_id?: string | null
          operator_id?: string
          order_id?: string | null
          session_id?: string | null
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
          {
            foreignKeyName: "downtime_logs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "product_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downtime_logs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_order_operation_progress"
            referencedColumns: ["operation_id"]
          },
          {
            foreignKeyName: "downtime_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downtime_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_operation_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "downtime_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "downtime_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "production_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          ad: string
          aktif: boolean
          created_at: string
          department_id: string | null
          id: string
          kod: string
          notlar: string | null
          tip: string | null
        }
        Insert: {
          ad: string
          aktif?: boolean
          created_at?: string
          department_id?: string | null
          id?: string
          kod: string
          notlar?: string | null
          tip?: string | null
        }
        Update: {
          ad?: string
          aktif?: boolean
          created_at?: string
          department_id?: string | null
          id?: string
          kod?: string
          notlar?: string | null
          tip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_machines: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          operation_id: string
          varsayilan: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          operation_id: string
          varsayilan?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          operation_id?: string
          varsayilan?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "operation_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_machines_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "product_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_machines_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_order_operation_progress"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      permission_aliases: {
        Row: {
          alias: string
          canonical: string
          created_at: string
        }
        Insert: {
          alias: string
          canonical: string
          created_at?: string
        }
        Update: {
          alias?: string
          canonical?: string
          created_at?: string
        }
        Relationships: []
      }
      permission_catalog: {
        Row: {
          action: string
          created_at: string
          islem_ad: string | null
          key: string
          modul_ad: string | null
          module: string
          sira: number
          sistem: boolean
        }
        Insert: {
          action: string
          created_at?: string
          islem_ad?: string | null
          key: string
          modul_ad?: string | null
          module: string
          sira?: number
          sistem?: boolean
        }
        Update: {
          action?: string
          created_at?: string
          islem_ad?: string | null
          key?: string
          modul_ad?: string | null
          module?: string
          sira?: number
          sistem?: boolean
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
          aciklama: string | null
          ad: string
          created_at: string
          gereken_yetkinlik: string | null
          hazirlik_dakika: number
          hedef_adet: number | null
          id: string
          kalite_kontrol: boolean
          kod: string | null
          machine_id: string | null
          product_id: string
          sira: number
          tahmini_sure_saniye: number | null
        }
        Insert: {
          aciklama?: string | null
          ad: string
          created_at?: string
          gereken_yetkinlik?: string | null
          hazirlik_dakika?: number
          hedef_adet?: number | null
          id?: string
          kalite_kontrol?: boolean
          kod?: string | null
          machine_id?: string | null
          product_id: string
          sira: number
          tahmini_sure_saniye?: number | null
        }
        Update: {
          aciklama?: string | null
          ad?: string
          created_at?: string
          gereken_yetkinlik?: string | null
          hazirlik_dakika?: number
          hedef_adet?: number | null
          id?: string
          kalite_kontrol?: boolean
          kod?: string | null
          machine_id?: string | null
          product_id?: string
          sira?: number
          tahmini_sure_saniye?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_operations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "production_logs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_order_operation_progress"
            referencedColumns: ["operation_id"]
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
      production_orders: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          durum: string
          hedef_adet: number
          id: string
          kod: string
          notlar: string | null
          oncelik: number
          product_id: string | null
          teslim_tarihi: string | null
          updated_at: string
          urun_ad_snapshot: string | null
          urun_kod_snapshot: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          durum?: string
          hedef_adet?: number
          id?: string
          kod: string
          notlar?: string | null
          oncelik?: number
          product_id?: string | null
          teslim_tarihi?: string | null
          updated_at?: string
          urun_ad_snapshot?: string | null
          urun_kod_snapshot?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          durum?: string
          hedef_adet?: number
          id?: string
          kod?: string
          notlar?: string | null
          oncelik?: number
          product_id?: string | null
          teslim_tarihi?: string | null
          updated_at?: string
          urun_ad_snapshot?: string | null
          urun_kod_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_sessions: {
        Row: {
          asama_ad_snapshot: string | null
          asama_sira_snapshot: number | null
          baslangic: string
          bitis: string | null
          created_at: string
          durum: string
          durus_sayisi: number
          emir_kod_snapshot: string | null
          genislik_mm: number | null
          hurda: number
          id: string
          kalinlik_mm: number | null
          levha_adedi: number | null
          machine_id: string
          makine_ad_snapshot: string | null
          makine_kod_snapshot: string | null
          malzeme_snapshot: Json | null
          miktar: number | null
          notlar: string | null
          operation_id: string | null
          operator_id: string
          order_id: string | null
          product_id: string | null
          sac_tipi: string | null
          stok_dusuldu: boolean
          stok_id: string | null
          sure_dakika: number | null
          toplam_agirlik_kg: number | null
          toplam_durus_dakika: number
          updated_at: string
          urun_ad_snapshot: string | null
          urun_kod_snapshot: string | null
          uzunluk_mm: number | null
          vardiya: Database["public"]["Enums"]["shift_type"]
          yogunluk: number | null
        }
        Insert: {
          asama_ad_snapshot?: string | null
          asama_sira_snapshot?: number | null
          baslangic?: string
          bitis?: string | null
          created_at?: string
          durum?: string
          durus_sayisi?: number
          emir_kod_snapshot?: string | null
          genislik_mm?: number | null
          hurda?: number
          id?: string
          kalinlik_mm?: number | null
          levha_adedi?: number | null
          machine_id: string
          makine_ad_snapshot?: string | null
          makine_kod_snapshot?: string | null
          malzeme_snapshot?: Json | null
          miktar?: number | null
          notlar?: string | null
          operation_id?: string | null
          operator_id: string
          order_id?: string | null
          product_id?: string | null
          sac_tipi?: string | null
          stok_dusuldu?: boolean
          stok_id?: string | null
          sure_dakika?: number | null
          toplam_agirlik_kg?: number | null
          toplam_durus_dakika?: number
          updated_at?: string
          urun_ad_snapshot?: string | null
          urun_kod_snapshot?: string | null
          uzunluk_mm?: number | null
          vardiya: Database["public"]["Enums"]["shift_type"]
          yogunluk?: number | null
        }
        Update: {
          asama_ad_snapshot?: string | null
          asama_sira_snapshot?: number | null
          baslangic?: string
          bitis?: string | null
          created_at?: string
          durum?: string
          durus_sayisi?: number
          emir_kod_snapshot?: string | null
          genislik_mm?: number | null
          hurda?: number
          id?: string
          kalinlik_mm?: number | null
          levha_adedi?: number | null
          machine_id?: string
          makine_ad_snapshot?: string | null
          makine_kod_snapshot?: string | null
          malzeme_snapshot?: Json | null
          miktar?: number | null
          notlar?: string | null
          operation_id?: string | null
          operator_id?: string
          order_id?: string | null
          product_id?: string | null
          sac_tipi?: string | null
          stok_dusuldu?: boolean
          stok_id?: string | null
          sure_dakika?: number | null
          toplam_agirlik_kg?: number | null
          toplam_durus_dakika?: number
          updated_at?: string
          urun_ad_snapshot?: string | null
          urun_kod_snapshot?: string | null
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
            foreignKeyName: "production_sessions_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_order_operation_progress"
            referencedColumns: ["operation_id"]
          },
          {
            foreignKeyName: "production_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_operation_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "production_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
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
          aciklama: string | null
          ad: string
          birim_agirlik_kg: number | null
          created_at: string
          department_id: string | null
          id: string
          ideal_cevrim_saniye: number | null
          kod: string
          olcu: string | null
          silindi_at: string | null
          updated_at: string
        }
        Insert: {
          aciklama?: string | null
          ad: string
          birim_agirlik_kg?: number | null
          created_at?: string
          department_id?: string | null
          id?: string
          ideal_cevrim_saniye?: number | null
          kod: string
          olcu?: string | null
          silindi_at?: string | null
          updated_at?: string
        }
        Update: {
          aciklama?: string | null
          ad?: string
          birim_agirlik_kg?: number | null
          created_at?: string
          department_id?: string | null
          id?: string
          ideal_cevrim_saniye?: number | null
          kod?: string
          olcu?: string | null
          silindi_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ad_soyad: string
          aktif: boolean
          created_at: string
          departman: string | null
          department_id: string | null
          dil: string
          id: string
          personel_id: string
          unvan: string | null
          veri_kapsam: string
        }
        Insert: {
          ad_soyad: string
          aktif?: boolean
          created_at?: string
          departman?: string | null
          department_id?: string | null
          dil?: string
          id: string
          personel_id: string
          unvan?: string | null
          veri_kapsam?: string
        }
        Update: {
          ad_soyad?: string
          aktif?: boolean
          created_at?: string
          departman?: string | null
          department_id?: string | null
          dil?: string
          id?: string
          personel_id?: string
          unvan?: string | null
          veri_kapsam?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_logs: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          notlar: string | null
          operation_id: string | null
          operator_id: string
          order_id: string | null
          product_id: string
          red_miktari: number
          session_id: string | null
          vardiya: Database["public"]["Enums"]["shift_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          notlar?: string | null
          operation_id?: string | null
          operator_id: string
          order_id?: string | null
          product_id: string
          red_miktari: number
          session_id?: string | null
          vardiya: Database["public"]["Enums"]["shift_type"]
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          notlar?: string | null
          operation_id?: string | null
          operator_id?: string
          order_id?: string | null
          product_id?: string
          red_miktari?: number
          session_id?: string | null
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
            foreignKeyName: "quality_logs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "product_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_logs_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "v_order_operation_progress"
            referencedColumns: ["operation_id"]
          },
          {
            foreignKeyName: "quality_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_operation_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "quality_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_progress"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "quality_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "production_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role_key: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          aciklama: string | null
          ad: string
          created_at: string
          key: string
          sira: number
          sistem: boolean
        }
        Insert: {
          aciklama?: string | null
          ad: string
          created_at?: string
          key: string
          sira?: number
          sistem?: boolean
        }
        Update: {
          aciklama?: string | null
          ad?: string
          created_at?: string
          key?: string
          sira?: number
          sistem?: boolean
        }
        Relationships: []
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
          dis_cap_mm: number | null
          genislik_mm: number
          ic_cap_mm: number | null
          id: string
          kalinlik_mm: number
          kritik_adet: number
          malzeme_turu: string
          notlar: string | null
          sac_tipi: string
          updated_at: string
          uzunluk_mm: number
          yogunluk: number
          yukseklik_mm: number | null
        }
        Insert: {
          adet?: number
          created_at?: string
          dis_cap_mm?: number | null
          genislik_mm: number
          ic_cap_mm?: number | null
          id?: string
          kalinlik_mm: number
          kritik_adet?: number
          malzeme_turu?: string
          notlar?: string | null
          sac_tipi: string
          updated_at?: string
          uzunluk_mm: number
          yogunluk?: number
          yukseklik_mm?: number | null
        }
        Update: {
          adet?: number
          created_at?: string
          dis_cap_mm?: number | null
          genislik_mm?: number
          ic_cap_mm?: number | null
          id?: string
          kalinlik_mm?: number
          kritik_adet?: number
          malzeme_turu?: string
          notlar?: string | null
          sac_tipi?: string
          updated_at?: string
          uzunluk_mm?: number
          yogunluk?: number
          yukseklik_mm?: number | null
        }
        Relationships: []
      }
      sheet_stock_moves: {
        Row: {
          bakiye_sonrasi: number | null
          birim: string
          created_at: string
          degisim: number
          genislik_mm_snapshot: number | null
          id: string
          kalinlik_mm_snapshot: number | null
          malzeme_snapshot: Json | null
          notlar: string | null
          sac_tipi_snapshot: string | null
          sebep: string | null
          session_id: string | null
          stock_id: string | null
          stok_uygulandi: boolean
          ters_kayit_id: string | null
          tip: string
          user_ad: string | null
          user_id: string | null
          uzunluk_mm_snapshot: number | null
          yon: string | null
        }
        Insert: {
          bakiye_sonrasi?: number | null
          birim?: string
          created_at?: string
          degisim: number
          genislik_mm_snapshot?: number | null
          id?: string
          kalinlik_mm_snapshot?: number | null
          malzeme_snapshot?: Json | null
          notlar?: string | null
          sac_tipi_snapshot?: string | null
          sebep?: string | null
          session_id?: string | null
          stock_id?: string | null
          stok_uygulandi?: boolean
          ters_kayit_id?: string | null
          tip: string
          user_ad?: string | null
          user_id?: string | null
          uzunluk_mm_snapshot?: number | null
          yon?: string | null
        }
        Update: {
          bakiye_sonrasi?: number | null
          birim?: string
          created_at?: string
          degisim?: number
          genislik_mm_snapshot?: number | null
          id?: string
          kalinlik_mm_snapshot?: number | null
          malzeme_snapshot?: Json | null
          notlar?: string | null
          sac_tipi_snapshot?: string | null
          sebep?: string | null
          session_id?: string | null
          stock_id?: string | null
          stok_uygulandi?: boolean
          ters_kayit_id?: string | null
          tip?: string
          user_ad?: string | null
          user_id?: string | null
          uzunluk_mm_snapshot?: number | null
          yon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sheet_stock_moves_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "sheet_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_stock_moves_ters_kayit_id_fkey"
            columns: ["ters_kayit_id"]
            isOneToOne: false
            referencedRelation: "sheet_stock_moves"
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
      user_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
      user_role_assignments: {
        Row: {
          created_at: string
          id: string
          role_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
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
      work_breaks: {
        Row: {
          ad: string
          baslangic: string
          bitis: string
          created_at: string
          id: string
          schedule_id: string | null
          updated_at: string
        }
        Insert: {
          ad: string
          baslangic: string
          bitis: string
          created_at?: string
          id?: string
          schedule_id?: string | null
          updated_at?: string
        }
        Update: {
          ad?: string
          baslangic?: string
          bitis?: string
          created_at?: string
          id?: string
          schedule_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_breaks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          baslangic: string | null
          bitis: string | null
          created_at: string
          gun: number
          id: string
          tatil: boolean
          updated_at: string
        }
        Insert: {
          baslangic?: string | null
          bitis?: string | null
          created_at?: string
          gun: number
          id?: string
          tatil?: boolean
          updated_at?: string
        }
        Update: {
          baslangic?: string | null
          bitis?: string | null
          created_at?: string
          gun?: number
          id?: string
          tatil?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_order_operation_progress: {
        Row: {
          fire: number | null
          hedef_adet: number | null
          operation_ad: string | null
          operation_id: string | null
          order_id: string | null
          order_kod: string | null
          product_id: string | null
          sira: number | null
          uretilen: number | null
          yuzde: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_progress: {
        Row: {
          adim_sayisi: number | null
          hedef_adet: number | null
          order_id: string | null
          order_kod: string | null
          product_id: string | null
          toplam_fire: number | null
          toplam_uretilen: number | null
          yuzde: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_app_role: {
        Args: { _role_key: string; _user_id: string }
        Returns: boolean
      }
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
      live_pauses: {
        Args: never
        Returns: {
          baslangic: string
          bitis: string
          id: string
          neden: string
          session_id: string
          sure_dakika: number
        }[]
      }
      live_sessions: {
        Args: never
        Returns: {
          baslangic: string
          durum: string
          genislik_mm: number
          id: string
          kalinlik_mm: number
          levha_adedi: number
          machine_id: string
          operator_ad: string
          operator_id: string
          product_id: string
          sac_tipi: string
          uzunluk_mm: number
          vardiya: Database["public"]["Enums"]["shift_type"]
          yogunluk: number
        }[]
      }
      machine_in_my_scope: { Args: { _machine_id: string }; Returns: boolean }
      my_department_ids: {
        Args: never
        Returns: {
          department_id: string
        }[]
      }
      my_permissions: {
        Args: never
        Returns: {
          permission: string
        }[]
      }
      my_scope: { Args: never; Returns: string }
      net_work_minutes: { Args: { _gun: number }; Returns: number }
      permission_equivalents: {
        Args: { _perm: string }
        Returns: {
          permission: string
        }[]
      }
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
      app_role: ["operator", "supervisor"],
      shift_type: ["Sabah", "Akşam", "Gece"],
    },
  },
} as const
