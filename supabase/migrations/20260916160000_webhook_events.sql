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

create table public.webhook_events (
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

create index webhook_events_attention_idx
  on public.webhook_events (created_at desc)
  where needs_attention and resolved_at is null;

create index webhook_events_reference_idx
  on public.webhook_events (provider, reference);

alter table public.webhook_events enable row level security;

-- Readable only by staff. A payload can carry a customer email and the full
-- shape of somebody's payment, which is nobody else's business.
create policy "Staff read webhook events"
  on public.webhook_events for select
  to authenticated
  using (public.is_staff());

-- Written by the webhook handler through the service client, never from a
-- browser, so there is deliberately no insert or update policy.
