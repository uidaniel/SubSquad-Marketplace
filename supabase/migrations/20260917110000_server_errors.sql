-- ============================================================================
-- Server errors, captured where they can be read.
--
-- Netlify's log viewer truncates the message, which is how two plausible
-- theories about a 502 both turned out to be wrong. This holds the whole thing:
-- message, stack, route.
--
-- No policy, so only the service role reaches it. A stack trace can carry
-- fragments of a request, and this is diagnostic data rather than product data.
-- ============================================================================

create table if not exists public.server_errors (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  path text,
  message text not null,
  stack text,
  digest text,
  created_at timestamptz not null default now()
);
alter table public.server_errors enable row level security;

create index if not exists server_errors_recent_idx
  on public.server_errors (created_at desc);

comment on table public.server_errors is
  'Diagnostic capture for server crashes. Stands in until Sentry has a DSN.';
