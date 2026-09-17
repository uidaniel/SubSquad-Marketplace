-- ---------------------------------------------------------------------------
-- SubSquad catch-up migration
--
-- Everything in supabase/migrations that is not yet in the database, in order,
-- rewritten so that running it twice is harmless. Paste the whole file into the
-- Supabase SQL editor and run it once.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 20260916140000_creator_onboarding.sql
-- ===========================================================================

-- ============================================================================
-- Creator onboarding.
--
-- A creator arrives from a WhatsApp link holding nothing but an invite token.
-- Turning that into somebody who can legally be paid needs three things on the
-- record: that they control the phone number, where the money should go, and
-- that they accepted the contract.
--
-- Each is stored on the creator rather than on the deal, so a creator who has
-- already onboarded skips straight to accepting their second deal.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- One-time codes.
--
-- Codes are stored hashed: a leaked backup should not hand anybody a working
-- code for somebody else's phone. Attempts are counted so a four-digit code
-- cannot be walked through, and everything expires.
-- ---------------------------------------------------------------------------
create table if not exists public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists phone_verifications_phone_idx
  on public.phone_verifications (phone, created_at desc);

alter table public.phone_verifications enable row level security;
-- Deliberately no policy. Only the server touches this table; a client that
-- could read it could read the codes.

-- ---------------------------------------------------------------------------
-- What the creator completed, and when.
-- ---------------------------------------------------------------------------
alter table public.creators
  add column if not exists phone_verified_at timestamptz,
  add column if not exists onboarded_at timestamptz,
  -- A contract is only worth having if you can show what was accepted, by whom,
  -- and from where.
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_accepted_ip text;

-- ---------------------------------------------------------------------------
-- Ready to be paid, or not.
--
-- A view rather than a column so it cannot drift from the three facts it is
-- derived from.
-- ---------------------------------------------------------------------------
create or replace view public.v_creator_readiness
with (security_invoker = true)
as
  select
    c.id                                as creator_id,
    c.phone_verified_at is not null     as phone_verified,
    coalesce(c.payout_verified, false)  as payout_ready,
    c.terms_accepted_at is not null     as terms_accepted,
    (
      c.phone_verified_at is not null
      and coalesce(c.payout_verified, false)
      and c.terms_accepted_at is not null
    )                                   as can_be_paid
  from public.creators c;

comment on view public.v_creator_readiness is
  'Whether a creator has completed the three steps that make a payout lawful and possible.';


-- ===========================================================================
-- 20260916150000_draft_storage.sql
-- ===========================================================================

-- ============================================================================
-- Where draft videos live.
--
-- Private, not public. A draft is unpublished work for a brand that has not yet
-- approved it — leaking one early is a real commercial harm, and the creator
-- has not agreed to it being visible to anyone but the people on the deal.
--
-- Files are reached through short-lived signed URLs instead: the creator gets a
-- signed upload URL scoped to one path, and the agency gets a signed download
-- URL that expires. Nothing in this bucket is readable by URL alone.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drafts',
  'drafts',
  false,
  -- 200MB. A minute of phone video is comfortably inside it, and the cap stops
  -- an accidental 4K export from eating a creator's data plan and our storage.
  209715200,
  array[
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Who can read a draft.
--
-- The creator who made it, and the members of the org running the campaign.
-- Objects are keyed `drafts/<deal_id>/<version>-<random>.<ext>`, so the deal id
-- is the first path segment and the join below is cheap.
-- ---------------------------------------------------------------------------
drop policy if exists "Deal participants read drafts" on storage.objects;
create policy "Deal participants read drafts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'drafts'
    and exists (
      select 1
      from public.deals d
      left join public.creators c on c.id = d.creator_id
      left join public.campaigns ca on ca.id = d.campaign_id
      where d.id::text = (storage.foldername(name))[1]
        and (
          c.user_id = auth.uid()
          or public.is_org_member(ca.org_id)
        )
    )
  );

-- Writes never come from a browser session — the creator has an invite token,
-- not an account — so uploads go through a server-issued signed URL and there
-- is deliberately no insert policy for `authenticated`.


-- ===========================================================================
-- 20260916155000_platform_staff.sql
-- ===========================================================================

-- ============================================================================
-- Who works at SubSquad.
--
-- Staff are not a role on an org. An agency owner is the owner of *their*
-- account; a SubSquad ops person operates the platform and can see across every
-- account, which is a different kind of thing entirely. Conflating them would
-- mean one bad `role = 'admin'` check somewhere handed an agency the keys to
-- their competitors' campaigns.
--
-- Membership here is granted in the database by someone who already has it, or
-- by the first founder seeding themselves. There is no self-serve path in.
-- ============================================================================

do $do$ begin
  create type public.staff_role as enum ('ops', 'admin');
exception when duplicate_object then null;
end $do$;

create table if not exists public.platform_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.staff_role not null default 'ops',
  note text,
  created_at timestamptz not null default now()
);

alter table public.platform_staff enable row level security;

/**
 * Whether the caller works here.
 *
 * SECURITY DEFINER so it can read `platform_staff` regardless of the caller's
 * own access — which is the point, since the caller is usually being checked
 * precisely because they might not have any. `search_path` is pinned: without
 * it, a caller who can create a temporary table named `platform_staff` could
 * decide for themselves whether they are staff.
 */
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_staff
    where user_id = auth.uid()
  );
$$;

create or replace function public.is_staff_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_staff
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Staff can see the roster; nobody else can even learn that it exists.
drop policy if exists "Staff read the roster" on public.platform_staff;
create policy "Staff read the roster"
  on public.platform_staff for select
  to authenticated
  using (public.is_staff());

