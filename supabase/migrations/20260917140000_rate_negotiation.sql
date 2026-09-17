-- ---------------------------------------------------------------------------
-- Negotiating a rate.
--
-- A creator could already counter-offer, but the amount went into the body of a
-- chat message — "Counter-offer: ₦180,000." — and nowhere else. There was no
-- brand-side action to accept it, because there was nothing structured to
-- accept. The negotiation was a dead end: a creator could name their price and
-- nobody could say yes.
--
-- The proposed rate now lives on the deal, where the brand can act on it and
-- where "what was agreed, and when" survives the chat history.
-- ---------------------------------------------------------------------------

alter table public.deals
  -- What the creator is asking for. Null once answered, either way.
  add column if not exists proposed_fee_kobo bigint
    check (proposed_fee_kobo is null or proposed_fee_kobo > 0),
  add column if not exists rate_proposed_at timestamptz,
  add column if not exists rate_note text,
  -- Who settled it and when. A fee that changed needs an audit trail as much as
  -- a payment does.
  add column if not exists rate_agreed_at timestamptz,
  add column if not exists rate_agreed_by uuid references auth.users (id);

-- The queue an agency works from: every deal waiting on a human answer about
-- money, oldest first, because a creator who has waited three days for a yes
-- has usually already taken other work.
create index if not exists deals_awaiting_rate_idx
  on public.deals (rate_proposed_at)
  where proposed_fee_kobo is not null and rate_agreed_at is null;

comment on column public.deals.proposed_fee_kobo is
  'The rate the creator is asking for, pending a brand decision. Null when settled.';
