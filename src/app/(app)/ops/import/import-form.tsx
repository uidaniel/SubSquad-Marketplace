"use client";

import * as React from "react";
import { AlertTriangle, Check, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseCreatorCsv, type ParseResult } from "@/lib/creators/import";
import { formatCount } from "@/lib/utils";
import { importCreators } from "./actions";

/**
 * Importing the index.
 *
 * The file is parsed in the browser and shown back before anything is written,
 * because a spreadsheet built by hand always has a few bad rows and finding out
 * afterwards means unpicking them from the database. Everything is scored during
 * the preview too, so it is obvious how much of the file will actually be usable
 * before committing to it.
 */
export function ImportForm() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [filename, setFilename] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<ParseResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ inserted: number; updated: number } | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  async function choose(file: File) {
    setError(null);
    setDone(null);
    setFilename(file.name);
    const text = await file.text();
    setPreview(parseCreatorCsv(text));
  }

  if (done) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-ok-soft px-3 py-2.5 text-[13.5px] text-ok">
          <Check className="size-4 shrink-0" />
          {done.inserted} added, {done.updated} updated. Nobody was contacted.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setDone(null);
            setPreview(null);
            setFilename(null);
          }}
        >
          Import another file
        </Button>
      </div>
    );
  }

  const usable = preview?.creators.length ?? 0;
  const eligible = preview?.creators.filter((c) => c.fraudScore >= 60).length ?? 0;

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void choose(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload />
          {filename ? "Choose a different file" : "Choose a CSV"}
        </Button>
        {filename && (
          <span className="text-[13px] text-ink-2">{filename}</span>
        )}
      </div>

      {preview && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge tone={usable > 0 ? "ok" : "neutral"} dot>
              {usable} usable {usable === 1 ? "row" : "rows"}
            </Badge>
            <Badge tone="info">{eligible} above the fraud threshold</Badge>
            {preview.problems.length > 0 && (
              <Badge tone="warn" dot>
                {preview.problems.length} skipped
              </Badge>
            )}
          </div>

          {preview.ignoredColumns.length > 0 && (
            <p className="text-[12.5px] text-ink-3">
              Ignored columns: {preview.ignoredColumns.join(", ")}
            </p>
          )}

          {preview.problems.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-warn/30 bg-warn-soft p-3">
              <p className="flex items-center gap-2 text-[12.5px] font-medium text-warn">
                <AlertTriangle className="size-3.5" />
                These rows will not be imported
              </p>
              <ul className="mt-2 space-y-1 text-[12.5px] text-ink-2">
                {preview.problems.slice(0, 8).map((p) => (
                  <li key={`${p.line}-${p.handle}`}>
                    Line {p.line}
                    {p.handle && ` · @${p.handle}`} — {p.problem}
                  </li>
                ))}
                {preview.problems.length > 8 && (
                  <li>and {preview.problems.length - 8} more</li>
                )}
              </ul>
            </div>
          )}

          {usable > 0 && (
            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line">
              <table className="w-full text-[13px]">
                <thead className="bg-surface-2 text-left text-[12px] text-ink-2">
                  <tr>
                    <th className="px-3 py-2 font-medium">Handle</th>
                    <th className="px-3 py-2 font-medium">Followers</th>
                    <th className="px-3 py-2 font-medium">Engagement</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.creators.slice(0, 10).map((c) => (
                    <tr key={`${c.platform}-${c.handle}`} className="border-t border-line">
                      <td className="px-3 py-2">
                        @{c.handle}
                        <span className="ml-1.5 text-[12px] text-ink-3">
                          {c.platform}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCount(c.followers)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {(c.engagementRate * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            c.fraudScore >= 60
                              ? "font-medium text-ok tabular-nums"
                              : "font-medium text-danger tabular-nums"
                          }
                        >
                          {c.fraudScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.creators.length > 10 && (
                <p className="border-t border-line px-3 py-2 text-[12.5px] text-ink-3">
                  and {preview.creators.length - 10} more
                </p>
              )}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
            >
              {error}
            </p>
          )}

          <Button
            variant="brand"
            disabled={busy || usable === 0}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await importCreators(preview.creators);
              setBusy(false);
              if ("error" in result) setError(result.error);
              else setDone(result);
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            Import {usable} {usable === 1 ? "creator" : "creators"}
          </Button>
        </>
      )}
    </div>
  );
}
