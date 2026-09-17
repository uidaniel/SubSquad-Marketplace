-- ---------------------------------------------------------------------------
-- Inviting a teammate.
--
-- An agency is not one person. Until now the only way into an org was to create
-- it, so the second person at a company could not get in at all — the settings
-- screen had an "Invite a teammate" button with nothing behind it and a team
-- list that only ever showed you.
--
-- The token is the invite. It is random, single-use and expiring, and it names
-- the email it was issued for: accepting it while signed in as somebody else
-- must not quietly add the wrong account to the org.
-- ---------------------------------------------------------------------------

create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null,
  role public.org_role not null default 'member',
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  -- Long enough to survive a weekend, short enough that a forwarded email is
  -- not a permanent back door.
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  -- One outstanding invite per person per org. Re-inviting replaces it.
  unique (org_id, email)
);

create index if not exists org_invites_token_idx on public.org_invites (token);

alter table public.org_invites enable row level security;

-- Members can see who has been invited to their own org. The token is not
-- excluded here because PostgREST cannot hide a column per policy — the app
-- never selects it on this path, and only admins can create or delete rows.
drop policy if exists org_invites_read on public.org_invites;
create policy org_invites_read
  on public.org_invites for select
  using (public.is_org_member(org_id));

drop policy if exists org_invites_write on public.org_invites;
create policy org_invites_write
  on public.org_invites for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

comment on table public.org_invites is
  'Pending invitations into an org. Accepting one creates the org_members row.';
