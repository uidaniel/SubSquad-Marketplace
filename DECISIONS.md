# Decisions

Where the build spec was ambiguous, or where following it literally would have
produced a worse product, this is what was decided and why. Per the spec's own
operating rule: pick the simplest option, implement it, write it down.

---

## Stack

**Next.js pinned to 15, not 16.** `create-next-app` now installs 16.3.5. The
spec names 15 under "fixed — do not substitute", so 15 is what is installed.
Nothing in the codebase depends on the difference; upgrading is a version bump
and a read of the 16 migration notes.

**shadcn/ui components are hand-written rather than pulled through the CLI.**
The CLI wants to own `globals.css` and install its own token names, which would
sit alongside — and fight with — the design tokens this product already has.
The components are built the shadcn way (Radix primitives, `cva`, `cn`, owned
in-repo under `components/ui`), so they are the same thing structurally, and
`npx shadcn add` still works for anything new.

**Kobo are `number`, not `bigint`.** The column is `bigint`. In the domain,
JavaScript's safe-integer ceiling is about ₦90 billion, which no campaign will
approach, and `bigint` breaks JSON serialisation across every server action and
prop. Every amount is validated as a whole, finite, in-range integer on the way
in (`assertKobo`), which catches the real risk — a float sneaking in — without
the ceremony.

---

## Money

**Overdraft protection is opt-in per call, not automatic.** The ledger allows
negative balances because clearing accounts are *meant* to go negative between a
charge and its settlement. So "this account must be able to afford this" is
stated explicitly by the caller via `requireFunds`, rather than inferred.

**The platform fee rounds in the payer's favour, and the dispute reserve absorbs
the floor.** `applyBps` rounds down, so the platform never rounds a fee up
against whoever pays it. Splitting the fee 98/2 takes the floor on the reserve
side and gives the remainder to revenue, which guarantees the two credits add
back to exactly the amount debited — a percentage of an odd number of kobo would
otherwise lose one.

**A fee that rounds to zero is refused rather than posted.** Posting a
zero-amount entry would record a movement that did not happen. Callers check the
fee is non-zero before posting one.

**Funding is enforced at the campaign, not at the deal.** A campaign must hold
creator fees *plus* the platform fee before it can be funded. Funding only the
creator fees would leave the last creator unpayable at exactly the moment they
had already done the work.

**Auto-confirmed deals settle through the same path as approved ones.**
`releaseDeal` is the single route by which any deal settles — human approval,
the five-day brand silence window, or an ops-forced release. The money rules do
not get a shortcut because nobody was watching.

---

## Product

**Shortlist approval starts with everyone selected.** The spec describes
approve/remove per card. The AI has already ranked and excluded; asking a person
to tick twenty boxes to agree with it is make-work. They start approved and you
remove what you disagree with.

**The shortlist screen shows a running total of what approving commits.**
Approving a shortlist commits money — creator fees plus the platform fee on top.
That total, and whether escrow covers it, is shown as the selection changes
rather than discovered on the next screen.

**Campaign tabs are links, not client state.** Each tab is a real URL, so it can
be linked to from the action list, opened in a new tab and refreshed. It also
means each tab renders on the server with only its own data instead of every
panel being mounted and hidden with CSS.

**The board is organised by decision, not by status.** "Shortlisting" is a
state; "approve 4 creators" is something a person can do in ten seconds. The
`nextAction` for each campaign is computed server-side and ordered by what it
costs to leave undone — money that cannot move ranks above work that is waiting.

**Excluded creators stay visible in the index.** The product promises creators
they can appeal a score. An exclusion nobody can see cannot be appealed.

**Verification of a published post is a person clicking, not a scrape.** v1 does
not read post metrics. Paying out on an unverified claim is the exact failure
escrow exists to prevent, so the release button says what it is doing.

**Reports show only what the ledger knows.** No engagement charts built from
numbers we have not verified. Reach is entered by hand in v1 and labelled as
such.

---

## Interface

**Base CSS lives inside `@layer base`.** Tailwind v4 registers its own layers on
import, and unlayered CSS outranks every layered utility regardless of
specificity. An unlayered `button { color: inherit }` was silently beating
`text-white` on every solid button in the app. This is a footgun worth naming.

**Avatars render without JavaScript.** Initials sit behind the image rather than
being swapped in by an `onError` handler, so a broken or slow photo degrades on
its own. Avatars appear on every row of every table; making them client
components to handle one edge case would have been a poor trade.

**The org rail is a drawer below `lg`, not hidden.** It was initially
`hidden lg:flex`, which left phone and tablet with no navigation at all.

**Secondary table columns are hidden at small widths rather than scrolled to.**
A horizontally scrolling table on a phone hides the fact that there is more to
see. The columns that survive are the ones a person is scanning for.

**Loading states are skeletons shaped like the content.** Built to the same
column widths and row heights as the real table, so nothing jumps when data
arrives. The shimmer stops under `prefers-reduced-motion`; the blocks stay.

---

## Data

