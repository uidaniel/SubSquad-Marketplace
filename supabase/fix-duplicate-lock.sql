-- ---------------------------------------------------------------------------
-- Undo the campaign that got funded twice.
--
-- "Split the Bill, Keep the Vibe" was locked twice, 27 seconds apart, because
-- the lock carried no reference and the funding screen went on offering the
-- button after it had succeeded. ₦224,000 left the wallet twice for one
-- campaign.
--
-- This reverses the second lock rather than deleting it. The mistaken
-- transaction stays in the history and a second transaction undoes it, which is
-- what lets anyone answer "what happened to my ₦224,000" in a month's time.
-- Deleting it would make the money vanish from the record instead.
--
-- The two transactions are named by id rather than found by a query. They are
-- byte-for-byte identical apart from their timestamps — an earlier version of
-- this script matched on the memo, selected both, and tried to give them the
-- same reference, which the unique index on (type, reference) refused. Naming
-- them removes the guesswork:
--
--   990a77e7-266d-4387-b65a-6729c4ca69b6  01:50:32  the lock that stands
--   4eea443f-9115-4a6c-a513-ef3e663bea03  01:50:59  the duplicate
--
-- Safe to run twice: the reversal is only inserted if it is not already there.
--
-- Run this in the Supabase SQL editor.
-- ---------------------------------------------------------------------------

begin;

-- ---- reverse the duplicate ------------------------------------------------
with reversal as (
  insert into public.ledger_transactions (type, reference, memo)
  select
    'lock',
    null,
    'Reversal — this campaign was funded twice by one button press'
  -- Already reversed: do nothing, rather than hand back money a second time.
  where not exists (
    select 1 from public.ledger_transactions
     where memo = 'Reversal — this campaign was funded twice by one button press'
  )
  returning id
)
insert into public.ledger_entries (transaction_id, account_id, amount_kobo)
select r.id, e.account_id, -e.amount_kobo
  from reversal r
  cross join public.ledger_entries e
 where e.transaction_id = '4eea443f-9115-4a6c-a513-ef3e663bea03';

-- ---- tag the lock that stands ---------------------------------------------
-- So the application reads this campaign as funded instead of offering to lock
-- a third time. Only this one is tagged; the reversed duplicate keeps its null
-- reference, because the unique index allows only one of each.
update public.ledger_transactions
   set reference = 'lock:ea10d851-b44b-46e0-8bb2-d8f2832eb6f4'
 where id = '990a77e7-266d-4387-b65a-6729c4ca69b6'
   and reference is null;

commit;

-- Check. The Motx Studios wallet should read 776,000 and its campaign escrow
-- 224,000. The other rows belong to the seeded demo agency.
select
  a.kind,
  a.campaign_id,
  b.balance_kobo / 100 as naira,
  b.entry_count
from public.v_balances b
join public.ledger_accounts a on a.id = b.account_id
where a.kind in ('space_wallet', 'campaign_escrow')
  and b.balance_kobo <> 0
order by a.kind;
