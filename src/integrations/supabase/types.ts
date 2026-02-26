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
      activity_logs: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          page_path: string | null
          region: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          page_path?: string | null
          region?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          page_path?: string | null
          region?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
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
      character_auditions: {
        Row: {
          card_index: number
          character_id: string
          created_at: string
          id: string
          image_url: string | null
          label: string
          locked: boolean
          rating: number | null
          section: string
        }
        Insert: {
          card_index: number
          character_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          label: string
          locked?: boolean
          rating?: number | null
          section: string
        }
        Update: {
          card_index?: number
          character_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          label?: string
          locked?: boolean
          rating?: number | null
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_auditions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_consistency_views: {
        Row: {
          angle_index: number
          angle_label: string
          character_id: string
          created_at: string
          id: string
          image_url: string | null
          status: string
        }
        Insert: {
          angle_index: number
          angle_label: string
          character_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          status?: string
        }
        Update: {
          angle_index?: number
          angle_label?: string
          character_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_consistency_views_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
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
      credit_usage_logs: {
        Row: {
          created_at: string
          credits_used: number
          film_id: string | null
          id: string
          metadata: Json | null
          operation: string
          service_category: string
          service_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          film_id?: string | null
          id?: string
          metadata?: Json | null
          operation: string
          service_category: string
          service_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          film_id?: string | null
          id?: string
          metadata?: Json | null
          operation?: string
          service_category?: string
          service_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_usage_logs_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_usage_settings: {
        Row: {
          created_at: string
          cutoff_threshold: number | null
          id: string
          updated_at: string
          user_id: string
          warning_period: string
          warning_threshold: number | null
        }
        Insert: {
          created_at?: string
          cutoff_threshold?: number | null
          id?: string
          updated_at?: string
          user_id: string
          warning_period?: string
          warning_threshold?: number | null
        }
        Update: {
          created_at?: string
          cutoff_threshold?: number | null
          id?: string
          updated_at?: string
          user_id?: string
          warning_period?: string
          warning_threshold?: number | null
        }
        Relationships: []
      }
      film_assets: {
        Row: {
          asset_name: string
          asset_type: string
          character_id: string | null
          created_at: string
          description: string | null
          film_id: string
          id: string
          image_url: string | null
          locked: boolean
          option_index: number
        }
        Insert: {
          asset_name: string
          asset_type: string
          character_id?: string | null
          created_at?: string
          description?: string | null
          film_id: string
          id?: string
          image_url?: string | null
          locked?: boolean
          option_index: number
        }
        Update: {
          asset_name?: string
          asset_type?: string
          character_id?: string | null
          created_at?: string
          description?: string | null
          film_id?: string
          id?: string
          image_url?: string | null
          locked?: boolean
          option_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "film_assets_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_assets_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      film_director_profiles: {
        Row: {
          auto_matched: boolean | null
          blend_weight: number | null
          cluster: string | null
          computed_vector: Json
          created_at: string
          emotional_depth: string | null
          film_id: string
          id: string
          match_distance: number | null
          primary_director_id: string
          primary_director_name: string
          quadrant: string | null
          secondary_director_id: string | null
          secondary_director_name: string | null
          updated_at: string
          visual_mandate: Json | null
        }
        Insert: {
          auto_matched?: boolean | null
          blend_weight?: number | null
          cluster?: string | null
          computed_vector?: Json
          created_at?: string
          emotional_depth?: string | null
          film_id: string
          id?: string
          match_distance?: number | null
          primary_director_id: string
          primary_director_name: string
          quadrant?: string | null
          secondary_director_id?: string | null
          secondary_director_name?: string | null
          updated_at?: string
          visual_mandate?: Json | null
        }
        Update: {
          auto_matched?: boolean | null
          blend_weight?: number | null
          cluster?: string | null
          computed_vector?: Json
          created_at?: string
          emotional_depth?: string | null
          film_id?: string
          id?: string
          match_distance?: number | null
          primary_director_id?: string
          primary_director_name?: string
          quadrant?: string | null
          secondary_director_id?: string | null
          secondary_director_name?: string | null
          updated_at?: string
          visual_mandate?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "film_director_profiles_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: true
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      film_style_contracts: {
        Row: {
          character_directives: Json | null
          color_mandate: Json | null
          content_guardrails: Json | null
          created_at: string
          film_id: string
          genre_visual_profile: Json | null
          id: string
          lens_philosophy: Json | null
          lighting_doctrine: Json | null
          negative_prompt_base: string | null
          source_hash: string | null
          temporal_rules: Json | null
          texture_mandate: Json | null
          updated_at: string
          version: number
          visual_dna: string | null
          world_rules: string | null
        }
        Insert: {
          character_directives?: Json | null
          color_mandate?: Json | null
          content_guardrails?: Json | null
          created_at?: string
          film_id: string
          genre_visual_profile?: Json | null
          id?: string
          lens_philosophy?: Json | null
          lighting_doctrine?: Json | null
          negative_prompt_base?: string | null
          source_hash?: string | null
          temporal_rules?: Json | null
          texture_mandate?: Json | null
          updated_at?: string
          version?: number
          visual_dna?: string | null
          world_rules?: string | null
        }
        Update: {
          character_directives?: Json | null
          color_mandate?: Json | null
          content_guardrails?: Json | null
          created_at?: string
          film_id?: string
          genre_visual_profile?: Json | null
          id?: string
          lens_philosophy?: Json | null
          lighting_doctrine?: Json | null
          negative_prompt_base?: string | null
          source_hash?: string | null
          temporal_rules?: Json | null
          texture_mandate?: Json | null
          updated_at?: string
          version?: number
          visual_dna?: string | null
          world_rules?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "film_style_contracts_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: true
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
          format_type: string | null
          frame_height: number | null
          frame_rate: number | null
          frame_width: number | null
          genres: string[] | null
          id: string
          is_archived: boolean
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
          format_type?: string | null
          frame_height?: number | null
          frame_rate?: number | null
          frame_width?: number | null
          genres?: string[] | null
          id?: string
          is_archived?: boolean
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
          format_type?: string | null
          frame_height?: number | null
          frame_rate?: number | null
          frame_width?: number | null
          genres?: string[] | null
          id?: string
          is_archived?: boolean
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
      generations: {
        Row: {
          attempt_count: number
          compile_hash: string | null
          created_at: string
          engine: string
          film_id: string
          generation_plan_json: Json | null
          id: string
          last_error: string | null
          mode: string
          output_urls: string[] | null
          parent_generation_id: string | null
          prompt_pack_json: Json | null
          reference_bundle_json: Json | null
          scores_json: Json | null
          seed: number | null
          selected_output_index: number | null
          shot_id: string
          status: string
          style_contract_version: number | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          compile_hash?: string | null
          created_at?: string
          engine?: string
          film_id: string
          generation_plan_json?: Json | null
          id?: string
          last_error?: string | null
          mode?: string
          output_urls?: string[] | null
          parent_generation_id?: string | null
          prompt_pack_json?: Json | null
          reference_bundle_json?: Json | null
          scores_json?: Json | null
          seed?: number | null
          selected_output_index?: number | null
          shot_id: string
          status?: string
          style_contract_version?: number | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          compile_hash?: string | null
          created_at?: string
          engine?: string
          film_id?: string
          generation_plan_json?: Json | null
          id?: string
          last_error?: string | null
          mode?: string
          output_urls?: string[] | null
          parent_generation_id?: string | null
          prompt_pack_json?: Json | null
          reference_bundle_json?: Json | null
          scores_json?: Json | null
          seed?: number | null
          selected_output_index?: number | null
          shot_id?: string
          status?: string
          style_contract_version?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_parent_generation_id_fkey"
            columns: ["parent_generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "shots"
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
          user_id: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          provider_name: string
          section_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          provider_name?: string
          section_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      parse_jobs: {
        Row: {
          analysis_id: string | null
          created_at: string
          error_message: string | null
          film_id: string
          id: string
          scene_count: number | null
          scenes_enriched: number
          status: string
          updated_at: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          error_message?: string | null
          film_id: string
          id?: string
          scene_count?: number | null
          scenes_enriched?: number
          status?: string
          updated_at?: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          error_message?: string | null
          film_id?: string
          id?: string
          scene_count?: number | null
          scenes_enriched?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parse_jobs_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "script_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parse_jobs_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      parsed_scenes: {
        Row: {
          animals: string[] | null
          character_details: Json | null
          characters: string[] | null
          cinematic_elements: Json | null
          created_at: string
          day_night: string | null
          description: string | null
          enriched: boolean
          environment_details: string | null
          estimated_page_count: number | null
          extras: string | null
          film_id: string
          heading: string
          id: string
          int_ext: string | null
          key_objects: string[] | null
          location_name: string | null
          mood: string | null
          picture_vehicles: string[] | null
          raw_text: string
          scene_number: number
          sfx: string[] | null
          sound_cues: string[] | null
          special_makeup: string[] | null
          stunts: string[] | null
          vfx: string[] | null
          wardrobe: Json | null
        }
        Insert: {
          animals?: string[] | null
          character_details?: Json | null
          characters?: string[] | null
          cinematic_elements?: Json | null
          created_at?: string
          day_night?: string | null
          description?: string | null
          enriched?: boolean
          environment_details?: string | null
          estimated_page_count?: number | null
          extras?: string | null
          film_id: string
          heading: string
          id?: string
          int_ext?: string | null
          key_objects?: string[] | null
          location_name?: string | null
          mood?: string | null
          picture_vehicles?: string[] | null
          raw_text: string
          scene_number: number
          sfx?: string[] | null
          sound_cues?: string[] | null
          special_makeup?: string[] | null
          stunts?: string[] | null
          vfx?: string[] | null
          wardrobe?: Json | null
        }
        Update: {
          animals?: string[] | null
          character_details?: Json | null
          characters?: string[] | null
          cinematic_elements?: Json | null
          created_at?: string
          day_night?: string | null
          description?: string | null
          enriched?: boolean
          environment_details?: string | null
          estimated_page_count?: number | null
          extras?: string | null
          film_id?: string
          heading?: string
          id?: string
          int_ext?: string | null
          key_objects?: string[] | null
          location_name?: string | null
          mood?: string | null
          picture_vehicles?: string[] | null
          raw_text?: string
          scene_number?: number
          sfx?: string[] | null
          sound_cues?: string[] | null
          special_makeup?: string[] | null
          stunts?: string[] | null
          vfx?: string[] | null
          wardrobe?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "parsed_scenes_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
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
      production_presets: {
        Row: {
          category: string
          created_at: string
          film_id: string
          id: string
          name: string
          settings: Json
        }
        Insert: {
          category: string
          created_at?: string
          film_id: string
          id?: string
          name: string
          settings?: Json
        }
        Update: {
          category?: string
          created_at?: string
          film_id?: string
          id?: string
          name?: string
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "production_presets_film_id_fkey"
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          poster_url?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          poster_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      scene_style_overrides: {
        Row: {
          camera_feel: string | null
          color_shift: Json | null
          created_at: string
          custom_negative: string | null
          environment_texture: string | null
          film_id: string
          id: string
          lighting_override: string | null
          mood_override: string | null
          scene_number: number
          shot_suggestions: Json | null
          time_of_day_grade: string | null
        }
        Insert: {
          camera_feel?: string | null
          color_shift?: Json | null
          created_at?: string
          custom_negative?: string | null
          environment_texture?: string | null
          film_id: string
          id?: string
          lighting_override?: string | null
          mood_override?: string | null
          scene_number: number
          shot_suggestions?: Json | null
          time_of_day_grade?: string | null
        }
        Update: {
          camera_feel?: string | null
          color_shift?: Json | null
          created_at?: string
          custom_negative?: string | null
          environment_texture?: string | null
          film_id?: string
          id?: string
          lighting_override?: string | null
          mood_override?: string | null
          scene_number?: number
          shot_suggestions?: Json | null
          time_of_day_grade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scene_style_overrides_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      script_analyses: {
        Row: {
          ai_generation_notes: Json | null
          ai_notes_approved: boolean
          created_at: string
          error_message: string | null
          file_name: string
          film_id: string
          global_elements: Json | null
          id: string
          ratings_approved: boolean
          scene_approvals: Json | null
          scene_breakdown: Json | null
          scene_rejections: Json | null
          status: string
          storage_path: string
          updated_at: string
          visual_summary: string | null
          visual_summary_approved: boolean
        }
        Insert: {
          ai_generation_notes?: Json | null
          ai_notes_approved?: boolean
          created_at?: string
          error_message?: string | null
          file_name: string
          film_id: string
          global_elements?: Json | null
          id?: string
          ratings_approved?: boolean
          scene_approvals?: Json | null
          scene_breakdown?: Json | null
          scene_rejections?: Json | null
          status?: string
          storage_path: string
          updated_at?: string
          visual_summary?: string | null
          visual_summary_approved?: boolean
        }
        Update: {
          ai_generation_notes?: Json | null
          ai_notes_approved?: boolean
          created_at?: string
          error_message?: string | null
          file_name?: string
          film_id?: string
          global_elements?: Json | null
          id?: string
          ratings_approved?: boolean
          scene_approvals?: Json | null
          scene_breakdown?: Json | null
          scene_rejections?: Json | null
          status?: string
          storage_path?: string
          updated_at?: string
          visual_summary?: string | null
          visual_summary_approved?: boolean
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
          style_contract_version: number | null
          video_url: string | null
        }
        Insert: {
          camera_angle?: string | null
          created_at?: string
          film_id: string
          id?: string
          prompt_text?: string | null
          scene_number: number
          style_contract_version?: number | null
          video_url?: string | null
        }
        Update: {
          camera_angle?: string | null
          created_at?: string
          film_id?: string
          id?: string
          prompt_text?: string | null
          scene_number?: number
          style_contract_version?: number | null
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
      user_access_controls: {
        Row: {
          access_development: boolean
          access_post_production: boolean
          access_pre_production: boolean
          access_production: boolean
          access_release: boolean
          access_sample_projects: boolean
          allowed_project_ids: string[] | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_development?: boolean
          access_post_production?: boolean
          access_pre_production?: boolean
          access_production?: boolean
          access_release?: boolean
          access_sample_projects?: boolean
          allowed_project_ids?: string[] | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_development?: boolean
          access_post_production?: boolean
          access_pre_production?: boolean
          access_production?: boolean
          access_release?: boolean
          access_sample_projects?: boolean
          allowed_project_ids?: string[] | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          nda_signed: boolean
          nda_signed_at: string | null
          onboarding_complete: boolean
          phone: string | null
          signature_data: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          nda_signed?: boolean
          nda_signed_at?: string | null
          onboarding_complete?: boolean
          phone?: string | null
          signature_data?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          nda_signed?: boolean
          nda_signed_at?: string | null
          onboarding_complete?: boolean
          phone?: string | null
          signature_data?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      version_provider_selections: {
        Row: {
          created_at: string
          film_id: string
          id: string
          provider_service_id: string
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          film_id: string
          id?: string
          provider_service_id: string
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          film_id?: string
          id?: string
          provider_service_id?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "version_provider_selections_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      wardrobe_scene_assignments: {
        Row: {
          character_name: string
          clothing_item: string
          created_at: string
          film_id: string
          id: string
          scene_number: number
        }
        Insert: {
          character_name: string
          clothing_item: string
          created_at?: string
          film_id: string
          id?: string
          scene_number: number
        }
        Update: {
          character_name?: string
          clothing_item?: string
          created_at?: string
          film_id?: string
          id?: string
          scene_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "wardrobe_scene_assignments_film_id_fkey"
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
      increment_scenes_enriched: {
        Args: { p_analysis_id: string }
        Returns: undefined
      }
      log_credit_usage: {
        Args: {
          p_credits?: number
          p_film_id: string
          p_operation: string
          p_service_category: string
          p_service_name: string
          p_user_id: string
        }
        Returns: undefined
      }
      user_owns_film: { Args: { p_film_id: string }; Returns: boolean }
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
