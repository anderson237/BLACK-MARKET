import { cpSync, mkdirSync, existsSync } from "fs";
import path from "path";

const from = path.join(process.cwd(), "client-site");
const to = path.join(process.cwd(), "dist");

if (!existsSync(from)) {
  console.warn("[copy-site] client-site/ introuvable, rien à copier");
  process.exit(0);
}

mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log("[copy-site] client-site -> dist OK");
