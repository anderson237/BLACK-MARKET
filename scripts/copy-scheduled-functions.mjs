// Copies the Netlify Scheduled Functions (netlify/functions/*.mjs) into the
// Nitro-built function directory (.netlify/functions-internal) so the CLI
// deploy --functions picks them up alongside the Nuxt server function.
//
// Run after `nuxt build`:  node scripts/copy-scheduled-functions.mjs
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "netlify", "functions");
const DST = path.join(process.cwd(), ".netlify", "functions-internal");

if (!existsSync(SRC)) {
  console.log("[copy-scheduled-functions] no netlify/functions dir; nothing to copy");
  process.exit(0);
}

mkdirSync(DST, { recursive: true });
const entries = readdirSync(SRC);
let copied = 0;
for (const name of entries) {
  if (!name.endsWith(".mjs")) continue;
  const full = path.join(SRC, name);
  if (!statSync(full).isFile()) continue;
  copyFileSync(full, path.join(DST, name));
  copied++;
}
console.log(`[copy-scheduled-functions] copied ${copied} function(s) -> .netlify/functions-internal`);
