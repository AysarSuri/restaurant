import fs from "node:fs";

const messagesPath = "artifacts/rms/src/i18n/messages.ts";
const kuJson = JSON.parse(
  fs.readFileSync("scripts/i18n-ku-badini.json", "utf8")
);

function escapeTsString(value) {
  return JSON.stringify(value);
}

const lines = ["const ku: Messages = {"];
for (const [key, value] of Object.entries(kuJson)) {
  lines.push(`  ${escapeTsString(key)}: ${escapeTsString(value)},`);
}
lines.push("};");
const kuBlock = lines.join("\n");

const src = fs.readFileSync(messagesPath, "utf8");
const start = src.indexOf("const ku: Messages = {");
const end = src.indexOf("\nexport const messages:");
if (start < 0 || end < 0) {
  throw new Error("Could not locate ku block in messages.ts");
}

const next = src.slice(0, start) + kuBlock + "\n\n" + src.slice(end + 1);
fs.writeFileSync(messagesPath, next, "utf8");
console.log("Wrote ku block with", Object.keys(kuJson).length, "keys");
