import fs from "node:fs";
const t = fs.readFileSync("artifacts/rms/src/i18n/messages.ts", "utf8");
function count(name) {
  const s = t.indexOf(`const ${name}: Messages`);
  const n = t.indexOf("\nconst ", s + 1);
  const e = t.indexOf("\nexport const messages", s + 1);
  const end = name === "ku" ? e : n > 0 && n < e ? n : e;
  return [...t.slice(s, end).matchAll(/^\s*"([^"]+)":/gm)].length;
}
console.log({ ar: count("ar"), en: count("en"), ku: count("ku") });
