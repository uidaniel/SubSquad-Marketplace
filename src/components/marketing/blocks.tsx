import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  CircleHelp,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroReel } from "./hero-reel";
import { Display, Eyebrow, Wrap } from "./pieces";

/** In the order they play. Credits in public/video/CREDITS.md. */
const HERO_CLIPS = ["/video/hero-1.mp4", "/video/hero-2.mp4", "/video/hero-3.mp4", "/video/hero-4.mp4"] as const;

/**
 * The larger blocks of the public site — the parts that make a page feel
 * like a product rather than a brochure. Each is a picture of something the
 * platform actually does, drawn with the platform's own components.
 *
 * Colour is deliberate and small: cream, paper, ink, one tangerine, and the
 * four semantic tones the app already has. Nothing here has a hue the app
 * does not.
 */

/* --------------------------------------------------------------------------
   Small parts
   -------------------------------------------------------------------------- */

const TONES = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-ground text-ink-2",
  brand: "bg-brand/12 text-brand-ink",
} as const;

export function Chip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold",
        TONES[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

const AVATAR = {
  ink: "bg-ink text-[#fff3e6]",
  brand: "bg-brand text-[#fff3e6]",
  ok: "bg-ok text-white",
  info: "bg-info text-white",
  warn: "bg-warn text-white",
} as const;

export function Avatar({
  initials,
  tone = "ink",
  size = 34,
}: {
  initials: string;
  tone?: keyof typeof AVATAR;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold", AVATAR[tone])}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}

/** Paper card with a hairline. The workhorse. */
export function Card({
  className,
  children,
  flat,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  flat?: boolean;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-line",
        flat ? "bg-ink/[0.03]" : "bg-surface shadow-panel",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** A key/value row with a hairline above, like a line on a receipt. */
export function Row({
  k,
  v,
  tone,
  total,
}: {
  k: React.ReactNode;
  v: React.ReactNode;
  tone?: "ok" | "danger" | "muted";
  total?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0",
        total && "mt-1.5 border-t-[1.5px] border-ink/60 pt-3.5",
      )}
    >
      <span className={cn("text-[14px] text-ink-2", total && "font-medium text-ink")}>{k}</span>
      <span
        className={cn(
          "text-[15px] font-medium tabular-nums",
          tone === "ok" && "text-ok",
          tone === "danger" && "text-danger",
          tone === "muted" && "font-normal text-ink-3",
          total && "text-[22px] font-semibold tracking-[-0.03em]",
        )}
      >
        {v}
      </span>
    </div>
  );
}

export function Tick({ children, tone = "ok" }: { children: React.ReactNode; tone?: "ok" | "brand" }) {
  return (
    <li className="flex items-start gap-3 text-[15.5px] leading-relaxed">
      <span
        className={cn(
          "mt-1 grid size-5.5 shrink-0 place-items-center rounded-full border",
          tone === "ok" ? "border-ok/25 bg-ok-soft text-ok" : "border-brand/25 bg-brand/10 text-brand-ink",
        )}
      >
        <Check className="size-3.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function Ticks({ items, tone }: { items: readonly string[]; tone?: "ok" | "brand" }) {
  return (
    <ul className="mt-6 max-w-[48ch] space-y-3">
      {items.map((t) => (
        <Tick key={t} tone={tone}>
          {t}
        </Tick>
      ))}
    </ul>
  );
}

export function Meter({ value, tone = "ok" }: { value: number; tone?: "ok" | "warn" | "danger" }) {
  return (
    <span className="inline-block h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-ink/10 align-middle">
      <span
        data-meter={value}
        className={cn("block h-full rounded-full", tone === "ok" && "bg-ok", tone === "warn" && "bg-warn", tone === "danger" && "bg-danger")}
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

/** Section header: eyebrow, title, optional lede or action on the right. */
export function SectionHead({
  eyebrow,
  title,
  lede,
  action,
  center,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  action?: { href: string; label: string };
  center?: boolean;
}) {
  return (
    <div
      data-reveal
      className={cn(
        "mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-12",
        center && "flex-col items-center text-center",
      )}
    >
      <div className={cn(center && "flex flex-col items-center")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display as="h2" size="l" className={cn("mt-3 max-w-[22ch]", center && "mx-auto")}>
          {title}
        </Display>
      </div>
      {lede && <p className="max-w-[46ch] text-[16.5px] leading-relaxed text-ink-2">{lede}</p>}
      {action && (
        <Button variant="outline" asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

export function Section({
  className,
  tight,
  children,
}: {
  className?: string;
  tight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(tight ? "py-10 sm:py-14" : "py-16 sm:py-24", className)}>
      <Wrap>{children}</Wrap>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Video hero
   -------------------------------------------------------------------------- */

export function VideoHero({
  eyebrow,
  title,
  lede,
  ticks,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  ticks: readonly string[];
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-[#fff3e6]">
      {/* The film: four clips, each fading into the next. See hero-reel.tsx. */}
      <HeroReel clips={HERO_CLIPS} poster="/video/hero.jpg" />
      {/* Ink over the film, heavier at the edges, so cream text reads
          everywhere and the video is texture, not subject. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,15,26,.78) 0%, rgba(11,15,26,.62) 45%, rgba(11,15,26,.92) 100%)",
        }}
      />
      <Wrap className="flex flex-col items-center py-20 text-center sm:py-28 lg:py-32">
        <p data-hero className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#fff3e6]/75">
          {eyebrow}
        </p>
        <h1
          data-hero
          className="mt-5 max-w-[16ch] font-display text-[clamp(40px,7vw,88px)] font-bold leading-[0.98] tracking-[-0.04em] text-white"
        >
          {title}
        </h1>
        <p data-hero className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[#fff3e6]/80 sm:text-[19px]">
          {lede}
        </p>
        {children && (
          <div data-hero className="mt-9 w-full max-w-[720px]">
            {children}
          </div>
        )}
        <ul data-hero className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3">
          {ticks.map((t) => (
            <li key={t} className="flex items-center gap-2 text-[15px] font-medium text-[#fff3e6]/90">
              <Check className="size-4 text-brand" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}

/** Budget in, creators out. A GET form, so it works before any script runs. */
export function Actionbar() {
  return (
    <form
      action="/signup"
      method="get"
      className="mx-auto flex w-full max-w-[680px] flex-col gap-2 rounded-[28px] border border-white/15 bg-white/10 p-2 backdrop-blur-md sm:flex-row sm:items-center sm:rounded-full"
    >
      <label className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2 sm:py-0">
        <span className="text-[19px] font-semibold text-[#fff3e6]/70" aria-hidden>
          ₦
        </span>
        <span className="sr-only">Campaign budget</span>
        <input
          name="budget"
          inputMode="numeric"
          placeholder="500,000"
          className="h-10 w-full bg-transparent text-[17px] font-medium text-white placeholder:text-[#fff3e6]/45 focus:outline-none"
        />
      </label>
      <span className="hidden h-7 w-px bg-white/15 sm:block" aria-hidden />
      <label className="relative flex items-center px-4 py-2 sm:py-0">
        <span className="sr-only">Platform</span>
        <select
          name="platform"
          defaultValue="both"
          className="h-10 w-full appearance-none bg-transparent pr-6 text-[15px] font-medium text-white focus:outline-none sm:w-auto"
        >
          <option value="both" className="text-ink">TikTok &amp; Instagram</option>
          <option value="tiktok" className="text-ink">TikTok</option>
          <option value="instagram" className="text-ink">Instagram</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 size-4 text-[#fff3e6]/60" aria-hidden />
      </label>
      <Button variant="brand" size="lg" type="submit" className="rounded-full sm:h-12">
        Find my creators <ArrowRight />
      </Button>
    </form>
  );
}

/* --------------------------------------------------------------------------
   Product shot — the shortlist and the escrow panel, as a window.
   -------------------------------------------------------------------------- */

const SHOT = [
  { i: "CO", tone: "info", h: "@chideraskits", meta: "TikTok · Lagos", sub: "128k · 7.4% engagement", score: 92, meter: 92, tone2: "ok" },
  { i: "HI", tone: "ok", h: "@hauwacooks", meta: "TikTok · Abuja", sub: "204k · 9.2% engagement", score: 96, meter: 96, tone2: "ok" },
  { i: "BA", tone: "warn", h: "@boluexplains", meta: "Instagram · Ibadan", sub: "64k · 5.1% engagement", score: 74, meter: 74, tone2: "warn" },
  { i: "KE", tone: "brand", h: "@kemiglows", meta: "excluded", sub: "72% of engagement outside Nigeria", score: 34, meter: 34, tone2: "danger" },
] as const;

export function ProductShot() {
  return (
    <div data-reveal className="mx-auto -mt-10 w-full max-w-[1040px] px-5 sm:-mt-14 sm:px-8 lg:-mt-16">
      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface shadow-lift">
        <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-3">
          <span className="size-2.5 rounded-full bg-ink/15" />
          <span className="size-2.5 rounded-full bg-ink/15" />
          <span className="size-2.5 rounded-full bg-ink/15" />
          <span className="ml-2 text-[12.5px] text-ink-3">subsquad.ng · Detty December · PalmPay</span>
        </div>
        <div className="grid md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="border-b border-line p-5 sm:p-6 md:border-b-0 md:border-r">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold">AI shortlist</p>
                <p className="text-[12.5px] text-ink-3">18 suggested from 412 screened · 15 slots</p>
              </div>
              <Chip tone="warn">Awaiting your approval</Chip>
            </div>
            <ul className="mt-4 divide-y divide-line">
              {SHOT.map((r) => (
                <li key={r.h} className={cn("flex items-center gap-3 py-3", r.score < 60 && "opacity-45")}>
                  <Avatar initials={r.i} tone={r.tone} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]">
                      <b className="font-semibold">{r.h}</b> <span className="text-ink-3">· {r.meta}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-2">{r.sub}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Meter value={r.meter} tone={r.tone2} />
                    <b className={cn("text-[13px] tabular-nums", r.tone2 === "warn" && "text-warn", r.tone2 === "danger" && "text-danger")}>
                      {r.score}
                    </b>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-[var(--radius-md)] bg-ink/[0.035] p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-info">
                <Sparkles className="size-4" /> Why Chidera
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                Lagos skit creator. Three prior fintech collabs, all disclosed correctly. Switches English and
                Pidgin in one video. Accepted ₦82,000 for a comparable deal last month.
              </p>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-[12.5px] text-ink-3">Held in escrow</p>
            <p className="mt-1 font-display text-[38px] font-semibold leading-none tracking-[-0.035em] tabular-nums">
              ₦4,500,000
            </p>
            <div className="mt-3">
              <Row k="Locked to 14 deals" v="₦1,860,000" />
              <Row k="Paid, 9 creators" v="₦1,120,000" tone="ok" />
              <Row k="Available" v="₦1,520,000" />
            </div>
            <p className="mt-5 text-[13px] font-semibold">Stage</p>
            <ul className="mt-2 space-y-2.5 text-[14px]">
              {[
                ["Funding", "done"],
                ["Shortlist", "done"],
                ["Outreach", "now"],
                ["Content", "later"],
                ["Live", "later"],
                ["Paid", "later"],
              ].map(([s, st]) => (
                <li key={s} className={cn("flex items-center gap-2.5", st === "later" && "opacity-40")}>
                  {st === "done" ? (
                    <Check className="size-4 text-ok" />
                  ) : st === "now" ? (
                    <span className="size-4 rounded-full border-[4px] border-brand" />
                  ) : (
                    <span className="size-4 rounded-full border-[1.5px] border-ink/30" />
                  )}
                  <span className={cn(st === "now" && "font-semibold")}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Marquees
   -------------------------------------------------------------------------- */

const PAYOUTS = [
  ["CO", "info", "Chidera O.", "₦60,000"],
  ["HI", "ok", "Hauwa I.", "₦120,000"],
  ["TE", "ink", "Tunde E.", "₦145,000"],
  ["AU", "warn", "Amaka U.", "₦210,000"],
  ["BA", "brand", "Bolu A.", "₦96,000"],
  ["IM", "ok", "Ifeanyi M.", "₦48,000"],
  ["ZK", "info", "Zainab K.", "₦88,000"],
  ["OS", "ink", "Ope S.", "₦132,000"],
] as const;

/** A row of payouts sliding by. Every one is what a paid deal looks like. */
export function Ticker() {
  const items = [...PAYOUTS, ...PAYOUTS];
  return (
    <section className="border-y border-line bg-surface-2 py-6">
      <Wrap className="mb-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink-2">
          <span className="size-2 rounded-full bg-ok" aria-hidden /> Paid
        </span>
        <p className="text-[14px] text-ink-2">
          <b className="font-semibold text-ink">Illustrative</b> — the eight deals in the demo workspace, as they land in a creator&rsquo;s bank.
        </p>
      </Wrap>
      <div className="marquee">
        <div className="marquee-track">
          {items.map(([i, tone, name, amt], idx) => (
            <span
              key={`${name}-${idx}`}
              className="inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full border border-line bg-surface py-0 pl-2 pr-4"
            >
              <Avatar initials={i} tone={tone} size={30} />
              <span className="text-[14px] font-medium">{name}</span>
              <span className="size-1 rounded-full bg-ink/25" aria-hidden />
              <span className="text-[14px] font-semibold tabular-nums">{amt}</span>
              <span className="ml-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ok">
                <span className="size-1.5 rounded-full bg-ok" aria-hidden /> Paid
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Wordmarks sliding by. Only things that are true: where the money lands. */
export function Rail({ label, items }: { label: string; items: readonly string[] }) {
  const list = [...items, ...items];
  return (
    <section className="py-10">
      <p className="mb-4 text-center text-[12.5px] text-ink-3">{label}</p>
      <div className="marquee">
        <div className="marquee-track marquee-slow">
          {list.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="shrink-0 px-6 font-display text-[20px] font-semibold tracking-[-0.02em] text-ink/45"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Posters — the three decisions, in ink, cream and tangerine.
   -------------------------------------------------------------------------- */

const POSTER = {
  ink: "bg-ink text-[#fff3e6]",
  cream: "bg-[#ffe6cf] text-ink",
  brand: "bg-brand-strong text-[#fff3e6]",
} as const;

export function Posters({
  items,
}: {
  items: readonly { n: string; title: string; body: string; tone: keyof typeof POSTER }[];
}) {
  return (
    <div data-reveal-group className="grid gap-5 md:grid-cols-3">
      {items.map((p) => (
        <article
          key={p.n}
          className={cn(
            "relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[28px] p-7 transition-transform duration-300 ease-[cubic-bezier(.2,0,0,1)] hover:-translate-y-1.5",
            POSTER[p.tone],
          )}
        >
          <span
            aria-hidden
            className="absolute left-5 top-2 font-display text-[clamp(88px,9vw,132px)] font-bold leading-none tracking-[-0.06em] opacity-25"
          >
            {p.n}
          </span>
          <h3 className="font-display text-[clamp(28px,2.7vw,40px)] font-bold leading-[1.02] tracking-[-0.035em]">
            {p.title}
          </h3>
          <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed opacity-80">{p.body}</p>
        </article>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Reel — the creator wall. 9:16 slots; a video fills one when it exists.
   -------------------------------------------------------------------------- */

const WALL = [
  { i: "CO", tone: "info", name: "Chidera O.", niche: "Skits · Lagos", plat: "128k TikTok", amt: "₦60,000", note: "Paid 3 days after posting" },
  { i: "HI", tone: "ok", name: "Hauwa I.", niche: "Food · Abuja", plat: "204k TikTok", amt: "₦120,000", note: "Paid 2 days after posting" },
  { i: "TE", tone: "ink", name: "Tunde E.", niche: "Tech · Lagos", plat: "96k Instagram", amt: "₦145,000", note: "Paid 4 days after posting" },
  { i: "AU", tone: "warn", name: "Amaka U.", niche: "Food · Enugu", plat: "71k TikTok", amt: "₦210,000", note: "Three videos · one contract" },
  { i: "ZK", tone: "brand", name: "Zainab K.", niche: "Beauty · Kano", plat: "58k Instagram", amt: "₦88,000", note: "Her own brand deal, escrowed" },
  { i: "IM", tone: "ok", name: "Ifeanyi M.", niche: "Comedy · PH", plat: "112k TikTok", amt: "₦48,000", note: "Paid same day as approval" },
] as const;

const SLOT = ["bg-ink text-[#fff3e6]", "bg-[#ffe6cf] text-ink", "bg-brand-strong text-[#fff3e6]"];

export function Reel() {
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {WALL.map((c, i) => (
        <article
          key={c.name}
          data-reveal
          className={cn(
            "relative flex aspect-[9/16] w-[clamp(220px,23vw,300px)] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[26px] p-5 shadow-lift transition-transform duration-300 ease-[cubic-bezier(.2,0,0,1)] hover:-translate-y-1.5",
            SLOT[i % 3],
          )}
        >
          <div className="flex items-center justify-between text-[13px] font-semibold">
            <span>{c.name}</span>
            <span className="opacity-70">{c.plat}</span>
          </div>
          <Avatar initials={c.i} tone={c.tone} size={64} />
          <div>
            <p className="font-display text-[30px] font-bold leading-none tracking-[-0.035em] tabular-nums">{c.amt}</p>
            <p className="mt-2 text-[13px] leading-snug opacity-80">
              {c.niche} · {c.note}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold opacity-85">
              <ShieldCheck className="size-3.5" /> Verified · on time
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Feature — a split with a proof card on one side.
   -------------------------------------------------------------------------- */

export function Feature({
  eyebrow,
  title,
  lede,
  ticks,
  proof,
  reverse,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  ticks?: readonly string[];
  proof: React.ReactNode;
  reverse?: boolean;
  action?: { href: string; label: string };
}) {
  return (
    <div className={cn("grid items-center gap-10 lg:grid-cols-2 lg:gap-16", reverse && "lg:[&>*:first-child]:order-2")}>
      <div data-reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display as="h2" size="l" className="mt-3 max-w-[18ch]">
          {title}
        </Display>
        <p className="mt-4 max-w-[46ch] text-[16.5px] leading-relaxed text-ink-2">{lede}</p>
        {ticks && <Ticks items={ticks} />}
        {action && (
          <Button variant="outline" className="mt-6" asChild>
            <Link href={action.href}>
              {action.label} <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
      <div data-reveal className="min-w-0">
        {proof}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Proof cards — vetting, outreach, review.
   -------------------------------------------------------------------------- */

export function ScoreCard({
  handle,
  meta,
  initials,
  tone,
  score,
  verdict,
  verdictTone,
  line,
  checks,
  note,
}: {
  handle: string;
  meta: string;
  initials: string;
  tone: keyof typeof AVATAR;
  score: number;
  verdict: string;
  verdictTone: "ok" | "danger";
  line: string;
  checks: readonly { label: string; detail: string; state: "ok" | "warn" | "danger"; meter?: number }[];
  note?: string;
}) {
  const offset = Math.round(226 - (226 * score) / 100);
  return (
    <Card className="mx-auto max-w-[460px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} tone={tone} />
          <span>
            <b className="block text-[14.5px] font-semibold">{handle}</b>
            <span className="text-[12.5px] text-ink-3">{meta}</span>
          </span>
        </div>
        <Chip tone={verdictTone}>{verdict}</Chip>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-5">
          <span className="relative size-[84px] shrink-0">
            <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
              <circle cx="42" cy="42" r="36" fill="none" stroke="rgba(11,15,26,.09)" strokeWidth="8" />
              <circle
                data-ring={offset}
                cx="42"
                cy="42"
                r="36"
                fill="none"
                className={verdictTone === "ok" ? "stroke-ok" : "stroke-danger"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="226"
                strokeDashoffset={offset}
              />
            </svg>
            <span className={cn("absolute inset-0 grid place-items-center text-[24px] font-semibold tabular-nums tracking-[-0.04em]", verdictTone === "danger" && "text-danger")}>
              {score}
            </span>
          </span>
          <span>
            <p className="text-[14.5px] font-semibold">Fraud and quality score</p>
            <p className="mt-0.5 text-[12.5px] text-ink-3">{line}</p>
          </span>
        </div>
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2.5 py-2.5 text-[14px]">
              {c.state === "ok" ? (
                <Check className="size-4 shrink-0 text-ok" />
              ) : c.state === "warn" ? (
                <CircleHelp className="size-4 shrink-0 text-warn" />
              ) : (
                <X className="size-4 shrink-0 text-danger" />
              )}
              <span className="flex-1">
                {c.label} <span className="text-ink-3">· {c.detail}</span>
              </span>
              {c.meter !== undefined && <Meter value={c.meter} tone={c.state} />}
            </li>
          ))}
        </ul>
        {note && <p className="mt-4 rounded-[var(--radius-md)] bg-ink/[0.035] p-3.5 text-[13px] leading-relaxed text-ink-2">{note}</p>}
      </div>
    </Card>
  );
}

/** The first message a creator gets: a proposal by email, fee held, one link. */
export function ProposalCard() {
  return (
    <Card className="mx-auto max-w-[460px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[10px] bg-ok-soft text-ok">
            <Mail className="size-4" />
          </span>
          <span>
            <b className="block text-[14.5px] font-semibold">Email · Chidera O.</b>
            <span className="text-[12.5px] text-ink-3">Sent after you approved the shortlist</span>
          </span>
        </div>
        <Chip tone="info">Proposal</Chip>
      </div>
      <div className="space-y-3 bg-ink/[0.022] p-5 text-[13.5px] leading-relaxed">
        <div className="rounded-2xl rounded-br-[5px] bg-brand-strong px-4 py-3 text-[#fff3e6]">
          <p className="font-semibold">Sweet Sensation wants a TikTok video from you.</p>
          <p className="mt-1 opacity-90">
            The fee for it is already held with SubSquad. Open the proposal to see the brief, the dates and the
            amount, then accept — or name your own rate.
          </p>
        </div>
        <p className="text-right text-[12px] text-ink-3">09:14 · approved by Ada N.</p>
        <div className="max-w-[88%] rounded-2xl rounded-bl-[5px] bg-ink/5 px-4 py-3">
          Is the money really there? I&rsquo;ve been messed around before.
        </div>
        <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-[5px] border border-dashed border-ink/30 px-4 py-3">
          <p className="mb-1.5 text-[12px] font-semibold text-ink-2">Draft — approve to send</p>
          It is, and it was paid in before we wrote to you. The proposal shows the amount held and the date.
          <div className="mt-3 flex gap-2">
            <span className="inline-flex h-8 items-center rounded-[var(--radius-sm)] bg-ink px-3 text-[12.5px] font-medium text-white">
              Approve and send
            </span>
            <span className="inline-flex h-8 items-center rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 text-[12.5px] font-medium">
              Edit
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** A draft, checked against the brief before the brand sees it. */
export function ReviewCard() {
  return (
    <Card className="mx-auto max-w-[460px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <span>
          <b className="block text-[14.5px] font-semibold">Draft 1 · Chidera O.</b>
          <span className="text-[12.5px] text-ink-3">Jollof Week · Sweet Sensation</span>
        </span>
        <Chip tone="warn">Needs changes</Chip>
      </div>
      <div className="p-5">
        <div className="flex aspect-video items-center justify-center gap-2.5 rounded-[var(--radius-md)] bg-ink text-[14px] text-[#fff3e6]/50">
          <span className="grid size-9 place-items-center rounded-full bg-white/10">
            <span className="ml-0.5 border-y-[6px] border-l-[10px] border-y-transparent border-l-[#fff3e6]/70" />
          </span>
          0:34 · TikTok video
        </div>
        <div className="mt-4 rounded-[var(--radius-md)] bg-ink/[0.035] p-4">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-info">
            <Sparkles className="size-4" /> What we checked
          </p>
          <ul className="mt-2.5 space-y-2 text-[13.5px] leading-snug">
            <li className="flex gap-2">
              <X className="mt-0.5 size-4 shrink-0 text-danger" /> Download link missing from bio
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" /> &ldquo;No transfer fees&rdquo; spoken at 0:07
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" /> #Ad disclosure in the first caption line
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------------------
   Pricing band — the page's one ink section.
   -------------------------------------------------------------------------- */

export function PriceBand() {
  return (
    <section className="bg-chrome py-16 text-chrome-ink sm:py-24">
      <Wrap>
        <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#fff3e6]/70">Pricing</p>
            <h2 className="mt-3 max-w-[18ch] font-display text-[clamp(32px,4.4vw,60px)] font-bold leading-[1] tracking-[-0.04em] text-white">
              You pay when a deal completes. <span className="text-brand">Nothing else.</span>
            </h2>
          </div>
          <p className="max-w-[40ch] text-[16px] text-[#fff3e6]/75">No subscription. No &ldquo;book a demo to see pricing&rdquo;.</p>
        </div>
        <div data-reveal-group className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            ["12", "%", "On campaign deals."],
            ["6", "%", "On deals a creator brings in."],
            ["0", "", "What creators pay. Forever.", "₦"],
          ].map(([n, suffix, note, prefix]) => (
            <div key={note} className="border-l border-white/15 pl-5">
              <p
                data-count={n}
                data-suffix={suffix}
                data-prefix={prefix ?? ""}
                className="font-display text-[clamp(44px,5.6vw,72px)] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white"
              >
                {prefix}
                {n}
                {suffix}
              </p>
              <p className="mt-3 text-[15px] text-[#fff3e6]/75">{note}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div data-reveal>
            <h3 className="max-w-[18ch] font-display text-[clamp(26px,3vw,42px)] font-bold leading-[1.05] tracking-[-0.035em] text-white">
              Nobody is contacted until the money is <span className="text-brand">already there.</span>
            </h3>
            <ul className="mt-6 max-w-[46ch] space-y-3 text-[15.5px] leading-relaxed text-[#fff3e6]/85">
              {[
                "Held in naira. No FX risk on payout day.",
                "A cancelled campaign returns its escrow to your wallet, in full, at once.",
                "A creator who does not deliver is never paid — the money stays yours.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1 grid size-5.5 shrink-0 place-items-center rounded-full bg-white/10 text-brand">
                    <Check className="size-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-7 border-white/20 bg-transparent text-white hover:bg-white/10" asChild>
              <Link href="/trust">How escrow works</Link>
            </Button>
          </div>
          <div data-reveal className="w-full max-w-[460px] justify-self-center rounded-[var(--radius-xl)] border border-white/12 bg-white/[0.06]">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <span className="text-[12.5px] text-[#fff3e6]/60">Deal receipt · SSQ-4471-07</span>
              <Chip tone="ok">Funds held</Chip>
            </div>
            <div className="border-t border-white/10 px-5 py-5">
              <p className="text-[12.5px] text-[#fff3e6]/60">Chidera O. · 1 TikTok video · due 24 Sep</p>
              <dl className="mt-3 divide-y divide-white/10 text-[14.5px]">
                {[
                  ["Creator fee", "₦60,000"],
                  ["Agency margin, 15%", "₦9,000"],
                  ["SubSquad fee, 12%", "₦7,200"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2.5">
                    <dt className="text-[#fff3e6]/70">{k}</dt>
                    <dd className="font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between border-t border-white/40 pt-3.5">
                  <dt className="font-medium">Charged to the client</dt>
                  <dd className="text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-white">₦76,200</dd>
                </div>
              </dl>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
              <span className="text-[14px] font-semibold">Creator receives</span>
              <span className="text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-white">₦60,000</span>
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Steps — brief to payout, as a timeline rather than a video that does not
   exist yet.
   -------------------------------------------------------------------------- */

export function Steps({ items }: { items: readonly { t: string; title: string; body: string }[] }) {
  return (
    <ol data-reveal-group className="grid gap-4 md:grid-cols-3">
      {items.map((s, i) => (
        <li key={s.title} className="relative rounded-[var(--radius-xl)] border border-line bg-surface p-5">
          <span className="text-[12px] font-semibold tabular-nums text-brand-ink">{s.t}</span>
          <p className="mt-2 text-[16px] font-semibold tracking-[-0.01em]">{s.title}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{s.body}</p>
          <span className="absolute right-4 top-4 grid size-7 place-items-center rounded-full bg-ink text-[12px] font-semibold text-[#fff3e6]">
            {i + 1}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* --------------------------------------------------------------------------
   Cases — three campaigns, by the numbers. Labelled for what they are.
   -------------------------------------------------------------------------- */

export function CaseCards({
  items,
}: {
  items: readonly {
    brand: string;
    status: string;
    statusTone: "ok" | "info";
    meta: string;
    name: string;
    brief: string;
    stat: string;
    statNote: string;
    rows: readonly [string, string, ("ok" | "danger")?][];
  }[];
}) {
  return (
    <div data-reveal-group className="grid gap-5 md:grid-cols-3">
      {items.map((c) => (
        <article key={c.name} className="flex flex-col rounded-[var(--radius-xl)] border border-line bg-surface p-6 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-[17px] font-semibold tracking-[-0.02em]">{c.brand}</span>
            <Chip tone={c.statusTone}>{c.status}</Chip>
          </div>
          <p className="mt-3 text-[12.5px] text-ink-3">{c.meta}</p>
          <p className="mt-1 text-[16px] font-semibold">{c.name}</p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
            <span className="text-ink-3">The brief:</span> {c.brief}
          </p>
          <div className="mt-4 rounded-[var(--radius-md)] border border-brand/15 bg-brand/[0.06] p-4">
            <p className="font-display text-[40px] font-semibold leading-none tracking-[-0.04em] text-brand-ink">{c.stat}</p>
            <p className="mt-1 text-[12.5px] text-ink-2">{c.statNote}</p>
          </div>
          <div className="mt-4">
            {c.rows.map(([k, v, tone]) => (
              <Row key={k} k={k} v={v} tone={tone} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Compare — a global platform against this one.
   -------------------------------------------------------------------------- */

export function Compare({ rows }: { rows: readonly [string, string, string][] }) {
  return (
    <div data-reveal className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface-2 shadow-panel">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[15px]">
          <thead>
            <tr className="text-[13px] font-semibold text-ink-2">
              <th className="w-[22%] px-5 py-4" />
              <th className="w-[39%] px-5 py-4">A global creator platform</th>
              <th className="w-[39%] bg-surface px-5 py-4">
                <span className="inline-flex items-center gap-2 text-ink">
                  <span className="grid size-6 place-items-center rounded-[7px] bg-brand font-display text-[10px] font-bold text-[#fff3e6]">SS</span>
                  SubSquad
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, them, us]) => (
              <tr key={k} className="border-t border-line align-top">
                <td className="px-5 py-3.5 text-ink-2">{k}</td>
                <td className="px-5 py-3.5">{them}</td>
                <td className="bg-surface px-5 py-3.5 font-medium">{us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Ways in, FAQ, KPIs, closing poster.
   -------------------------------------------------------------------------- */

export function Ways({
  items,
}: {
  items: readonly { href: string; icon: React.ReactNode; title: string; body: string; cta: string }[];
}) {
  return (
    <div data-reveal-group className="grid gap-5 md:grid-cols-3">
      {items.map((w) => (
        <Link
          key={w.href}
          href={w.href}
          className="group flex flex-col rounded-[var(--radius-xl)] border border-line bg-surface p-6 shadow-panel transition-transform duration-300 ease-[cubic-bezier(.2,0,0,1)] hover:-translate-y-1"
        >
          <span className="grid size-11 place-items-center rounded-[14px] border border-brand/15 bg-brand/10 text-brand-ink">{w.icon}</span>
          <h3 className="mt-4 font-display text-[22px] font-semibold tracking-[-0.02em]">{w.title}</h3>
          <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-2">{w.body}</p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-brand-ink">
            {w.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function Faq({
  eyebrow,
  title,
  items,
  aside,
}: {
  eyebrow: string;
  title: React.ReactNode;
  items: readonly { q: string; a: string }[];
  aside?: React.ReactNode;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
      <div data-reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display as="h2" size="l" className="mt-3">
          {title}
        </Display>
        {aside}
      </div>
      <div data-reveal-group className="space-y-3">
        {items.map((item, i) => (
          <details key={item.q} open={i === 0} className="faq group rounded-[var(--radius-lg)] border border-line bg-surface px-6 py-5 open:shadow-panel">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-5 text-[17px] font-medium leading-snug tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
              {item.q}
              <span className="text-[24px] font-normal leading-none text-ink-3 group-open:text-brand-ink" aria-hidden>
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">–</span>
              </span>
            </summary>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

export function Kpis({ items }: { items: readonly { n: string; suffix?: string; prefix?: string; note: string }[] }) {
  return (
    <div data-reveal-group className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.note} className="rounded-[var(--radius-xl)] border border-line bg-surface p-6 shadow-panel">
          <p
            data-count={k.n}
            data-suffix={k.suffix ?? ""}
            data-prefix={k.prefix ?? ""}
            className="font-display text-[clamp(34px,3.6vw,48px)] font-semibold leading-none tracking-[-0.04em] tabular-nums text-brand-ink"
          >
            {k.prefix}
            {k.n}
            {k.suffix}
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{k.note}</p>
        </div>
      ))}
    </div>
  );
}

/** A path: what happened to one fee, step by step. */
export function Path({ title, steps }: { title: string; steps: readonly { title: string; meta: string; now?: boolean }[] }) {
  return (
    <Card className="p-6">
      <p className="text-[14.5px] font-semibold">{title}</p>
      <ol className="mt-4 space-y-4">
        {steps.map((s) => (
          <li key={s.title} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-full",
                s.now ? "border-[4px] border-brand" : "bg-ok-soft text-ok",
              )}
            >
              {!s.now && <Check className="size-3.5" />}
            </span>
            <span>
              <span className={cn("block text-[14.5px]", s.now && "font-semibold")}>{s.title}</span>
              <span className="block text-[12.5px] text-ink-3">{s.meta}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function KeepDrop({
  keepTitle,
  keep,
  dropTitle,
  drop,
}: {
  keepTitle: string;
  keep: readonly [string, string][];
  dropTitle: string;
  drop: readonly [string, string][];
}) {
  return (
    <div data-reveal-group className="grid gap-5 md:grid-cols-2">
      <Card className="p-6">
        <p className="mb-4 flex items-center gap-2.5 text-[17px] font-semibold">
          <span className="grid size-8 place-items-center rounded-[10px] bg-ok-soft text-ok">
            <Check className="size-4" />
          </span>
          {keepTitle}
        </p>
        {keep.map(([k, v]) => (
          <Row key={k} k={k} v={v} />
        ))}
      </Card>
      <Card flat className="p-6">
        <p className="mb-4 flex items-center gap-2.5 text-[17px] font-semibold">
          <span className="grid size-8 place-items-center rounded-[10px] bg-danger-soft text-danger">
            <X className="size-4" />
          </span>
          {dropTitle}
        </p>
        {drop.map(([k, v]) => (
          <Row key={k} k={k} v={v} tone="muted" />
        ))}
      </Card>
    </div>
  );
}

export function Promises({ items }: { items: readonly { icon: React.ReactNode; title: string; body: string }[] }) {
  return (
    <div data-reveal-group className="grid gap-5 md:grid-cols-2">
      {items.map((p) => (
        <Card key={p.title} className="flex gap-4 p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-ok-soft text-ok">{p.icon}</span>
          <span>
            <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{p.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{p.body}</p>
          </span>
        </Card>
      ))}
    </div>
  );
}

const TRUST_ICONS = { lock: Lock, ban: Ban, shield: ShieldCheck, refresh: RefreshCw } as const;

export function ClosingPoster({
  eyebrow,
  title,
  lede,
  primary,
  secondary,
  trust,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  trust?: readonly { icon: keyof typeof TRUST_ICONS; label: string }[];
}) {
  return (
    <section className="pb-20 pt-6 sm:pb-28">
      <Wrap>
        <div
          data-reveal
          className="relative overflow-hidden rounded-[36px] bg-brand-strong px-7 py-16 text-center text-[#fff3e6] sm:py-24"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-white/10 blur-3xl"
          />
          {eyebrow && <p className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#fff3e6]/80">{eyebrow}</p>}
          <h2 className="mx-auto mt-4 max-w-[14ch] font-display text-[clamp(36px,6vw,84px)] font-bold leading-[0.98] tracking-[-0.04em] text-white">
            {title}
          </h2>
          <p className="mx-auto mt-5 max-w-[42ch] text-[17px] leading-relaxed text-[#fff3e6]/88">{lede}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="bg-ink text-white hover:bg-ink/90" asChild>
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
            {secondary && (
              <Button size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" asChild>
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            )}
          </div>
          {trust && (
            <ul className="mt-10 flex flex-wrap justify-center gap-x-7 gap-y-3 text-[14px] text-[#fff3e6]/90">
              {trust.map((t) => {
                const Icon = TRUST_ICONS[t.icon];
                return (
                  <li key={t.label} className="inline-flex items-center gap-2">
                    <Icon className="size-4" /> {t.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Wrap>
    </section>
  );
}
