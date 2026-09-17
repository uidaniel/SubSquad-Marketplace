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
