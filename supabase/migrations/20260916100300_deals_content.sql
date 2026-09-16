-- ============================================================================
-- Deals, messages, drafts, disputes.
--
-- A deal is the unit of work and the unit of money: one creator, one set of
-- deliverables, one fee, one contract. Campaign deals and creator-initiated
-- deals are the same table because they run through the same review, the same
-- escrow and the same payout — only the fee rate and who funds it differ.
-- ============================================================================

create type public.deal_origin as enum ('campaign', 'creator_direct');
create type public.fee_payer as enum ('brand', 'creator');

create type public.deal_status as enum (
  'invited',
  'negotiating',
  'accepted',
  'declined',
  'awaiting_funding',
  'partially_funded',
  'contract_signed',
  'draft_submitted',
  'revision_requested',
  'approved',
  'published',
  'paid',
  'cancelled',
  'disputed'
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  -- Null for a deal a creator brought in themselves.
  campaign_id uuid references public.campaigns (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete restrict,
  slot_id uuid references public.campaign_slots (id) on delete set null,
  origin public.deal_origin not null default 'campaign',
  fee_kobo bigint not null check (fee_kobo > 0),
  -- 1200 on campaign deals, 600 on deals a creator brings in.
  platform_fee_bps integer not null default 1200 check (platform_fee_bps between 0 and 10000),
  fee_paid_by public.fee_payer not null default 'brand',
  status public.deal_status not null default 'invited',
  deadline timestamptz,
  invite_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  -- Only creator-initiated deals have a brand-facing link.
  brand_approval_token text unique,
  contract_pdf_url text,
  contract_accepted_at timestamptz,
  contract_ip inet,
  published_url text,
  published_at timestamptz,
  -- Set when a creator marks a deal published; the brand's silence confirms it.
  auto_confirm_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_deals_have_a_campaign check (
    (origin = 'campaign' and campaign_id is not null)
    or (origin = 'creator_direct' and campaign_id is null)
  )
);

create index deals_campaign_idx on public.deals (campaign_id);
create index deals_creator_idx on public.deals (creator_id);
create index deals_status_idx on public.deals (status);
create index deals_auto_confirm_idx on public.deals (auto_confirm_at)
  where auto_confirm_at is not null and status = 'published';

-- The brand on a creator-initiated deal, who has no account yet.
create table public.guest_brands (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  brand_name text not null,
  contact_email text not null,
  contact_phone text,
  consent_marketing boolean not null default false,
  paid_at timestamptz,
  converted_org_id uuid references public.orgs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id)
);

create type public.shortlist_status as enum ('proposed', 'approved', 'removed');

create table public.shortlist_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  creator_id uuid not null references public.creators (id) on delete cascade,
  slot_id uuid references public.campaign_slots (id) on delete set null,
  ai_reasoning text not null,
  fit_score integer not null check (fit_score between 0 and 100),
  estimated_fee_kobo bigint not null check (estimated_fee_kobo > 0),
  status public.shortlist_status not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

create index shortlist_items_campaign_idx on public.shortlist_items (campaign_id, status);

-- ---------------------------------------------------------------------------
-- Messages
--
-- Every outbound message is a row here before it is sent, including the ones
-- the AI wrote. `ai_draft = true and sent_at is null` is the ops inbox: nothing
-- reaches a creator without a person setting approved_by.
-- ---------------------------------------------------------------------------
create type public.message_direction as enum ('outbound', 'inbound');
create type public.message_channel as enum ('whatsapp', 'email', 'manual');

create table public.deal_messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  direction public.message_direction not null,
  channel public.message_channel not null,
  body text not null,
  ai_draft boolean not null default false,
  approved_by uuid references auth.users (id),
  sent_at timestamptz,
  provider_message_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An outbound AI draft cannot be marked sent without someone approving it.
  constraint ai_drafts_need_approval check (
    not (ai_draft and sent_at is not null and approved_by is null)
  )
);

