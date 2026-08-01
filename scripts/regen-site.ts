import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { getHtmlTemplateCode } from "../src/lib/template";

const out = path.join(process.cwd(), "client-site", "index.html");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, getHtmlTemplateCode(), "utf8");
console.log("index.html regenere ->", out);
