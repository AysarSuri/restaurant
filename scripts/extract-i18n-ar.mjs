import fs from "node:fs";

const t = fs.readFileSync("artifacts/rms/src/i18n/messages.ts", "utf8");
const start = t.indexOf("const ar: Messages = {");
const end = t.indexOf("\nconst en: Messages = {");
const block = t.slice(start, end);

const entries = [];
const re = /^\s*"([^"]+)":\s*(?:"((?:\\.|[^"\\])*)"|`([\s\S]*?)`)\s*,?\s*$/gm;
let m;
while ((m = re.exec(block))) {
  const key = m[1];
  const raw = m[2] != null ? m[2] : m[3];
  const value = raw
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
  entries.push({ key, value });
}

fs.writeFileSync(
  "scripts/i18n-ar.json",
  JSON.stringify(Object.fromEntries(entries.map((e) => [e.key, e.value])), null, 2),
  "utf8"
);
console.log("keys", entries.length);
