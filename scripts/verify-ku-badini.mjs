import fs from "node:fs";

const t = fs.readFileSync("artifacts/rms/src/i18n/messages.ts", "utf8");
const start = t.indexOf("const ku: Messages = {");
const end = t.indexOf("\nexport const messages:");
const kuBlock = t.slice(start, end);
const ar = JSON.parse(fs.readFileSync("scripts/i18n-ar.json", "utf8"));
const kuJson = JSON.parse(fs.readFileSync("scripts/i18n-ku-badini.json", "utf8"));

const keys = [...kuBlock.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
const missing = Object.keys(ar).filter((k) => !keys.includes(k));
const latin = [...kuBlock.matchAll(/"([^"]+)":\s*"((?:\\.|[^"\\])*)"/g)]
  .map((m) => [m[1], m[2]])
  .filter(
    ([, v]) =>
      /[A-Za-zêîûşçÊÎÛŞÇ]{2,}/.test(v) &&
      !/(English|Chrome|Edge|WhatsApp|PIN|POS|KDS|PDF|A4|OK|GPS|Wi-?Fi)/i.test(v)
  );

console.log({
  kuKeys: keys.length,
  arKeys: Object.keys(ar).length,
  missing: missing.length,
  latinishOutsidePlaceholders: latin.filter(([, v]) => !/\{[A-Za-z]+\}/.test(v))
    .length,
});
console.log(
  "trueLatin",
  latin
    .filter(([, v]) => !/\{[A-Za-z_]+\}/.test(v))
    .slice(0, 30)
    .map(([k, v]) => `${k}=>${v}`)
);
console.log({
  customers: kuJson["nav.customers"],
  drivers: kuJson["nav.drivers"],
  langKu: kuJson["lang.ku"],
});
