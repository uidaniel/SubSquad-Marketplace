"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A link somebody will paste into a message.
 *
 * The deal page showed "Invite link: /i/inv_jollof_tunde" — a path with no
 * host, in plain text, which is nothing anyone can send. This is the full URL,
 * with a button that copies it and says so.
 */
export function CopyLink({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard needs a secure context and a user gesture; both are true
      // here, but a refusal should select the text rather than do nothing.
      window.getSelection()?.selectAllChildren(document.getElementById(`copy-${url}`)!);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {label && <span className="text-[12.5px] text-ink-3">{label}</span>}
      <code
        id={`copy-${url}`}
        className="min-w-0 truncate rounded-[var(--radius-xs)] bg-ground px-2 py-1 font-mono text-[12px] text-ink-2"
      >
        {url}
      </code>
      <Button variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="text-ok" /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
