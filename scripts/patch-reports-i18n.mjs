import fs from "node:fs";

const EXTRA = {
  ar: {
    "reports.intro":
      "صفحات تقارير منظمة — ابدأ بتقرير المبيعات حسب التاريخين والصنف والفئة.",
    "reports.soon": "قريباً",
    "reports.pageSales": "المبيعات",
    "reports.pageSalesSub": "حسب التاريخ · الصنف · الفئة",
    "reports.pageProfit": "أرباح من مبيعات",
    "reports.pageProfitSub": "أصناف بتكلفة · ربح تفصيلي",
    "reports.pageDiscounts": "خصومات من مبيعات",
    "reports.pageDiscountsSub": "حسب التاريخين · فواتير بخصم",
    "reports.pageExpenses": "المصاريف",
    "reports.pageExpensesSub": "قريباً",
    "reports.pageInventory": "المخزون",
    "reports.pageInventorySub": "قريباً",
    "reports.groupByDate": "حسب التاريخ",
    "reports.groupByItem": "حسب الصنف",
    "reports.groupByCategory": "حسب الفئة",
    "reports.dimDate": "التاريخ",
    "reports.dimItem": "الصنف",
    "reports.dimCategory": "الفئة",
    "reports.salesFilters": "فلاتر تقرير المبيعات",
    "reports.branchPrefix": "الفرع",
    "reports.allBranches": "كل الفروع",
    "reports.fromDate": "من تاريخ",
    "reports.toDate": "إلى تاريخ",
    "reports.applyFilters": "تطبيق",
    "reports.refresh": "تحديث",
    "reports.fallbackTitle": "تقرير",
  },
  en: {
    "reports.intro":
      "Organized report pages — start with sales by date range, item, and category.",
    "reports.soon": "Soon",
    "reports.pageSales": "Sales",
    "reports.pageSalesSub": "By date · item · category",
    "reports.pageProfit": "Sales profit",
    "reports.pageProfitSub": "Costed items · detailed profit",
    "reports.pageDiscounts": "Sales discounts",
    "reports.pageDiscountsSub": "By date range · discounted invoices",
    "reports.pageExpenses": "Expenses",
    "reports.pageExpensesSub": "Soon",
    "reports.pageInventory": "Inventory",
    "reports.pageInventorySub": "Soon",
    "reports.groupByDate": "By date",
    "reports.groupByItem": "By item",
    "reports.groupByCategory": "By category",
    "reports.dimDate": "Date",
    "reports.dimItem": "Item",
    "reports.dimCategory": "Category",
    "reports.salesFilters": "Sales report filters",
    "reports.branchPrefix": "Branch",
    "reports.allBranches": "All branches",
    "reports.fromDate": "From date",
    "reports.toDate": "To date",
    "reports.applyFilters": "Apply",
    "reports.refresh": "Refresh",
    "reports.fallbackTitle": "Report",
  },
  ku: {
    "reports.intro":
      "پەڕێن راپۆرتێن رێکخستی — دەستپێکە ب راپۆرتا فرۆتنێ ب گوڕێ دیرۆکان، بەرهەم و پۆل.",
    "reports.soon": "بەنزیک",
    "reports.pageSales": "فرۆتن",
    "reports.pageSalesSub": "ب گوڕێ دیرۆکێ · بەرهەم · پۆل",
    "reports.pageProfit": "قازانژێن فرۆتنێ",
    "reports.pageProfitSub": "بەرهەمێن ب باها · قازانژا ورد",
    "reports.pageDiscounts": "داشکاندنێن فرۆتنێ",
    "reports.pageDiscountsSub": "ب گوڕێ دیرۆکان · پسوولێن ب داشکاندن",
    "reports.pageExpenses": "مەزاخت",
    "reports.pageExpensesSub": "بەنزیک",
    "reports.pageInventory": "کۆگا",
    "reports.pageInventorySub": "بەنزیک",
    "reports.groupByDate": "ب گوڕێ دیرۆکێ",
    "reports.groupByItem": "ب گوڕێ بەرهەمی",
    "reports.groupByCategory": "ب گوڕێ پۆلی",
    "reports.dimDate": "دیرۆک",
    "reports.dimItem": "بەرهەم",
    "reports.dimCategory": "پۆل",
    "reports.salesFilters": "فلتەرێن راپۆرتا فرۆتنێ",
    "reports.branchPrefix": "لق",
    "reports.allBranches": "هەمی لق",
    "reports.fromDate": "ژ دیرۆکێ",
    "reports.toDate": "هەتا دیرۆکێ",
    "reports.applyFilters": "جێبەجێکرن",
    "reports.refresh": "نووکرن",
    "reports.fallbackTitle": "راپۆرت",
  },
};

const path = "artifacts/rms/src/i18n/messages.ts";
let src = fs.readFileSync(path, "utf8");

function inject(blockName, extras) {
  const marker = `const ${blockName}: Messages = {`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("missing " + blockName);
  // Find end of this const — next "const " or "export const messages"
  const after = src.indexOf("\nconst ", start + marker.length);
  const exportAt = src.indexOf("\nexport const messages:", start + marker.length);
  const end =
    blockName === "ku"
      ? exportAt
      : Math.min(
          ...[after, exportAt].filter((n) => n > 0)
        );
  const block = src.slice(start, end);
  const insertAt = block.lastIndexOf("\n};");
  if (insertAt < 0) throw new Error("no end for " + blockName);
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
console.log("patched report keys into ar/en/ku");
