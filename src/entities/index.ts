import { supabase } from "@/integrations/supabase/client";

export interface Entity {
  id: string;
}

export type RoomMediaAssetRole = "walkthrough_video" | "photo" | "spoken_note" | "analysis_frame";

export interface RoomEstimateMediaManifestAsset {
  asset_id: string;
  role: RoomMediaAssetRole;
  mime_type: string;
  byte_count: number;
  sha256: string;
  chunk_record_ids: string[];
}

export interface RoomEstimateMediaManifest {
  version: 1;
  upload_group_id: string;
  assets: RoomEstimateMediaManifestAsset[];
  primary_frame_role: "photo" | "analysis_frame";
  primary_frame_index: number;
  analysis_consent: boolean;
  media_share_consent: boolean;
  media_consent_at: string;
}

export interface RoomEstimateMediaChunkRecord extends Entity {
  upload_group_id: string;
  asset_id: string;
  part_index: number;
  part_count: number;
  raw_byte_count: number;
  payload_base64: string;
  checksum_sha256: string;
}

export interface RoomEstimateRecord extends Entity {
  created_at?: string;
  estimate_mode?: "homeowner" | "demo";
  capture_mode?: "video" | "photos" | "demo";
  sample_room?: string;
  sample_dimensions?: string;
  media_storage_mode?: string;
  media_kind?: "video" | "photos" | "demo";
  media_mime_type?: string;
  media_manifest?: RoomEstimateMediaManifest;
  video_data_base64?: string;
  photo_data_base64?: string[];
  audio_note_data_base64?: string;
  audio_note_mime_type?: string;
  analysis_frame_data_base64?: string[];
  primary_frame_index?: number;
  media_references?: string[];
  analysis_consent?: boolean;
  media_share_consent?: boolean;
  media_consent_at?: string;
  transcript?: string;
  visual_observations?: string[];
  visible_door_count?: number;
  visible_window_count?: number;
  visible_mark_count?: number;
  wall_tone?: string;
  scale_reference?: string;
  measurement_source?: string;
  measurement_confidence?: string;
  room_length_ft?: number;
  room_width_ft?: number;
  ceiling_height_ft?: number;
  wall_area_sqft?: number;
  ceiling_area_sqft?: number;
  trim_length_ft?: number;
  door_sides?: number;
  patch_count?: number;
  budget_label?: string;
  budget_amount?: number;
  selected_scope?: string[];
  line_item_ranges?: string[];
  estimate_assumptions?: string[];
  subtotal_low?: number;
  subtotal_high?: number;
  tax_rate?: number;
  low_total?: number;
  high_total?: number;
  color_name?: string;
  color_hex?: string;
  contact_reference?: string;
  contact_name?: string;
  contact_phone?: string;
  zip_code?: string;
  status?: string;
}


/* eslint-disable @typescript-eslint/no-explicit-any */
// Cloud-backed replacements for the former entity managers. Anonymous visitors can insert
// but not read rows, so ids are generated client-side and inserts never request a returning row.
function nullsToUndefined<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) if (value !== null) out[key] = value;
  return out as T;
}

function entityManager<T extends Entity>(table: "room_estimates" | "room_estimate_media_chunks") {
  return {
    async create(values: Omit<T, "id"> & Partial<Pick<T, "id">>): Promise<T> {
      const id = (values as any).id ?? crypto.randomUUID();
      const row = { ...(values as any), id };
      const { error } = await (supabase.from(table) as any).insert(row);
      if (error) throw new Error(error.message);
      return row as T;
    },
    async get(id: string): Promise<T> {
      const { data, error } = await (supabase.from(table) as any).select("*").eq("id", id).single();
      if (error || !data) throw new Error(error?.message ?? "not-found");
      return nullsToUndefined<T>(data);
    },
    query() {
      let columns = "*";
      let order: { column: string; ascending: boolean } | null = null;
      let max = 50;
      const builder = {
        select(fields: string[]) { columns = fields.join(","); return builder; },
        sort(spec: string) { order = { column: spec.replace(/^-/, ""), ascending: !spec.startsWith("-") }; return builder; },
        limit(count: number) { max = count; return builder; },
        async exec(): Promise<T[]> {
          let request = (supabase.from(table) as any).select(columns);
          if (order) request = request.order(order.column, { ascending: order.ascending });
          const { data, error } = await request.limit(max);
          if (error) throw new Error(error.message);
          return (data ?? []).map((row: Record<string, unknown>) => nullsToUndefined<T>(row));
        },
      };
      return builder;
    },
  };
}

export const User = {
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("signed-out");
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    return { id: user.id, email: user.email ?? "", isAdmin: isAdmin === true };
  },
};
export const RoomEstimate = entityManager<RoomEstimateRecord>("room_estimates");
export const RoomEstimateMediaChunk = entityManager<RoomEstimateMediaChunkRecord>("room_estimate_media_chunks");
