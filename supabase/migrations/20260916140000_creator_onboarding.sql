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
create table public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index phone_verifications_phone_idx
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
