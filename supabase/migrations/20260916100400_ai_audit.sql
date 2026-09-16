-- ============================================================================
-- AI audit.
--
-- Every model call the product makes is written down with the prompt that
-- produced it and the raw output it returned. This is not observability for its
-- own sake: the product tells creators they can appeal a score and tells brands
-- the shortlist has reasons, and neither promise is keepable if the call that
-- produced the decision cannot be found afterwards.
-- ============================================================================

create type public.ai_purpose as enum (
  'shortlist',
  'invite_draft',
  'reply_draft',
  'content_review',
  'profile_tagging'
);

create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  purpose public.ai_purpose not null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  deal_id uuid references public.deals (id) on delete set null,
  creator_id uuid references public.creators (id) on delete set null,
  model text not null,
  prompt_version text not null,
  prompt jsonb not null,
  output jsonb,
  -- Set when the model returned something the schema rejected, alongside output.
  parse_error text,
  tokens_in integer,
  tokens_out integer,
  latency_ms integer,
  langfuse_trace_id text,
  created_at timestamptz not null default now()
);

create index ai_calls_purpose_idx on public.ai_calls (purpose, created_at desc);
create index ai_calls_campaign_idx on public.ai_calls (campaign_id) where campaign_id is not null;
create index ai_calls_deal_idx on public.ai_calls (deal_id) where deal_id is not null;

alter table public.ai_calls enable row level security;

-- Readable by the org whose campaign or deal produced the call. Writes are
-- service-role only: an AI call record is evidence, and evidence a client can
-- edit is not evidence.
create policy ai_calls_read on public.ai_calls
  for select using (
    (campaign_id is not null and exists (
      select 1 from public.campaigns c
      where c.id = ai_calls.campaign_id and public.is_org_member(c.org_id)
    ))
    or (deal_id is not null and public.can_see_deal(deal_id))
  );

-- ---------------------------------------------------------------------------
-- Outbound message rate limiting.
--
-- The product promises a creator at most one unsolicited message a week. That
-- promise is kept here rather than in application code so a second code path —
-- a job, a retry, a future integration — cannot quietly break it.
-- ---------------------------------------------------------------------------
create table public.contact_log (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete set null,
  channel public.message_channel not null,
  -- False for replies inside an active conversation, which are not capped.
  unsolicited boolean not null default true,
  sent_at timestamptz not null default now()
);

create index contact_log_creator_idx on public.contact_log (creator_id, sent_at desc);

alter table public.contact_log enable row level security;

create policy contact_log_read on public.contact_log
  for select to authenticated using (true);

/**
 * Whether a creator may be sent an unsolicited message right now.
 *
 * Returns false when they have opted out entirely, or when they were contacted
 * cold inside the last seven days.
 */
create or replace function public.can_contact_creator(target_creator uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not coalesce((select do_not_contact from public.creators where id = target_creator), true)
    and not exists (
      select 1 from public.contact_log
      where creator_id = target_creator
        and unsolicited
        and sent_at > now() - interval '7 days'
    );
$$;
