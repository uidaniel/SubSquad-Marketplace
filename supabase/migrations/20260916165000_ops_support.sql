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
