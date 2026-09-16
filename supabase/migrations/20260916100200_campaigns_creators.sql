-- ============================================================================
-- Campaigns and the creator index.
--
-- Creators are deliberately not scoped to an org: the index is shared, because
-- a creator who has been verified and scored once should not have to be
-- re-verified by every agency that finds them. What *is* org-private is the
-- opinion an agency forms about them, which lives in creator_notes.
-- ============================================================================

create type public.campaign_status as enum (
  'draft', 'funded', 'shortlisting', 'outreach', 'content', 'live', 'completed', 'cancelled'
);

create type public.deliverable_type as enum (
  'tiktok_video', 'ig_reel', 'ig_story', 'yt_short', 'x_post'
);

create type public.arcon_category as enum (
  'general', 'financial', 'alcohol', 'betting', 'health'
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete restrict,
  name text not null,
  -- The brand the content is for: an agency's client, or the brand itself.
  end_brand_name text not null,
  status public.campaign_status not null default 'draft',
  budget_kobo bigint not null default 0 check (budget_kobo >= 0),
  platform_fee_bps integer not null default 1200 check (platform_fee_bps between 0 and 10000),
  agency_margin_bps integer check (agency_margin_bps between 0 and 10000),
  arcon_category public.arcon_category not null default 'general',
  brief jsonb not null default '{}'::jsonb,
  rate_band_min_kobo bigint check (rate_band_min_kobo >= 0),
  rate_band_max_kobo bigint check (rate_band_max_kobo >= 0),
  deadline timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_band_ordered check (
    rate_band_min_kobo is null
    or rate_band_max_kobo is null
    or rate_band_min_kobo <= rate_band_max_kobo
  )
);

create index campaigns_org_idx on public.campaigns (org_id);
create index campaigns_space_idx on public.campaigns (space_id);
create index campaigns_status_idx on public.campaigns (status);

create table public.campaign_slots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  deliverable_type public.deliverable_type not null,
  count integer not null check (count > 0),
  fee_kobo bigint not null check (fee_kobo > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaign_slots_campaign_idx on public.campaign_slots (campaign_id);

-- ---------------------------------------------------------------------------
-- Creators
-- ---------------------------------------------------------------------------

create type public.creator_status as enum ('indexed', 'invited', 'onboarded', 'suspended');
create type public.contact_source as enum ('bio', 'linkinbio', 'manual', 'referral');

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  primary_platform text not null,
  handle text not null,
  phone text,
  email text,
  whatsapp_opt_in boolean not null default false,
  status public.creator_status not null default 'indexed',
  payout_bank_code text,
  payout_account_number text,
  payout_account_name text,
  payout_verified boolean not null default false,
  user_id uuid references auth.users (id) on delete set null,
  contact_source public.contact_source not null default 'manual',
  -- Honoured by sendMessage before anything is queued, not checked at send time.
  do_not_contact boolean not null default false,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (primary_platform, handle)
);

create index creators_status_idx on public.creators (status);
create index creators_user_idx on public.creators (user_id);
create index creators_phone_idx on public.creators (phone) where phone is not null;

create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  platform text not null,
  followers integer not null default 0,
  following integer not null default 0,
  posts_count integer not null default 0,
  avg_views integer not null default 0,
  avg_likes integer not null default 0,
  avg_comments integer not null default 0,
  engagement_rate double precision not null default 0,
  category_tags text[] not null default '{}',
  languages text[] not null default '{}',
  location_city text,
  sample_posts jsonb not null default '[]'::jsonb,
  summary text,
  embedding vector(1536),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, platform)
);

-- Cosine distance, which is what the shortlist candidate query orders by.
create index creator_profiles_embedding_idx
  on public.creator_profiles using hnsw (embedding vector_cosine_ops);

create table public.creator_scores (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  -- Null for the baseline score; set when recomputed for a specific campaign.
  campaign_id uuid references public.campaigns (id) on delete cascade,
  fraud_score integer not null check (fraud_score between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index creator_scores_creator_idx on public.creator_scores (creator_id, computed_at desc);

-- An agency's private opinion of a creator. Never visible to another org.
create table public.creator_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  note text not null,
  tags text[] not null default '{}',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creator_notes_org_idx on public.creator_notes (org_id, creator_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.campaigns enable row level security;
alter table public.campaign_slots enable row level security;
alter table public.creators enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.creator_scores enable row level security;
alter table public.creator_notes enable row level security;

create policy campaigns_read on public.campaigns
  for select using (public.is_org_member(org_id));
create policy campaigns_write on public.campaigns
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy campaign_slots_read on public.campaign_slots
  for select using (
    exists (select 1 from public.campaigns c
            where c.id = campaign_slots.campaign_id and public.is_org_member(c.org_id))
  );
create policy campaign_slots_write on public.campaign_slots
  for all using (
    exists (select 1 from public.campaigns c
            where c.id = campaign_slots.campaign_id and public.is_org_admin(c.org_id))
  ) with check (
    exists (select 1 from public.campaigns c
            where c.id = campaign_slots.campaign_id and public.is_org_admin(c.org_id))
  );

-- The index is shared: any signed-in org can see who exists and how they score.
-- Contact details are not selected by the app's client-side queries; outreach
-- goes through the server, which is what enforces the contact caps.
create policy creators_read on public.creators
  for select to authenticated using (true);

-- A creator sees and edits their own row once onboarded.
create policy creators_self_update on public.creators
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy creator_profiles_read on public.creator_profiles
  for select to authenticated using (true);

create policy creator_scores_read on public.creator_scores
  for select to authenticated using (true);

create policy creator_notes_rw on public.creator_notes
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create trigger campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();
create trigger campaign_slots_touch before update on public.campaign_slots
  for each row execute function public.touch_updated_at();
create trigger creators_touch before update on public.creators
  for each row execute function public.touch_updated_at();
create trigger creator_profiles_touch before update on public.creator_profiles
  for each row execute function public.touch_updated_at();
create trigger creator_notes_touch before update on public.creator_notes
  for each row execute function public.touch_updated_at();

-- Now that campaigns and creators exist, point the ledger's loose references at
-- them. They were left untyped in the ledger migration to keep table creation
-- order independent of it.
alter table public.ledger_accounts
  add constraint ledger_accounts_creator_fk
  foreign key (creator_id) references public.creators (id) on delete restrict;

alter table public.ledger_accounts
  add constraint ledger_accounts_campaign_fk
  foreign key (campaign_id) references public.campaigns (id) on delete restrict;

alter table public.payouts
  add constraint payouts_creator_fk
  foreign key (creator_id) references public.creators (id) on delete restrict;
