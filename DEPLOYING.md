# Deploying to Netlify

Written as a checklist because the order matters: a couple of these values can
only be filled in after something else exists.

## 1. Supabase

Create a project at supabase.com, then from **Project Settings → API** take:

| Value | Where it goes |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` |

Push the schema:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

> The `service_role` key bypasses every row-level security policy in the
> database. It belongs in Netlify's encrypted environment variables and nowhere
> else — never in a `NEXT_PUBLIC_` name, never in a commit, never in a chat.

## 2. Netlify

Connect the repository. Netlify detects Next.js and installs its runtime; the
build command and Node version are pinned in `netlify.toml`.

Under **Site configuration → Environment variables**, add these for **all deploy
contexts** — set them only on production and your deploy previews will boot into
demo mode and read as though nothing saves.

### Required

```
DRY_RUN=true
NEXT_PUBLIC_APP_URL=https://<your-site>.netlify.app
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

`NEXT_PUBLIC_APP_URL` has to be the real deployed origin. Invite links and guest
payment links are built from it, so a wrong value means a link that 404s on
somebody's phone.

`DRY_RUN=true` is the switch between a staging site and one that messages real
creators and moves real money. Leave it on until you are deliberately running a
live test.

### Payments, when you are ready to test them

```
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
```

Then, in the Paystack dashboard under **Settings → API Keys & Webhooks**, set
the webhook URL to:

```
https://<your-site>.netlify.app/api/webhooks/paystack
```

Paystack signs every webhook with your secret key and the handler verifies that
signature before trusting anything, so no separate webhook secret is needed.

Test cards: `4084 0840 8408 4081` succeeds. Paystack's docs list the ones that
deliberately fail, which are worth exercising too — the failure path reverses a
ledger transaction rather than editing one, and that should be seen working.

### Optional

Everything below is optional and the app degrades honestly without it — the ops
health screen shows what is switched on. Leave them unset until each is needed.

```
ANTHROPIC_API_KEY=          # shortlists, content review, message drafts
WHATSAPP_PHONE_NUMBER_ID=   # outreach and verification codes
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
RESEND_API_KEY=             # email fallback when there is no phone
RESEND_FROM=
DEEPGRAM_API_KEY=           # transcribing creator videos
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
LANGFUSE_PUBLIC_KEY=        # AI call traces
LANGFUSE_SECRET_KEY=
```

## 3. Make yourself staff

The ops console is gated on `platform_staff`, which no UI can write to. After
signing up, run this once in the Supabase SQL editor:

```sql
insert into public.platform_staff (user_id, role)
select id, 'admin' from auth.users where email = 'you@subsquad.ng';
```

## 4. Going live

In order, and not before each previous one has been watched working:

1. A test deposit reaches a space wallet and the ledger balances.
2. A test payout reaches `paid`, and a deliberately failed one reverses.
3. Swap the Paystack test keys for live ones.
4. Set `DRY_RUN=false`.
5. Run one real campaign with a budget you would not mind losing.

Paystack's Transfer API needs enabling on a live account, with the business
verified and a settlement account attached. That has a lead time — start it
before you need it.
