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

create type public.staff_role as enum ('ops', 'admin');

create table public.platform_staff (
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
create policy "Staff read the roster"
  on public.platform_staff for select
  to authenticated
  using (public.is_staff());

-- Only an admin adds or removes staff, and never through the app UI.
create policy "Admins manage the roster"
  on public.platform_staff for all
  to authenticated
  using (public.is_staff_admin())
  with check (public.is_staff_admin());

comment on table public.platform_staff is
  'SubSquad employees. Distinct from org roles: this crosses account boundaries.';
