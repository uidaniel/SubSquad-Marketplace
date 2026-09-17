import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Dead ends and 404s.
 *
 * Two questions, asked of the whole app at once rather than one screen at a
 * time: does every link the UI offers actually go somewhere, and does every
 * screen that exists have something linking to it? The shortlist page failed
 * the second test for days and nobody could reach the most important step in
 * the product.
 */

const ROOT = "src/app";

/**
 * Routes come only from src/app, but hrefs are scanned across all of src: the
 * sidebar, the topbar and the next-action logic all live outside src/app, and a
 * scan that missed them reported the settings and search pages as unreachable
 * when the sidebar links both.
 */
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})("src");

const slash = (s) => s.split("\\").join("/");

/** Every route the app serves. */
const routes = new Set();
for (const f of files) {
  const rel = slash(relative(ROOT, f));
  if (rel.startsWith("..")) continue; // outside src/app: not a route
  if (!/\/(page|route)\.tsx?$/.test(rel) && !/^(page|route)\.tsx?$/.test(rel)) continue;
  const parts = rel
    .replace(/\/?(page|route)\.tsx?$/, "")
    .split("/")
    .filter((seg) => seg && !/^\(.*\)$/.test(seg));
  routes.add("/" + parts.join("/"));
}

/** Every internal href the UI offers. */
const linked = new Map();
const push = (href, file) => {
  const clean = href.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  if (!linked.has(clean)) linked.set(clean, new Set());
  linked.get(clean).add(slash(relative(ROOT, file)));
};

for (const f of files) {
  if (!/\.tsx?$/.test(f)) continue;
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/href=["'](\/[^"']*)["']/g)) push(m[1], f);
  for (const m of src.matchAll(/href=\{`(\/[^`]*)`\}/g)) push(m[1], f);
  for (const m of src.matchAll(/href:\s*`(\/[^`]*)`/g)) push(m[1], f);
  for (const m of src.matchAll(/href:\s*["'](\/[^"']*)["']/g)) push(m[1], f);
}

/** `[id]` in a route matches any single segment; so does a `${...}` in a href. */
const matches = (href, route) => {
  const h = href.split("/").filter(Boolean);
  const r = route.split("/").filter(Boolean);
  if (h.length !== r.length) return false;
  return r.every(
    (seg, i) => /^\[.*\]$/.test(seg) || seg === h[i] || h[i].includes("${"),
  );
};

console.log("=== LINKS THAT GO NOWHERE ===");
let broken = 0;
for (const [href, from] of [...linked].sort()) {
  if ([...routes].some((r) => matches(href, r))) continue;
  broken++;
  console.log(`  ${href}`);
  console.log(`      from: ${[...from].join(", ")}`);
}
if (!broken) console.log("  (none)");

console.log("\n=== PAGES NOTHING LINKS TO ===");
let orphans = 0;
for (const route of [...routes].sort()) {
  if (route.startsWith("/api")) continue;
  if ([...linked.keys()].some((h) => matches(h, route))) continue;
  orphans++;
  console.log(`  ${route}`);
}
if (!orphans) console.log("  (none)");

console.log(`\n${routes.size} routes, ${linked.size} distinct hrefs.`);
