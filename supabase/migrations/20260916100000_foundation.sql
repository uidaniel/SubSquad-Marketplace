-- ============================================================================
-- Foundation: extensions, shared helpers, accounts.
--
-- Row-level security is on for every table in this project without exception.
-- Access is scoped by org membership: a row is visible when the signed-in user
-- belongs to the org that owns it. Anything that needs to cross that boundary
-- (ops tooling, webhooks, background jobs) runs with the service role, which
-- bypasses RLS by design and is never exposed to a browser.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- updated_at, maintained by the database rather than by every caller
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create type public.org_type as enum ('agency', 'brand');
create type public.verification_status as enum ('pending', 'verified', 'rejected');
create type public.org_role as enum ('owner', 'admin', 'member');

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  type public.org_type not null,
  name text not null,
  cac_number text,
  country text not null default 'NG',
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  -- Agencies add a margin on top of creator fees. Null for brands, who have none.
  default_margin_bps integer check (default_margin_bps between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index org_members_user_idx on public.org_members (user_id);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null,
  category text,
  logo_url text,
  -- A brand org works out of exactly one space, its own.
  is_self boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index spaces_org_idx on public.spaces (org_id);
create unique index spaces_one_self_per_org on public.spaces (org_id) where is_self;

-- ---------------------------------------------------------------------------
-- The membership lookup every policy is built on.
--
-- SECURITY DEFINER so the function can read org_members while the policies that
-- call it are still being evaluated; without it the policy on org_members would
-- recurse into itself.
-- ---------------------------------------------------------------------------
create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.org_members where user_id = auth.uid();
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where user_id = auth.uid() and org_id = target_org
  );
$$;

/**
 * True when the signed-in user can act on behalf of the org, rather than only
 * read it. Releasing money and sending messages are owner/admin actions.
 */
create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where user_id = auth.uid()
      and org_id = target_org
      and role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.spaces enable row level security;

create policy orgs_read on public.orgs
  for select using (public.is_org_member(id));

create policy orgs_update on public.orgs
  for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- Any signed-in user may create an org; joining themselves to it happens next,
-- in the same transaction, through the sign-up flow.
create policy orgs_insert on public.orgs
  for insert to authenticated with check (true);

create policy org_members_read on public.org_members
  for select using (user_id = auth.uid() or public.is_org_member(org_id));

create policy org_members_write on public.org_members
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- The first membership row, created as part of sign-up, has no admin to approve it.
create policy org_members_self_insert on public.org_members
  for insert to authenticated with check (user_id = auth.uid());

create policy spaces_read on public.spaces
  for select using (public.is_org_member(org_id));

create policy spaces_write on public.spaces
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger orgs_touch before update on public.orgs
  for each row execute function public.touch_updated_at();
create trigger org_members_touch before update on public.org_members
  for each row execute function public.touch_updated_at();
create trigger spaces_touch before update on public.spaces
  for each row execute function public.touch_updated_at();