create index deal_messages_deal_idx on public.deal_messages (deal_id, created_at);
create index deal_messages_pending_idx on public.deal_messages (created_at)
  where ai_draft and sent_at is null;

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------
create type public.reviewer_decision as enum ('approved', 'revision');

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  version integer not null check (version > 0),
  file_url text not null,
  caption text not null default '',
  transcript text,
  frame_descriptions jsonb,
  submitted_at timestamptz not null default now(),
  ai_review jsonb,
  reviewer_decision public.reviewer_decision,
  reviewer_notes text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, version)
);

create index drafts_deal_idx on public.drafts (deal_id, version desc);

create type public.dispute_status as enum ('open', 'resolved_creator', 'resolved_org', 'withdrawn');

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  opened_by text not null check (opened_by in ('creator', 'org')),
  reason text not null,
  status public.dispute_status not null default 'open',
  resolution text,
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index disputes_status_idx on public.disputes (status);

-- Late-bound foreign keys from the ledger and payments to deals.
alter table public.ledger_accounts
  add constraint ledger_accounts_deal_fk
  foreign key (deal_id) references public.deals (id) on delete restrict;
alter table public.payments
  add constraint payments_deal_fk
  foreign key (deal_id) references public.deals (id) on delete restrict;
alter table public.payouts
  add constraint payouts_deal_fk
  foreign key (deal_id) references public.deals (id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS
--
-- A deal is visible to the org running the campaign and to the creator on it.
-- Guest-brand access is not expressed here: it is by unguessable token through
-- a server route, because the brand has no account to authenticate as.
-- ---------------------------------------------------------------------------
alter table public.deals enable row level security;
alter table public.guest_brands enable row level security;
alter table public.shortlist_items enable row level security;
alter table public.deal_messages enable row level security;
alter table public.drafts enable row level security;
alter table public.disputes enable row level security;

create or replace function public.can_see_deal(target_deal uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.deals d
      left join public.campaigns c on c.id = d.campaign_id
      left join public.creators cr on cr.id = d.creator_id
     where d.id = target_deal
       and (
         (c.org_id is not null and public.is_org_member(c.org_id))
         or cr.user_id = auth.uid()
       )
  );
$$;

create policy deals_read on public.deals
  for select using (
    (campaign_id is not null and exists (
      select 1 from public.campaigns c
      where c.id = deals.campaign_id and public.is_org_member(c.org_id)
    ))
    or exists (
      select 1 from public.creators cr
      where cr.id = deals.creator_id and cr.user_id = auth.uid()
    )
  );

create policy deals_org_write on public.deals
  for update using (
    campaign_id is not null and exists (
      select 1 from public.campaigns c
      where c.id = deals.campaign_id and public.is_org_admin(c.org_id)
    )
  ) with check (true);

create policy shortlist_items_rw on public.shortlist_items
  for all using (
    exists (select 1 from public.campaigns c
            where c.id = shortlist_items.campaign_id and public.is_org_member(c.org_id))
  ) with check (
    exists (select 1 from public.campaigns c
            where c.id = shortlist_items.campaign_id and public.is_org_admin(c.org_id))
  );

create policy deal_messages_read on public.deal_messages
  for select using (public.can_see_deal(deal_id));

create policy drafts_read on public.drafts
  for select using (public.can_see_deal(deal_id));

create policy drafts_creator_write on public.drafts
  for insert to authenticated with check (
    exists (
      select 1 from public.deals d join public.creators cr on cr.id = d.creator_id
      where d.id = drafts.deal_id and cr.user_id = auth.uid()
    )
  );

create policy disputes_read on public.disputes
  for select using (public.can_see_deal(deal_id));

create policy guest_brands_read on public.guest_brands
  for select using (public.can_see_deal(deal_id));

create trigger deals_touch before update on public.deals
  for each row execute function public.touch_updated_at();
create trigger guest_brands_touch before update on public.guest_brands
  for each row execute function public.touch_updated_at();
create trigger shortlist_items_touch before update on public.shortlist_items
  for each row execute function public.touch_updated_at();
create trigger deal_messages_touch before update on public.deal_messages
  for each row execute function public.touch_updated_at();
create trigger drafts_touch before update on public.drafts
  for each row execute function public.touch_updated_at();
create trigger disputes_touch before update on public.disputes
  for each row execute function public.touch_updated_at();
