-- ============================================================================
-- The ledger.
--
-- Money is double-entry. There is no balance column anywhere in this schema:
-- a balance is the sum of the entries against an account, computed by a view.
-- That is the whole point — a balance cannot drift from its history because it
-- has no independent existence.
--
-- Sign convention: positive = credit (money arriving), negative = debit.
-- Entries within a transaction must sum to zero, enforced by a deferred
-- constraint trigger so a transaction can be assembled row by row and is
-- checked once, at commit.
-- ============================================================================

create type public.ledger_account_kind as enum (
  'space_wallet',
  'campaign_escrow',
  'creator_wallet',
  'platform_fees',
  'dispute_reserve',
  'paystack_clearing',
  'payout_clearing'
);

create type public.ledger_transaction_type as enum (
  'deposit',
  'lock',
  'release',
  'payout',
  'refund',
  'fee',
  'reserve'
);

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  kind public.ledger_account_kind not null,
  -- Exactly one of these identifies what the account belongs to. Platform-level
  -- accounts (fees, reserve, clearing) have none of them.
  org_id uuid references public.orgs (id) on delete restrict,
  space_id uuid references public.spaces (id) on delete restrict,
  creator_id uuid,
  campaign_id uuid,
  deal_id uuid,
  currency text not null default 'NGN' check (currency = 'NGN'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One wallet per space, one escrow per campaign, one wallet per creator.
create unique index ledger_accounts_space_wallet
  on public.ledger_accounts (space_id) where kind = 'space_wallet';
create unique index ledger_accounts_campaign_escrow
  on public.ledger_accounts (campaign_id) where kind = 'campaign_escrow';
create unique index ledger_accounts_deal_escrow
  on public.ledger_accounts (deal_id) where kind = 'campaign_escrow' and deal_id is not null;
create unique index ledger_accounts_creator_wallet
  on public.ledger_accounts (creator_id) where kind = 'creator_wallet';
create unique index ledger_accounts_platform_singleton
  on public.ledger_accounts (kind)
  where kind in ('platform_fees', 'dispute_reserve', 'paystack_clearing', 'payout_clearing');

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  type public.ledger_transaction_type not null,
  -- External identifier: a Paystack reference, a transfer code. Unique when
  -- present, which is what makes webhook handling idempotent.
  reference text,
  memo text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create unique index ledger_transactions_reference
  on public.ledger_transactions (type, reference) where reference is not null;

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions (id) on delete cascade,
  account_id uuid not null references public.ledger_accounts (id) on delete restrict,
  -- Whole kobo. Never zero: an entry records a movement that happened.
  amount_kobo bigint not null check (amount_kobo <> 0),
  created_at timestamptz not null default now()
);

create index ledger_entries_account_idx on public.ledger_entries (account_id);
create index ledger_entries_transaction_idx on public.ledger_entries (transaction_id);

-- ---------------------------------------------------------------------------
-- The invariant.
-- ---------------------------------------------------------------------------
create or replace function public.assert_ledger_balanced()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.transaction_id, old.transaction_id);
  total bigint;
  entry_count integer;
begin
  select coalesce(sum(amount_kobo), 0), count(*)
    into total, entry_count
    from public.ledger_entries
   where transaction_id = target;

  -- A fully deleted transaction is allowed; a half-built one is not.
  if entry_count = 0 then
    return null;
  end if;

  if entry_count < 2 then
    raise exception
      'ledger transaction % has % entry; a movement of money has two sides',
      target, entry_count;
  end if;

  if total <> 0 then
    raise exception
      'ledger transaction % does not balance: % kobo would be %',
      target, abs(total), case when total > 0 then 'created' else 'destroyed' end;
  end if;

  return null;
end;
$$;

create constraint trigger ledger_entries_must_balance
  after insert or update or delete on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.assert_ledger_balanced();

-- ---------------------------------------------------------------------------
-- Balances are a view, never a column.
-- ---------------------------------------------------------------------------
create view public.v_balances
with (security_invoker = true)
as
  select
    a.id as account_id,
    a.kind,
    a.org_id,
    a.space_id,
    a.creator_id,
    a.campaign_id,
    a.deal_id,
    a.currency,
    coalesce(sum(e.amount_kobo), 0)::bigint as balance_kobo,
    count(e.id) as entry_count,
    max(e.created_at) as last_movement_at
  from public.ledger_accounts a
  left join public.ledger_entries e on e.account_id = a.id
  group by a.id;

-- ---------------------------------------------------------------------------
-- Paystack records, kept alongside the ledger rather than inside it: the ledger
-- is what is true about money, these are what a provider told us.
-- ---------------------------------------------------------------------------
create type public.payout_status as enum ('pending', 'processing', 'success', 'failed');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces (id) on delete restrict,
  deal_id uuid,
  amount_kobo bigint not null check (amount_kobo > 0),
  paystack_reference text not null unique,
  status text not null default 'pending',
  raw_webhook jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null,
  deal_id uuid,
  amount_kobo bigint not null check (amount_kobo > 0),
  paystack_transfer_code text unique,
  status public.payout_status not null default 'pending',
  failure_reason text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
--
-- Ledger rows are readable by the org they belong to and writable by nobody
-- through the API. Every posting goes through the service role, because a
-- balanced pair of entries is not something a client can be trusted to assemble.
-- ---------------------------------------------------------------------------
alter table public.ledger_accounts enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;

create policy ledger_accounts_read on public.ledger_accounts
  for select using (
    org_id is not null and public.is_org_member(org_id)
  );

create policy ledger_entries_read on public.ledger_entries
  for select using (
    exists (
      select 1 from public.ledger_accounts a
      where a.id = ledger_entries.account_id
        and a.org_id is not null
        and public.is_org_member(a.org_id)
    )
  );

create policy ledger_transactions_read on public.ledger_transactions
  for select using (
    exists (
      select 1
        from public.ledger_entries e
        join public.ledger_accounts a on a.id = e.account_id
       where e.transaction_id = ledger_transactions.id
         and a.org_id is not null
         and public.is_org_member(a.org_id)
    )
  );

create policy payments_read on public.payments
  for select using (
    space_id is not null and exists (
      select 1 from public.spaces s
      where s.id = payments.space_id and public.is_org_member(s.org_id)
    )
  );

-- Payouts are the creator's own record; org visibility comes via the deal.
create policy payouts_read on public.payouts
  for select using (true);

create trigger ledger_accounts_touch before update on public.ledger_accounts
  for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();
create trigger payouts_touch before update on public.payouts
  for each row execute function public.touch_updated_at();
