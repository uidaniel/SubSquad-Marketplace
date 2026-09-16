# SubSquad

Escrow-backed creator campaigns for Nigeria. A brand or agency deposits a budget
and writes a brief; the platform finds creators, drafts the outreach, checks the
content against the brief, and releases payment when the post is verified live.
A person approves anything that sends a message or moves money.

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev
```

With an empty `.env.local` the app starts in **demo mode**: seeded fixtures, mock
providers, nothing sent, no database needed. Every screen works. This is the
fastest way to look at the product, and it is also how it gets demoed to a pilot
agency before their data exists.

To run against a real database, fill in the Supabase keys and:

```bash
npm run db:push     # applies the migrations
npm run seed        # seeds the demo dataset into Postgres
npm run db:verify   # proves the ledger invariant against the live database
```

`DEMO_MODE=false` then switches the app to Postgres. Nothing else changes —
screens do not know which source they are reading.

## The two switches

| Flag | Default | What it does |
|---|---|---|
| `DRY_RUN` | `true` | Messages are logged, never sent. Cards are never charged. **The ledger is still real** — turning this off does not make money move differently, it makes messages leave the building. |
| `DEMO_MODE` | inferred | Serve fixtures instead of Postgres. Implied when Supabase is not configured. |

Turning `DRY_RUN` off is a deliberate act. Everything else is safe to run
against any environment.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | The app, on :3000 |
| `npm test` | Unit tests — ledger, fraud rules, messaging policy |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Applies migrations to the linked Supabase project |
| `npm run seed` | Seeds the demo dataset and asserts the books balance |
| `npm run db:verify` | Proves Postgres refuses unbalanced money |
| `npx trigger.dev@4.6.1 dev` | Background jobs, against the dev environment |

There is also `GET /api/dev/verify-flow` (development only), which walks a
campaign's money through the live database — deposit, duplicate webhook,
overdraft, funding, release, fee split, double-release — and reports each check.

## How it is put together

```
src/
  app/
    (app)/          the org app: agency and brand, desktop-first, responsive
    creator/        the creator app, mobile-first
    i/[token]/      what a creator sees when invited
    d/[token]/      what a brand with no account sees when asked to pay
    api/            webhooks and dev tooling
  lib/
    money.ts        kobo arithmetic — no float naira exists anywhere
    ledger/         double-entry: builders (pure) and post (writes)
    fraud/          scoring rules v1, every deduction carrying its evidence
    ai/             model config, prompts, Zod schemas, the audited client
    messaging/      policy (pure) and transport (server-only)
    data/           read models: one demo module, one Postgres module, one switch
  trigger/          background jobs
supabase/migrations/  the schema, RLS included
```

### The ledger

Money is double-entry and there is **no balance column anywhere**. A balance is
the sum of the entries against an account, computed by a view. This is not
stylistic: a stored balance can drift from its history, and a computed one
cannot.

Three layers enforce it:

1. **Builders** (`lib/ledger/transactions.ts`) are pure and construct only
   balanced transactions. 33 unit tests, including the failing cases.
2. **`post`** (`lib/ledger/post.ts`) re-validates, refuses overdrafts on named
   accounts, and makes webhooks idempotent by keying on `(type, reference)`.
3. **Postgres** has a deferred constraint trigger that refuses any transaction
   whose entries do not sum to zero, whatever wrote it.

Every amount is an integer number of kobo. The platform fee is charged on top of
the creator fee and split 98/2 with a dispute reserve, with the rounding
remainder going to revenue so the two credits always add back to exactly what
was debited.

### Nothing sends without a person

Every outbound message is a row in `deal_messages` before it is sent, including
the ones the AI wrote. `ai_draft = true and sent_at is null` is the outreach
queue. `sendMessage` is the only way out of the building, and it refuses to
send when the creator has opted out, when they were contacted cold in the last
seven days, or when an AI draft has no named approver. Those rules are checked
at approval time, not when the draft was written.

The database enforces the same thing independently: a check constraint refuses
an `ai_draft` row marked sent with no `approved_by`.

### AI

One model config (`lib/ai/models.ts`); nothing else names a model. Every call is
parsed against a Zod schema, retried once with the parse error fed back, and
written to `ai_calls` with its prompt and raw output — because the product
promises creators they can appeal a score and brands that the shortlist has
reasons, and neither is keepable if the call cannot be found later.

Without `ANTHROPIC_API_KEY` each call returns a stub rather than failing.

## Signing in

Cookie sessions through `@supabase/ssr`. Middleware refreshes the token on every
request and turns away anyone without a session, verifying it with Supabase
rather than trusting the cookie.

Every org read now runs **as the signed-in user**, so row-level security decides
what comes back rather than a `.eq("org_id", …)` somebody might forget. The
service client is reserved for the three things that must cross an org
boundary: webhooks, ledger posting, and background jobs.

The seed creates a real account: `ada@kongadigital.ng` / `subsquad-demo`.

Sign-up is two steps — the person, then the company — because agency and brand
are genuinely different products and the choice deserves a screen rather than a
radio button.

## What is not built yet

Honest list, so nobody discovers these by surprise:

- **Paystack collections** are modelled and the payout path is written, but the
  webhook handler is not yet wired.
- **Deepgram transcription and frame extraction** are specified in the prompts
  and schema; the job that calls them is not written.
- **Contract PDFs** are referenced but not generated.
- **Playwright** smoke test is not written; unit tests and the two live
  verification paths cover the money rules.

## Environment

See `.env.example`. Everything is optional — an unset integration degrades to a
mock rather than a boot failure. `/ops` shows which are connected.
