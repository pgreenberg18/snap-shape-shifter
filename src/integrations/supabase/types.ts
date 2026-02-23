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
      ai_generation_templates: {
        Row: {
          camera_language: string | null
          created_at: string
          id: string
          image_prompt_base: string | null
          shot_id: string
          updated_at: string
          video_prompt_base: string | null
        }
        Insert: {
          camera_language?: string | null
          created_at?: string
          id?: string
          image_prompt_base?: string | null
          shot_id: string
          updated_at?: string
          video_prompt_base?: string | null
        }
        Update: {
          camera_language?: string | null
          created_at?: string
          id?: string
          image_prompt_base?: string | null
          shot_id?: string
          updated_at?: string
          video_prompt_base?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_templates_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "shots"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_identity_registry: {
        Row: {
          asset_type: string
          created_at: string
          description: string | null
          display_name: string
          film_id: string
          id: string
          internal_ref_code: string
          is_dirty: boolean
          reference_image_url: string | null
          updated_at: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          description?: string | null
          display_name: string
          film_id: string
          id?: string
          internal_ref_code: string
          is_dirty?: boolean
          reference_image_url?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          description?: string | null
          display_name?: string
          film_id?: string
          id?: string
          internal_ref_code?: string
          is_dirty?: boolean
          reference_image_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_identity_registry_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          age_max: number | null
          age_min: number | null
          approved: boolean
          created_at: string
          description: string | null
          film_id: string
          id: string
          image_url: string | null
          is_child: boolean | null
          name: string
          reference_image_url: string | null
          sex: string | null
          voice_description: string | null
          voice_generation_seed: number | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          approved?: boolean
          created_at?: string
          description?: string | null
          film_id: string
          id?: string
          image_url?: string | null
          is_child?: boolean | null
          name: string
          reference_image_url?: string | null
          sex?: string | null
          voice_description?: string | null
          voice_generation_seed?: number | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          approved?: boolean
          created_at?: string
          description?: string | null
          film_id?: string
          id?: string
          image_url?: string | null
          is_child?: boolean | null
          name?: string
          reference_image_url?: string | null
          sex?: string | null
          voice_description?: string | null
          voice_generation_seed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      content_safety: {
        Row: {
          film_id: string
          id: string
          language: boolean
          mode: string
          nudity: boolean
          updated_at: string
          violence: boolean
        }
        Insert: {
          film_id: string
          id?: string
          language?: boolean
          mode?: string
          nudity?: boolean
          updated_at?: string
          violence?: boolean
        }
        Update: {
          film_id?: string
          id?: string
          language?: boolean
          mode?: string
          nudity?: boolean
          updated_at?: string
          violence?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "content_safety_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      films: {
        Row: {
          copied_from_version_id: string | null
          created_at: string
          credits: number
          id: string
          project_id: string | null
          script_locked: boolean
          time_period: string | null
          title: string
          updated_at: string
          version_name: string | null
          version_number: number
          writers: string | null
        }
        Insert: {
          copied_from_version_id?: string | null
          created_at?: string
          credits?: number
          id?: string
          project_id?: string | null
          script_locked?: boolean
          time_period?: string | null
          title: string
          updated_at?: string
          version_name?: string | null
          version_number?: number
          writers?: string | null
        }
        Update: {
          copied_from_version_id?: string | null
          created_at?: string
          credits?: number
          id?: string
          project_id?: string | null
          script_locked?: boolean
          time_period?: string | null
          title?: string
          updated_at?: string
          version_name?: string | null
          version_number?: number
          writers?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "films_copied_from_version_id_fkey"
            columns: ["copied_from_version_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "films_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          api_key_encrypted: string | null
          created_at: string
          id: string
          is_verified: boolean
          provider_name: string
          section_id: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          provider_name: string
          section_id: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          provider_name?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_production_clips: {
        Row: {
          color: string | null
          created_at: string
          film_id: string
          id: string
          label: string
          left_pos: number
          track: string
          width: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          film_id: string
          id?: string
          label: string
          left_pos?: number
          track: string
          width?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          film_id?: string
          id?: string
          label?: string
          left_pos?: number
          track?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_production_clips_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          poster_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          poster_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          poster_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      script_analyses: {
        Row: {
          ai_generation_notes: Json | null
          created_at: string
          error_message: string | null
          file_name: string
          film_id: string
          global_elements: Json | null
          id: string
          scene_approvals: Json | null
          scene_breakdown: Json | null
          scene_rejections: Json | null
          status: string
          storage_path: string
          updated_at: string
          visual_summary: string | null
        }
        Insert: {
          ai_generation_notes?: Json | null
          created_at?: string
          error_message?: string | null
          file_name: string
          film_id: string
          global_elements?: Json | null
          id?: string
          scene_approvals?: Json | null
          scene_breakdown?: Json | null
          scene_rejections?: Json | null
          status?: string
          storage_path: string
          updated_at?: string
          visual_summary?: string | null
        }
        Update: {
          ai_generation_notes?: Json | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          film_id?: string
          global_elements?: Json | null
          id?: string
          scene_approvals?: Json | null
          scene_breakdown?: Json | null
          scene_rejections?: Json | null
          status?: string
          storage_path?: string
          updated_at?: string
          visual_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "script_analyses_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      shots: {
        Row: {
          camera_angle: string | null
          created_at: string
          film_id: string
          id: string
          prompt_text: string | null
          scene_number: number
          video_url: string | null
        }
        Insert: {
          camera_angle?: string | null
          created_at?: string
          film_id: string
          id?: string
          prompt_text?: string | null
          scene_number: number
          video_url?: string | null
        }
        Update: {
          camera_angle?: string | null
          created_at?: string
          film_id?: string
          id?: string
          prompt_text?: string | null
          scene_number?: number
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shots_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
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
