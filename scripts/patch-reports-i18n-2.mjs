import fs from "node:fs";

const EXTRA = {
  ar: {
    "reports.filterCategoryOptional": "تصفية فئة (اختياري)",
    "reports.allCategories": "كل الفئات",
    "reports.showReport": "عرض التقرير",
    "reports.totalSales": "إجمالي المبيعات",
    "reports.invoiceCount": "عدد الفواتير",
    "reports.rows": "الصفوف",
    "reports.categorySelected": "فئة محددة",
  },
  en: {
    "reports.filterCategoryOptional": "Filter category (optional)",
    "reports.allCategories": "All categories",
    "reports.showReport": "Show report",
    "reports.totalSales": "Total sales",
    "reports.invoiceCount": "Invoice count",
    "reports.rows": "Rows",
    "reports.categorySelected": "Selected category",
  },
  ku: {
    "reports.filterCategoryOptional": "فلتەرا پۆلی (نەپێدڤی)",
    "reports.allCategories": "هەمی پۆل",
    "reports.showReport": "نیشاندانا راپۆرتێ",
    "reports.totalSales": "کۆیا فرۆتنێ",
    "reports.invoiceCount": "هژمارا پسوولان",
    "reports.rows": "رێز",
    "reports.categorySelected": "پۆلێ هەلبژارتی",
  },
};

const path = "artifacts/rms/src/i18n/messages.ts";
let src = fs.readFileSync(path, "utf8");

function inject(blockName, extras) {
  const marker = `const ${blockName}: Messages = {`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("missing " + blockName);
  const after = src.indexOf("\nconst ", start + marker.length);
  const exportAt = src.indexOf("\nexport const messages:", start + marker.length);
  const end =
    blockName === "ku"
      ? exportAt
      : Math.min(...[after, exportAt].filter((n) => n > 0));
  const block = src.slice(start, end);
  const insertAt = block.lastIndexOf("\n};");
  const lines = Object.entries(extras)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  const nextBlock =
    block.slice(0, insertAt) + "\n" + lines + block.slice(insertAt);
  src = src.slice(0, start) + nextBlock + src.slice(end);
}

inject("ar", EXTRA.ar);
inject("en", EXTRA.en);
inject("ku", EXTRA.ku);
fs.writeFileSync(path, src, "utf8");
console.log("ok");