**One switch between fixtures and Postgres.** `lib/data/queries.ts` chooses an
implementation once; screens never learn which. This is what lets the product be
built and demoed before a database exists, and lets a sales demo run without
touching real data.

**Reads go through the service client with scoping in the query.** RLS is on for
every table and is the backstop for anything reaching Postgres another way — a
direct client call, a future mobile app — rather than the only thing standing
between two agencies' data.

**The creator index is shared across orgs; opinions about creators are not.** A
creator verified and scored once should not be re-verified by every agency that
finds them. `creator_notes` stay private to the agency that wrote them.

**Deterministic UUIDs in the seed.** Every seeded row's id is derived from its
demo id, so re-seeding updates rather than duplicates — which is how a pilot
environment gets reset between demos.

---

## Auth

**Reads run as the user, not the service role.** Before auth, every query used
the service client, which bypasses RLS — so RLS was decorative. Now the org app
reads through the user's own client and the database is the boundary. The
service client is reserved for webhooks, ledger posting and jobs.

**Sign-out is scoped to this browser.** Supabase defaults `signOut()` to global,
which revokes every session the person has anywhere. A test caught it: signing
out in one spec killed a parallel spec's session. Signing out on a laptop should
not sign you out on your phone; signing out everywhere is a separate, deliberate
action.

**Sign-in errors do not say whether the email exists.** Supabase's own message
distinguishes "no such user" from "wrong password", which is a way to enumerate
a platform's customers. One message covers both.

**The `next` parameter is validated.** Only same-origin paths are honoured. An
open redirect on a login form is what gives a phishing link its credibility.

**Sign-up is two steps.** The person, then the company. Agency and brand are
different products — wallet-per-client and a hidden margin versus one wallet and
no margin — and the choice is hard to undo, so it gets a screen that explains
the difference rather than a radio button in a long form.

**Org creation is all-or-nothing.** Org, founding membership and first space are
created together, rolling back on failure. A user left with an org they are not
a member of cannot see it, and an org with no space cannot hold money.

## Day 4 — creator onboarding

**Verification codes go over WhatsApp, not SMS.** The spec said SMS via Supabase
phone auth. Two things argued against it: the creator has just arrived from a
WhatsApp link, so it is the channel they already have open; and SMS delivery to
Nigerian networks is slow, expensive and silently lossy in a way that strands
people halfway through onboarding with no way to tell them why. The interface
does not care which channel carried the code, so SMS remains a fallback to add.

**Codes are ours rather than Supabase's.** Stored as keyed hashes, five attempts,
five sends an hour, ten-minute expiry, only the newest code valid. A six-digit
code is one-in-a-million once and one-in-two if you allow half a million tries,
so the attempt cap is the security property, not the length.

**Onboarding state lives on the creator, not the deal or a session.** So a
creator accepting their second deal is not asked for their bank details again,
and one whose phone died halfway resumes exactly where they stopped.

**The payout account is resolved to a name before it is saved.** A mistyped digit
is the commonest cause of a failed payout, and it fails after the work is done.
One extra confirmation tap moves that failure to a moment when it is cheap.

**Counter-offers do not change the fee.** They land in the agency's inbox as an
inbound message and move the deal to negotiating. A number becomes an offer when
a person approves it — the same rule that governs everything else sent on an
agency's behalf.

## Day 5 — drafts

**Uploads bypass the app server.** The server issues a signed URL for one object
path and the phone uploads straight to Storage. A 200MB video relayed through a
serverless function would be slow, costly, and would exceed the request body
limit long before it finished.

**Progress is XHR, not fetch.** `fetch` still cannot report upload progress. A
silent three-minute wait on a phone reads as a hang, so the bar is real.

**Not yet resumable.** The spec asked for resumable uploads and Supabase supports
TUS, but TUS needs a session-bearing credential and a creator authenticates with
an invite token rather than an account. The current flow keeps the chosen file on
failure so retrying is one tap. Proper resumability follows creator sessions.

**The drafts bucket is private.** An unapproved draft is unpublished work for a
brand that has not agreed to it being seen. Access is by short-lived signed URL,
so a link pasted into a group chat stops working before it spreads.

## Hosting

**Netlify rather than Vercel.** The founder's call; the spec said Vercel. Next 15
App Router, server actions and middleware are all supported. Two consequences
worth holding on to:

- Synchronous functions have a short ceiling (10s free, 26s Pro). Anything
  slower — shortlist generation, transcription, content review — has to be a
  Trigger.dev job rather than a request. That was already the design; Netlify
  makes it non-negotiable.
- Middleware runs on the edge runtime, not Node. The session refresh uses only
  fetch and cookies, which is safe there. Nothing needing a Node API may move
  into it.

## Still open
- **The manual deposit form** exists because Nigerian clients pay by bank
  transfer and someone must be able to record it. It is keyed on the bank
  reference so the same transfer cannot be recorded twice, but it is a
  privileged action that should be restricted by role once auth is wired.
- **`NEXT_PUBLIC_APP_URL` defaults to port 3000** while the dev server may pick
  another port. Invite links built in development can point at the wrong port.
