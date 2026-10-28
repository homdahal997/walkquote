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
      analysis_usage: {
        Row: {
          attempt_id: string
          created_at: string
          day: string
          id: string
          stage: string
          visitor_hash: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          day?: string
          id?: string
          stage: string
          visitor_hash: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          day?: string
          id?: string
          stage?: string
          visitor_hash?: string
        }
        Relationships: []
      }
      room_estimate_media_chunks: {
        Row: {
          asset_id: string
          checksum_sha256: string
          created_at: string
          id: string
          part_count: number
          part_index: number
          payload_base64: string
          raw_byte_count: number
          upload_group_id: string
        }
        Insert: {
          asset_id: string
          checksum_sha256: string
          created_at?: string
          id?: string
          part_count: number
          part_index: number
          payload_base64: string
          raw_byte_count: number
          upload_group_id: string
        }
        Update: {
          asset_id?: string
          checksum_sha256?: string
          created_at?: string
          id?: string
          part_count?: number
          part_index?: number
          payload_base64?: string
          raw_byte_count?: number
          upload_group_id?: string
        }
        Relationships: []
      }
      room_estimates: {
        Row: {
          analysis_consent: boolean | null
          analysis_frame_data_base64: string[] | null
          audio_note_data_base64: string | null
          audio_note_mime_type: string | null
          budget_amount: number | null
          budget_label: string | null
          capture_mode: string | null
          ceiling_area_sqft: number | null
          ceiling_height_ft: number | null
          color_hex: string | null
          color_name: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_reference: string | null
          created_at: string
          door_sides: number | null
          estimate_assumptions: string[] | null
          estimate_mode: string | null
          gross_wall_area_sqft: number | null
          high_total: number | null
          id: string
          line_item_ranges: string[] | null
          low_total: number | null
          measurement_confidence: string | null
          measurement_source: string | null
          media_consent_at: string | null
          media_kind: string | null
          media_manifest: Json | null
          media_mime_type: string | null
          media_references: string[] | null
          media_share_consent: boolean | null
          media_storage_mode: string | null
          opening_deduction_sqft: number | null
          paintable_area_manually_edited: boolean | null
          patch_count: number | null
          photo_data_base64: string[] | null
          primary_frame_index: number | null
          room_length_ft: number | null
          room_perimeter_ft: number | null
          room_shape: string | null
          room_width_ft: number | null
          sample_dimensions: string | null
          sample_room: string | null
          scale_reference: string | null
          selected_scope: string[] | null
          status: string | null
          subtotal_high: number | null
          subtotal_low: number | null
          tax_rate: number | null
          transcript: string | null
          trim_length_ft: number | null
          video_data_base64: string | null
          visible_door_count: number | null
          visible_mark_count: number | null
          visible_window_count: number | null
          visual_observations: string[] | null
          wall_area_sqft: number | null
          wall_tone: string | null
          zip_code: string | null
        }
        Insert: {
          analysis_consent?: boolean | null
          analysis_frame_data_base64?: string[] | null
          audio_note_data_base64?: string | null
          audio_note_mime_type?: string | null
          budget_amount?: number | null
          budget_label?: string | null
          capture_mode?: string | null
          ceiling_area_sqft?: number | null
          ceiling_height_ft?: number | null
          color_hex?: string | null
          color_name?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_reference?: string | null
          created_at?: string
          door_sides?: number | null
          estimate_assumptions?: string[] | null
          estimate_mode?: string | null
          gross_wall_area_sqft?: number | null
          high_total?: number | null
          id?: string
          line_item_ranges?: string[] | null
          low_total?: number | null
          measurement_confidence?: string | null
          measurement_source?: string | null
          media_consent_at?: string | null
          media_kind?: string | null
          media_manifest?: Json | null
          media_mime_type?: string | null
          media_references?: string[] | null
          media_share_consent?: boolean | null
          media_storage_mode?: string | null
          opening_deduction_sqft?: number | null
          paintable_area_manually_edited?: boolean | null
          patch_count?: number | null
          photo_data_base64?: string[] | null
          primary_frame_index?: number | null
          room_length_ft?: number | null
          room_perimeter_ft?: number | null
          room_shape?: string | null
          room_width_ft?: number | null
          sample_dimensions?: string | null
          sample_room?: string | null
          scale_reference?: string | null
          selected_scope?: string[] | null
          status?: string | null
          subtotal_high?: number | null
          subtotal_low?: number | null
          tax_rate?: number | null
          transcript?: string | null
          trim_length_ft?: number | null
          video_data_base64?: string | null
          visible_door_count?: number | null
          visible_mark_count?: number | null
          visible_window_count?: number | null
          visual_observations?: string[] | null
          wall_area_sqft?: number | null
          wall_tone?: string | null
          zip_code?: string | null
        }
        Update: {
          analysis_consent?: boolean | null
          analysis_frame_data_base64?: string[] | null
          audio_note_data_base64?: string | null
          audio_note_mime_type?: string | null
          budget_amount?: number | null
          budget_label?: string | null
          capture_mode?: string | null
          ceiling_area_sqft?: number | null
          ceiling_height_ft?: number | null
          color_hex?: string | null
          color_name?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_reference?: string | null
          created_at?: string
          door_sides?: number | null
          estimate_assumptions?: string[] | null
          estimate_mode?: string | null
          gross_wall_area_sqft?: number | null
          high_total?: number | null
          id?: string
          line_item_ranges?: string[] | null
          low_total?: number | null
          measurement_confidence?: string | null
          measurement_source?: string | null
          media_consent_at?: string | null
          media_kind?: string | null
          media_manifest?: Json | null
          media_mime_type?: string | null
          media_references?: string[] | null
          media_share_consent?: boolean | null
          media_storage_mode?: string | null
          opening_deduction_sqft?: number | null
          paintable_area_manually_edited?: boolean | null
          patch_count?: number | null
          photo_data_base64?: string[] | null
          primary_frame_index?: number | null
          room_length_ft?: number | null
          room_perimeter_ft?: number | null
          room_shape?: string | null
          room_width_ft?: number | null
          sample_dimensions?: string | null
          sample_room?: string | null
          scale_reference?: string | null
          selected_scope?: string[] | null
          status?: string | null
          subtotal_high?: number | null
          subtotal_low?: number | null
          tax_rate?: number | null
          transcript?: string | null
          trim_length_ft?: number | null
          video_data_base64?: string | null
          visible_door_count?: number | null
          visible_mark_count?: number | null
          visible_window_count?: number | null
          visual_observations?: string[] | null
          wall_area_sqft?: number | null
          wall_tone?: string | null
          zip_code?: string | null
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
