"use client";

import * as React from "react";
import { Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { formatNaira, parseNairaInput } from "@/lib/money";

const PLATFORM_FEE_BPS = 600;
const MINIMUM_KOBO = 2_000_000; // ₦20,000

/**
 * A creator bringing their own brand deal onto the platform.
 *
 * The one thing this screen must get right is who pays the fee. A creator who
 * has already agreed ₦150,000 with a brand will not go back and ask for more,
 * so the default is that the brand pays on top — and the screen shows both
 * figures at once so the choice is made with the numbers visible, not after.
 */
export function NewDealForm({ unfundedCount, cap }: { unfundedCount: number; cap: number }) {
  const [feeText, setFeeText] = React.useState("");
  const [feePaidBy, setFeePaidBy] = React.useState<"brand" | "creator">("brand");

  const feeKobo = parseNairaInput(feeText);
  const valid = feeKobo !== null && feeKobo >= MINIMUM_KOBO;
  const platformFee = feeKobo ? Math.floor((feeKobo * PLATFORM_FEE_BPS) / 10_000) : 0;
  const brandPays = feePaidBy === "brand" ? (feeKobo ?? 0) + platformFee : (feeKobo ?? 0);
  const youGet = feePaidBy === "brand" ? (feeKobo ?? 0) : (feeKobo ?? 0) - platformFee;

  const atCap = unfundedCount >= cap;

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      {atCap && (
        <p className="rounded-[var(--radius-sm)] bg-warn-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-warn">
          You have {unfundedCount} deals waiting to be funded, which is the limit.
          Once one of them is paid or cancelled you can create another.
        </p>
      )}

      <Field label="Brand name" htmlFor="brand">
        <Input id="brand" name="brand" placeholder="e.g. Chicken Republic" required />
      </Field>

      <Field
        label="Their email"
        hint="We send the payment link here. They do not need an account."
        htmlFor="email"
      >
        <Input id="email" name="email" type="email" placeholder="marketing@brand.com" required />
      </Field>

      <Field label="Their phone number" hint="Optional — we send one reminder." htmlFor="phone">
        <Input id="phone" name="phone" type="tel" placeholder="+234" />
      </Field>

      <Field label="What you will make" htmlFor="deliverable">
        <Select id="deliverable" name="deliverable" defaultValue="tiktok_video">
          <option value="tiktok_video">1 TikTok video</option>
          <option value="ig_reel">1 Instagram reel</option>
          <option value="ig_story">Instagram stories</option>
          <option value="yt_short">1 YouTube short</option>
          <option value="x_post">1 X post</option>
        </Select>
      </Field>

      <Field
        label="Your fee"
        hint={`What you and the brand agreed. Minimum ${formatNaira(MINIMUM_KOBO)}.`}
        htmlFor="fee"
        error={
          feeText && !valid
            ? feeKobo === null
              ? "Enter an amount, like 150,000"
              : `The minimum deal is ${formatNaira(MINIMUM_KOBO)}`
            : undefined
        }
      >
        <MoneyInput
          id="fee"
          name="fee"
          placeholder="150,000"
          value={feeText}
          onChange={(e) => setFeeText(e.target.value)}
        />
      </Field>

      <Field label="Who pays the SubSquad fee?" hint="6% on deals you bring in.">
        <div className="space-y-2">
          <FeeChoice
            checked={feePaidBy === "brand"}
            onSelect={() => setFeePaidBy("brand")}
            title="The brand pays it on top"
            detail="They are invoiced for your fee plus 6%. You receive your full fee."
          />
          <FeeChoice
            checked={feePaidBy === "creator"}
            onSelect={() => setFeePaidBy("creator")}
            title="Take it out of my fee"
            detail="The brand pays exactly what you agreed, and 6% comes out of it."
          />
        </div>
      </Field>

      <Field label="Deadline" htmlFor="deadline">
        <Input id="deadline" name="deadline" type="date" required />
      </Field>

      <Field
        label="Anything they specifically asked for"
        hint="We check your content against this before they see it."
        htmlFor="requirements"
      >
        <Textarea
          id="requirements"
          name="requirements"
          placeholder="e.g. show the packaging, say 'buy one get one free', do not mention competitors"
        />
      </Field>

      {/* The numbers, before they commit to them. */}
      {valid && (
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <Row label="The brand pays" value={formatNaira(brandPays)} />
          <Row label="SubSquad fee (6%)" value={formatNaira(platformFee)} muted />
          <div className="mt-2 border-t border-ink pt-2.5">
            <Row label="You receive" value={formatNaira(youGet)} strong />
          </div>
          <p className="mt-3 flex gap-2 text-[12.5px] leading-relaxed text-ink-2">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-ok" />
            Nothing is owed until they pay. We hold their money and release it to you
            once your post is live.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        You will see the contract before anything is sent. The brand gets a link to
        review the terms and pay into escrow — they can pay half now and half later.
      </div>

      <Button variant="brand" size="lg" block type="submit" disabled={!valid || atCap}>
        Preview the contract
      </Button>
    </form>
  );
}

function FeeChoice({
  checked,
  onSelect,
  title,
  detail,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-[var(--radius-sm)] border p-3 transition-colors ${
        checked ? "border-ink bg-surface" : "border-line bg-surface"
      }`}
    >
      <input
        type="radio"
        name="feePaidBy"
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]"
      />
      <span>
        <span className="block text-[13.5px] font-medium">{title}</span>
        <span className="block text-[12.5px] leading-snug text-ink-2">{detail}</span>
      </span>
    </label>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-[13.5px]">
      <span className={muted ? "text-ink-2" : strong ? "font-medium" : ""}>{label}</span>
      <span
        className={`tabular-nums ${strong ? "text-[18px] font-semibold" : muted ? "text-ink-2" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