-- Only an admin adds or removes staff, and never through the app UI.
drop policy if exists "Admins manage the roster" on public.platform_staff;
create policy "Admins manage the roster"
  on public.platform_staff for all
  to authenticated
  using (public.is_staff_admin())
  with check (public.is_staff_admin());

comment on table public.platform_staff is
  'SubSquad employees. Distinct from org roles: this crosses account boundaries.';


-- ===========================================================================
-- 20260916160000_webhook_events.sql
-- ===========================================================================

-- ============================================================================
-- Every webhook that passed signature checks.
--
-- Written before the event is acted on, so there is a record even of the ones
-- that then fail to apply. When a client says "I paid you on Tuesday" and the
-- wallet disagrees, this table is the difference between an answer and a shrug.
--
-- Failures are flagged rather than retried. Paystack retries for three days,
-- and none of the failures that reach here — a payment naming a campaign that
-- does not exist, a transfer with no payout row — get better on their own. They
-- need a person, so they go to the ops queue.
-- ============================================================================

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  /** The provider's own id for what this is about: a charge or transfer code. */
  reference text,
  payload jsonb not null,
  error text,
  needs_attention boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists webhook_events_attention_idx
  on public.webhook_events (created_at desc)
  where needs_attention and resolved_at is null;

create index if not exists webhook_events_reference_idx
  on public.webhook_events (provider, reference);

alter table public.webhook_events enable row level security;

-- Readable only by staff. A payload can carry a customer email and the full
-- shape of somebody's payment, which is nobody else's business.
drop policy if exists "Staff read webhook events" on public.webhook_events;
create policy "Staff read webhook events"
  on public.webhook_events for select
  to authenticated
  using (public.is_staff());

-- Written by the webhook handler through the service client, never from a
-- browser, so there is deliberately no insert or update policy.


-- ===========================================================================
-- 20260916165000_ops_support.sql
-- ===========================================================================

-- ============================================================================
-- Columns the ops console needs.
--
-- Verification and dispute resolution are decisions a person makes about
-- somebody else's money or livelihood, so each records who made it and why.
-- "The system rejected it" is not an answer anyone can act on.
-- ============================================================================

alter table public.orgs
  add column if not exists verification_note text,
  add column if not exists verified_by uuid references auth.users (id);

alter table public.disputes
  add column if not exists resolved_at timestamptz;

comment on column public.orgs.verification_note is
  'Why an account was verified or rejected. Shown to the account on rejection.';


-- ===========================================================================
-- 20260917100000_contracts_storage.sql
-- ===========================================================================

-- ============================================================================
-- Where signed contracts live.
--
-- Private. A contract carries the creator's phone number and the IP address
-- they signed from, which is exactly the evidence that makes it enforceable and
-- exactly the sort of thing that should not sit behind a guessable URL.
--
-- Reached through short-lived signed URLs instead, issued to the two parties
-- who are on the deal.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are keyed `<deal_id>/<reference>.pdf`, so the deal id is the first
-- path segment and this join is cheap.
drop policy if exists "Deal participants read contracts" on storage.objects;
create policy "Deal participants read contracts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contracts'
    and exists (
      select 1
      from public.deals d
      left join public.creators c on c.id = d.creator_id
      left join public.campaigns ca on ca.id = d.campaign_id
      where d.id::text = (storage.foldername(name))[1]
        and (c.user_id = auth.uid() or public.is_org_member(ca.org_id))
    )
  );

-- Written only by the server when a creator accepts, so there is deliberately
-- no insert policy for authenticated users.


-- ===========================================================================
-- 20260917120000_ledger_account_org.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A ledger account must know which org it belongs to.
--
-- `ledger_accounts_read` is `org_id is not null and is_org_member(org_id)`, so
-- an account created without an org_id is invisible to the very org that owns
-- it — and so are its entries and transactions, which hang off the same check.
--
-- The failure has no symptom at the point of the mistake. A real ₦1,000,000
-- card deposit posted correctly, balanced to the kobo, and the wallet went on
-- showing ₦0 and "0 entries", because the account holding it was created by the
-- Paystack webhook, which knew the space but never passed its org.
--
-- The application now derives the org (see `accountFor`), but an account's org
-- is a fact about its scope rather than something a caller should have to
-- remember, so it is derived here too. This is the layer every writer goes
-- through — the webhook, the seed, a backfill script, a hand-written insert.
-- ---------------------------------------------------------------------------

create or replace function public.ledger_account_derive_org()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is not null then
    return new;
  end if;

  if new.space_id is not null then
    select s.org_id into new.org_id from public.spaces s where s.id = new.space_id;
  elsif new.campaign_id is not null then
    select c.org_id into new.org_id from public.campaigns c where c.id = new.campaign_id;
  elsif new.deal_id is not null then
    -- Only campaign deals have an org. A deal a creator brought in themselves
    -- has no agency behind it, so a null org_id there is correct, not a gap.
    select c.org_id into new.org_id
      from public.deals d
      join public.campaigns c on c.id = d.campaign_id
     where d.id = new.deal_id;
  end if;

  return new;
end;
$$;

drop trigger if exists ledger_accounts_derive_org on public.ledger_accounts;
create trigger ledger_accounts_derive_org
  before insert or update on public.ledger_accounts
  for each row execute function public.ledger_account_derive_org();

-- Repair the accounts already created without one. Real money is sitting in at
-- least one of these.
update public.ledger_accounts a
   set org_id = s.org_id
  from public.spaces s
 where a.space_id = s.id
   and a.org_id is null;

update public.ledger_accounts a
   set org_id = c.org_id
  from public.campaigns c
 where a.campaign_id = c.id
   and a.org_id is null;

update public.ledger_accounts a
   set org_id = c.org_id
  from public.deals d
  join public.campaigns c on c.id = d.campaign_id
 where a.deal_id = d.id
   and a.org_id is null;
