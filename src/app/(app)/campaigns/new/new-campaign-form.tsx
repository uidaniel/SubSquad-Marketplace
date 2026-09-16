"use client";

import * as React from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Panel, PanelBody, PanelFooter, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { fundingRequiredFor } from "@/lib/ledger/transactions";
import { formatNaira, parseNairaInput } from "@/lib/money";
import { cn } from "@/lib/utils";

const PLATFORM_FEE_BPS = 1200;

const DELIVERABLES = [
  { value: "tiktok_video", label: "TikTok video" },
  { value: "ig_reel", label: "Instagram reel" },
  { value: "ig_story", label: "Instagram story" },
  { value: "yt_short", label: "YouTube short" },
  { value: "x_post", label: "X post" },
] as const;

interface Slot {
  key: string;
  type: string;
  count: string;
  fee: string;
}

/**
 * Creating a campaign.
 *
 * The budget panel is the reason this is one screen rather than a wizard: the
 * fee per creator, the number of creators and the money required move together,
 * and splitting them across steps hides the only relationship that matters.
 * The total updates as you type, and says plainly whether the wallet covers it.
 */
export function NewCampaignForm({
  spaces,
  defaultMarginBps,
  isAgency,
}: {
  spaces: { id: string; name: string; availableKobo: number }[];
  defaultMarginBps: number;
  isAgency: boolean;
}) {
  const [spaceId, setSpaceId] = React.useState(spaces[0]?.id ?? "");
  const [slots, setSlots] = React.useState<Slot[]>([
    { key: "s1", type: "tiktok_video", count: "10", fee: "" },
  ]);

  const creatorFees = slots.reduce((sum, slot) => {
    const fee = parseNairaInput(slot.fee) ?? 0;
    const count = Number(slot.count) || 0;
    return sum + fee * count;
  }, 0);

  const required = creatorFees > 0 ? fundingRequiredFor(creatorFees, PLATFORM_FEE_BPS) : 0;
  const platformFee = required - creatorFees;
  const wallet = spaces.find((s) => s.id === spaceId);
  const available = wallet?.availableKobo ?? 0;
  const shortfall = Math.max(0, required - available);

  const update = (key: string, patch: Partial<Slot>) =>
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
      <Panel>
        <PanelHeader>
          <PanelTitle>Who it is for</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <Field label={isAgency ? "Client" : "Brand"} htmlFor="space">
            <Select id="space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Campaign name" htmlFor="name">
            <Input id="name" placeholder="e.g. Detty December" />
          </Field>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>The brief</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <Field
            label="What is being promoted"
            hint="One line. This is what a creator reads first."
            htmlFor="product"
          >
            <Input id="product" placeholder="e.g. PalmPay instant transfers" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Objective" htmlFor="objective">
              <Select id="objective" defaultValue="awareness">
                <option value="awareness">Awareness — get it seen</option>
                <option value="consideration">Consideration — get it understood</option>
                <option value="conversion">Conversion — get it used</option>
              </Select>
            </Field>
            <Field label="Category" htmlFor="category" hint="Restricted categories route every draft through ops.">
              <Select id="category" defaultValue="general">
                <option value="general">General</option>
                <option value="financial">Financial</option>
                <option value="alcohol">Alcohol</option>
                <option value="betting">Betting</option>
                <option value="health">Health</option>
              </Select>
            </Field>
          </div>

          <Field
            label="What every video must say"
            hint="One per line. Each becomes a check the draft is measured against, so keep them specific."
            htmlFor="messages"
          >
            <Textarea
              id="messages"
              rows={3}
              placeholder={"Transfers are instant and free\nNo card needed to send money"}
            />
          </Field>

          <Field
            label="What it must never do"
            hint="One per line. A draft that breaks one of these is sent back before you see it."
            htmlFor="avoid"
          >
            <Textarea
              id="avoid"
              rows={2}
              placeholder={"Show a competitor's logo\nPromise guaranteed returns"}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Disclosure tag" htmlFor="tag">
              <Input id="tag" defaultValue="#ad" />
            </Field>
            <Field label="Usage rights" htmlFor="rights">
              <Select id="rights" defaultValue="90">
                <option value="30">30 days organic</option>
                <option value="90">90 days organic</option>
                <option value="365">1 year organic</option>
              </Select>
            </Field>
            <Field label="Deadline" htmlFor="deadline">
              <Input id="deadline" type="date" />
            </Field>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setSlots((prev) => [
                  ...prev,
                  {
                    key: `s${Date.now()}`,
                    type: "ig_reel",
                    count: "5",
                    fee: "",
                  },
                ])
              }
            >
              <Plus /> Add a deliverable
            </Button>
          }
        >
          <PanelTitle>What you are buying</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {slots.map((slot) => (
            <div key={slot.key} className="grid gap-3 sm:grid-cols-[1fr_90px_140px_auto]">
              <Select
                value={slot.type}
                onChange={(e) => update(slot.key, { type: e.target.value })}
                aria-label="Deliverable"
              >
                {DELIVERABLES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
              <Input
                value={slot.count}
                onChange={(e) => update(slot.key, { count: e.target.value })}
                inputMode="numeric"
                aria-label="How many creators"
                placeholder="10"
              />
              <MoneyInput
                value={slot.fee}
                onChange={(e) => update(slot.key, { fee: e.target.value })}
                aria-label="Fee per creator"
                placeholder="85,000"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove"
                disabled={slots.length === 1}
                onClick={() =>
                  setSlots((prev) => prev.filter((s) => s.key !== slot.key))
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            The fee is what each creator receives. It is also the ceiling the AI
            negotiates under — it will settle below this, never above.
          </p>
        </PanelBody>
      </Panel>

      {/* The money, updating as the brief is written. */}
      <Panel accent={shortfall > 0}>
        <PanelHeader>
          <PanelTitle>What it will cost</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-2.5 text-[13.5px]">
          <Row label="Creator fees" value={formatNaira(creatorFees)} />
          {isAgency && (
            <Row
              label={`Your margin · ${defaultMarginBps / 100}%`}
              value={formatNaira(Math.floor((creatorFees * defaultMarginBps) / 10_000))}
              note="Charged to the client, never shown to them"
            />
          )}
          <Row label={`SubSquad fee · ${PLATFORM_FEE_BPS / 100}%`} value={formatNaira(platformFee)} />
          <div className="border-t border-ink pt-2.5">
            <Row label="To lock in escrow" value={formatNaira(required)} strong />
          </div>
          <Row
            label={`${wallet?.name ?? "This client"} has`}
            value={formatNaira(available)}
            tone={shortfall > 0 ? "danger" : "ok"}
          />
        </PanelBody>
        <PanelFooter>
          {creatorFees === 0
            ? "Add a fee per creator to see the total."
            : shortfall > 0
              ? `${formatNaira(shortfall)} short. You can create the campaign now and fund it once the money lands — nobody is contacted until then.`
              : "This wallet covers it. You can fund the campaign as soon as it is created."}
        </PanelFooter>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="brand" size="lg" disabled={creatorFees === 0}>
          Create campaign
        </Button>
        <Button type="button" variant="outline" size="lg">
          Save as draft
        </Button>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  note,
  strong,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  tone?: "ok" | "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={strong ? "font-medium" : "text-ink-2"}>
        {label}
        {note && <span className="block text-[12px] text-ink-3">{note}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          strong && "text-[20px] font-semibold",
          tone === "ok" && "text-ok",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </span>
    </div>
  );
}
