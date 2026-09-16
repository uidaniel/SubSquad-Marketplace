import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const EMAIL = "debug+local@subsquad.test";
const PASSWORD = "debug-local-9134";

// Reuse if it exists, so re-running this is harmless.
const { data: list } = await db.auth.admin.listUsers();
let user = list.users.find((u) => u.email === EMAIL);
if (!user) {
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { name: "Debug User" },
  });
  if (error) { console.log("create failed:", error.message); process.exit(1); }
  user = data.user;
}

const { data: org } = await db.from("orgs").select("id, name").limit(1).maybeSingle();
if (!org) { console.log("no orgs to join"); process.exit(1); }

const { data: existing } = await db.from("org_members")
  .select("id").eq("user_id", user.id).eq("org_id", org.id).maybeSingle();
if (!existing) {
  await db.from("org_members").insert({ org_id: org.id, user_id: user.id, role: "owner" });
}
console.log(`ready: ${EMAIL} / ${PASSWORD} in ${org.name}`);
