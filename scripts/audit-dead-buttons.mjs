import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Buttons that do nothing.
 *
 * "Approve 3 and draft invites" carried a `formAction` pointing at a route that
 * was never built, on a button that was not inside a form — so it rendered
 * perfectly, looked enabled, and did nothing at all. Nothing in a typecheck, a
 * lint, a unit test or a link audit can see that.
 *
 * A button is live if it has an onClick, is a submit inside a form, delegates
 * through asChild to a Link, or is one of the wrappers that supplies its own
 * behaviour. Anything else is reported.
 */

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(p)) files.push(p);
  }
})("src");

/** Components that are buttons but carry their own action prop. */
const WRAPPERS = /^(ActionButton|GenerateShortlistButton|SubmitButton|CopyButton)$/;

const findings = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);

  // Each <Button ...> or <button ...> opening tag, with its attributes.
  const tag = /<(Button|button)(\s[^>]*?)?>/gs;
  for (const m of src.matchAll(tag)) {
    const attrs = m[2] ?? "";
    const line = src.slice(0, m.index).split(/\r?\n/).length;

    const live =
      /\bonClick\b/.test(attrs) ||
      /\basChild\b/.test(attrs) ||
      /\btype=["']submit["']/.test(attrs) ||
      /\bformAction=\{[a-zA-Z_]/.test(attrs) || // a function, not a string path
      /\baction=\{/.test(attrs) ||
      /\bdisabled\s*$/.test(attrs.trim());

    if (live) continue;

    // Context above the tag settles two legitimate cases: a submit button
    // inside a form, and a button whose behaviour comes from a parent using
    // asChild (DialogClose, DialogTrigger, Link).
    const context = lines.slice(Math.max(0, line - 12), line).join("\n");
    if (/<form[\s>]/.test(context)) continue;
    if (/asChild/.test(lines.slice(Math.max(0, line - 3), line).join(" "))) continue;

    findings.push({
      file: file.split("\\").join("/"),
      line,
      snippet: m[0].replace(/\s+/g, " ").slice(0, 110),
    });
  }

  // Wrapper components are fine, but flag a string formAction anywhere — that
  // is the exact shape of the bug.
  for (const m of src.matchAll(/formAction=\{?["`]/g)) {
    const line = src.slice(0, m.index).split(/\r?\n/).length;
    findings.push({
      file: file.split("\\").join("/"),
      line,
      snippet: "formAction points at a string path, not a server action",
    });
  }
}

console.log("=== BUTTONS WITH NO HANDLER ===");
if (!findings.length) console.log("  (none)");
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}`);
  console.log(`      ${f.snippet}`);
}
console.log(`\nChecked ${files.length} component files. (Wrappers ignored: ${WRAPPERS})`);
