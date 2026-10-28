create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create table public.room_estimates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  estimate_mode text, capture_mode text, sample_room text, sample_dimensions text,
  media_storage_mode text, media_kind text, media_mime_type text,
  video_data_base64 text, photo_data_base64 text[], audio_note_data_base64 text, audio_note_mime_type text,
  analysis_frame_data_base64 text[], primary_frame_index numeric, media_references text[],
  media_manifest jsonb, analysis_consent boolean, media_share_consent boolean, media_consent_at text,
  transcript text, visual_observations text[],
  visible_door_count numeric, visible_window_count numeric, visible_mark_count numeric,
  wall_tone text, scale_reference text, measurement_source text, measurement_confidence text, room_shape text,
  room_length_ft numeric, room_width_ft numeric, room_perimeter_ft numeric, ceiling_height_ft numeric,
  gross_wall_area_sqft numeric, opening_deduction_sqft numeric, wall_area_sqft numeric,
  paintable_area_manually_edited boolean, ceiling_area_sqft numeric, trim_length_ft numeric,
  door_sides numeric, patch_count numeric, budget_label text, budget_amount numeric,
  selected_scope text[], line_item_ranges text[], estimate_assumptions text[],
  subtotal_low numeric, subtotal_high numeric, tax_rate numeric, low_total numeric, high_total numeric,
  color_name text, color_hex text, contact_reference text, contact_name text, contact_phone text,
  zip_code text, status text
);
grant insert on public.room_estimates to anon, authenticated;
grant select, update, delete on public.room_estimates to authenticated;
grant all on public.room_estimates to service_role;
alter table public.room_estimates enable row level security;
create policy "Anyone can submit an estimate" on public.room_estimates for insert to anon, authenticated with check (true);
create policy "Admins read estimates" on public.room_estimates for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins update estimates" on public.room_estimates for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete estimates" on public.room_estimates for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.room_estimate_media_chunks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  upload_group_id text not null, asset_id text not null,
  part_index integer not null, part_count integer not null, raw_byte_count integer not null,
  payload_base64 text not null, checksum_sha256 text not null
);
grant insert on public.room_estimate_media_chunks to anon, authenticated;
grant select, update, delete on public.room_estimate_media_chunks to authenticated;
grant all on public.room_estimate_media_chunks to service_role;
alter table public.room_estimate_media_chunks enable row level security;
create policy "Anyone can upload media parts" on public.room_estimate_media_chunks for insert to anon, authenticated with check (true);
create policy "Admins read media parts" on public.room_estimate_media_chunks for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete media parts" on public.room_estimate_media_chunks for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.analysis_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  day date not null default (now() at time zone 'utc')::date,
  visitor_hash text not null,
  attempt_id text not null,
  stage text not null,
  unique (attempt_id, stage)
);
create index analysis_usage_day_idx on public.analysis_usage (day, visitor_hash);
grant all on public.analysis_usage to service_role;
alter table public.analysis_usage enable row level security;