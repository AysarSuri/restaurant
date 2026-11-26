import { formatDisplayDateForApp } from "@/lib/date-format";

export type ReceiptLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ThermalReceiptData = {
  restaurantName: string;
  branchName: string;
  mobile1?: string | null;
  mobile2?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  invoiceNumber: string;
  dateLabel: string;
  timeLabel: string;
  orderTypeLabel: string;
  seatLabel?: string | null;
  items: ReceiptLineItem[];
  subtotal: number;
  discount: number;
  deliveryFee?: number;
  total: number;
  paymentLabel: string;
  received?: number;
  change?: number;
  formatMoney: (n: number) => string;
  printerName?: string | null;
};

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReceiptHtml(data: ThermalReceiptData) {
  const phones = [data.mobile1, data.mobile2].filter((v) => Boolean(v && String(v).trim()));
  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td class="item-name">${esc(item.name)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${esc(data.formatMoney(item.unitPrice))}</td>
        <td class="num total">${esc(data.formatMoney(item.lineTotal))}</td>
      </tr>`
    )
    .join("");

  const logo = data.logoUrl?.trim()
    ? `<img class="logo" src="${esc(data.logoUrl.trim())}" alt="" />`
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${esc(data.printerName ? `طباعة — ${data.printerName}` : "فاتورة 80×80")}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { width: 80mm; }
    .ticket {
      width: 76mm;
      margin: 0 auto;
      padding: 3mm 2.5mm 4mm;
      color: #000;
    }
    .logo {
      display: block;
      width: 22mm;
      height: 22mm;
      object-fit: contain;
      margin: 0 auto 2.5mm;
      border-radius: 2mm;
      filter: grayscale(1) contrast(1.15);
    }
    .brand {
      text-align: center;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.02em;
      line-height: 1.25;
      margin: 0 0 1mm;
    }
    .branch {
      text-align: center;
      font-size: 12px;
      font-weight: 800;
      margin: 0 0 2mm;
    }
    .meta {
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.45;
      margin: 0;
    }
    .rule {
      border: 0;
      border-top: 1.5px solid #000;
      margin: 2.5mm 0;
    }
    .rule-dashed {
      border: 0;
      border-top: 1.2px dashed #000;
      margin: 2mm 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      font-size: 10.5px;
      font-weight: 700;
      line-height: 1.4;
      margin: 0.8mm 0;
    }
    .row span:last-child { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: plaintext; }
    .section-title {
      text-align: center;
      font-size: 11px;
      font-weight: 900;
      margin: 0 0 1.5mm;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead th {
      font-size: 9px;
      font-weight: 900;
      border-bottom: 1.2px solid #000;
      padding: 0 0 1mm;
      text-align: right;
    }
    thead th.num, tbody td.num { text-align: left; direction: ltr; unicode-bidi: plaintext; }
    tbody td {
      font-size: 10px;
      font-weight: 700;
      padding: 1.2mm 0;
      vertical-align: top;
      border-bottom: 0.6px dotted #222;
    }
    .item-name { width: 42%; word-break: break-word; }
    .num { width: 16%; }
    .num.total { width: 26%; font-weight: 900; }
    .totals .row { font-size: 11px; }
    .grand {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2mm;
      margin-top: 1.5mm;
      padding: 1.8mm 1.5mm;
      border: 1.8px solid #000;
      font-size: 13px;
      font-weight: 900;
    }
    .grand strong { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: plaintext; }
    .footer {
      text-align: center;
      margin-top: 3mm;
      font-size: 10px;
      font-weight: 800;
      line-height: 1.4;
    }
    .printer-hint {
      text-align: center;
      margin-top: 2mm;
      font-size: 8px;
      font-weight: 700;
      opacity: 0.75;
    }
    @media print {
      html, body { width: 80mm; }
      .ticket { width: 76mm; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    ${logo}
    <h1 class="brand">${esc(data.restaurantName || "المطعم")}</h1>
    <p class="branch">${esc(data.branchName || "")}</p>
    <p class="meta">
      ${phones.map((p) => esc(String(p))).join(" · ")}
      ${data.address?.trim() ? `<br/>${esc(data.address.trim())}` : ""}
    </p>
    <hr class="rule" />
    <div class="row"><span>رقم الفاتورة</span><span>${esc(data.invoiceNumber)}</span></div>
    <div class="row"><span>التاريخ</span><span dir="ltr">${esc(data.dateLabel)}</span></div>
    <div class="row"><span>الوقت</span><span>${esc(data.timeLabel)}</span></div>
    <div class="row"><span>نوع الطلب</span><span>${esc(data.orderTypeLabel)}</span></div>
    ${data.seatLabel ? `<div class="row"><span>المكان</span><span>${esc(data.seatLabel)}</span></div>` : ""}
    <div class="row"><span>الدفع</span><span>${esc(data.paymentLabel)}</span></div>
    <hr class="rule-dashed" />
    <p class="section-title">تفاصيل الفاتورة</p>
    <table>
      <thead>
        <tr>
          <th>الصنف</th>
          <th class="num">الكمية</th>
          <th class="num">السعر</th>
          <th class="num">المجموع</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <hr class="rule-dashed" />
    <div class="totals">
      <div class="row"><span>المجموع الفرعي</span><span>${esc(data.formatMoney(data.subtotal))}</span></div>
      ${
        data.discount > 0
          ? `<div class="row"><span>الخصم</span><span>- ${esc(data.formatMoney(data.discount))}</span></div>`
          : ""
      }
      ${
        (data.deliveryFee ?? 0) > 0
          ? `<div class="row"><span>التوصيل</span><span>${esc(data.formatMoney(data.deliveryFee ?? 0))}</span></div>`
          : ""
      }
      <div class="grand"><span>الإجمالي</span><strong>${esc(data.formatMoney(data.total))}</strong></div>
      ${
        data.received != null
          ? `<div class="row"><span>الواصل</span><span>${esc(data.formatMoney(data.received))}</span></div>`
          : ""
      }
      ${
        data.change != null && data.change > 0
          ? `<div class="row"><span>الباقي</span><span>${esc(data.formatMoney(data.change))}</span></div>`
          : ""
      }
    </div>
    <p class="footer">شكراً لزيارتكم<br/>نتمنى لكم وجبة شهية</p>
    ${
      data.printerName?.trim()
        ? `<p class="printer-hint">طابعة الجهاز: ${esc(data.printerName.trim())} · 80×80</p>`
        : `<p class="printer-hint">فاتورة حرارية 80×80</p>`
    }
  </div>
</body>
</html>`;
}

function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let pending = images.length;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const done = () => {
      pending -= 1;
      if (pending <= 0) finish();
    };
    images.forEach((img) => {
      if (img.complete) done();
      else {
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      }
    });
    window.setTimeout(finish, 2000);
  });
}

function printFromWindow(win: Window) {
  const doc = win.document;
  const run = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  };
  void waitForImages(doc).then(() => {
    window.setTimeout(run, 80);
  });
  win.onafterprint = () => {
    window.setTimeout(() => {
      try {
        win.close();
      } catch {
        /* ignore */
      }
    }, 200);
  };
}

function openThermalHtmlDocument(html: string, windowName: string, title: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const popup = window.open(
    url,
    windowName,
    "width=420,height=740,left=80,top=40"
  );

  if (popup) {
    let printed = false;
    const start = () => {
      if (printed) return;
      printed = true;
      printFromWindow(popup);
      window.setTimeout(() => URL.revokeObjectURL(url), 8000);
    };
    popup.onload = start;
    window.setTimeout(() => {
      try {
        if (popup.document?.readyState === "complete") start();
      } catch {
        start();
      }
    }, 400);
    return;
  }

  URL.revokeObjectURL(url);
  const iframe = document.createElement("iframe");
  iframe.title = title;
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:80mm;height:1200px;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!win || !doc) {
    iframe.remove();
    throw new Error("تعذر تجهيز نافذة الطباعة — افتح النظام في المتصفح واسمح بالنوافذ المنبثقة");
  }

  doc.open();
  doc.write(html);
  doc.close();

  void waitForImages(doc).then(() => {
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } finally {
        window.setTimeout(() => iframe.remove(), 1500);
      }
    }, 100);
  });
}

/**
 * Prints a professional 80×80 thermal receipt from a dedicated document window
 * (not the host Cursor/app page — avoids empty "app doesn't support print preview").
 */
export function printThermalReceipt(data: ThermalReceiptData) {
  openThermalHtmlDocument(buildReceiptHtml(data), "rms-thermal-receipt", "فاتورة 80×80");
}

export type KitchenTicketLine = {
  name: string;
  quantity: number;
  notes?: string | null;
};

/** Kitchen chit — items + qty only, never prices / totals / payment */
export type KitchenTicketThermalData = {
  restaurantName: string;
  branchName: string;
  logoUrl?: string | null;
  invoiceNumber: string;
  dateLabel: string;
  timeLabel: string;
  orderTypeLabel: string;
  seatLabel?: string | null;
  kitchenStatusLabel: string;
  items: KitchenTicketLine[];
  orderNotes?: string | null;
  printerName?: string | null;
};

function buildKitchenTicketHtml(data: KitchenTicketThermalData) {
  const logo = data.logoUrl?.trim()
    ? `<img class="logo" src="${esc(data.logoUrl.trim())}" alt="" />`
    : "";
  const itemCount = data.items.reduce((s, i) => s + Math.abs(Number(i.quantity) || 0), 0);
  const itemsHtml = data.items
    .map((item) => {
      const note = item.notes?.trim()
        ? `<div class="item-note">※ ${esc(item.notes.trim())}</div>`
        : "";
      return `
      <div class="item">
        <div class="item-row">
          <span class="qty">${esc(String(item.quantity))}×</span>
          <span class="name">${esc(item.name)}</span>
        </div>
        ${note}
      </div>`;
    })
    .join("");

  const typeChip = data.orderTypeLabel?.trim() || "";
  const seatRaw = data.seatLabel?.trim() || "";
  // Avoid duplicate chips like «سفري» + «سفري» when seat equals order type
  const seatChip =
    seatRaw && seatRaw !== typeChip
      ? `<div class="chip">${esc(seatRaw)}</div>`
      : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${esc(data.printerName ? `مطبخ — ${data.printerName}` : "تذكرة مطبخ 80×80")}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { width: 80mm; }
    .ticket {
      width: 76mm;
      margin: 0 auto;
      padding: 3.5mm 2.8mm 5mm;
    }
    .logo {
      display: block;
      width: 24mm;
      height: 24mm;
      object-fit: contain;
      margin: 0 auto 2.5mm;
      border-radius: 3mm;
      filter: grayscale(1) contrast(1.2);
    }
    .brand {
      text-align: center;
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.01em;
      line-height: 1.25;
      margin: 0 0 1mm;
    }
    .branch {
      text-align: center;
      font-size: 12.5px;
      font-weight: 800;
      margin: 0 0 2.5mm;
    }
    .banner {
      text-align: center;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.08em;
      padding: 2.2mm 0;
      border: 2px solid #111;
      border-radius: 2mm;
      margin: 0 0 2.5mm;
      text-transform: uppercase;
    }
    .order-no {
      text-align: center;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.04em;
      line-height: 1;
      margin: 1mm 0 2mm;
      font-variant-numeric: tabular-nums;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.5mm;
      margin: 0 0 2.5mm;
    }
    .chip {
      display: inline-block;
      border: 1.4px solid #111;
      border-radius: 999px;
      padding: 1mm 2.4mm;
      font-size: 11px;
      font-weight: 800;
      line-height: 1.2;
    }
    .when {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.45;
      margin: 0 0 2mm;
      font-variant-numeric: tabular-nums;
    }
    .rule {
      border: 0;
      border-top: 2px solid #111;
      margin: 2.5mm 0;
    }
    .rule-dashed {
      border: 0;
      border-top: 1.5px dashed #333;
      margin: 2.5mm 0;
    }
    .section {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.12em;
      margin: 0 0 2mm;
      opacity: 0.85;
    }
    .item {
      padding: 1.8mm 0;
      border-bottom: 1px dotted #999;
    }
    .item:last-child { border-bottom: 0; }
    .item-row {
      display: flex;
      align-items: flex-start;
      gap: 2.5mm;
    }
    .qty {
      flex: 0 0 auto;
      min-width: 9mm;
      font-size: 16px;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }
    .name {
      flex: 1 1 auto;
      font-size: 14px;
      font-weight: 800;
      line-height: 1.35;
    }
    .item-note {
      margin: 1.2mm 0 0 11.5mm;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.35;
      padding: 1.2mm 1.8mm;
      border: 1px solid #111;
      border-radius: 1.5mm;
      background: #f3f3f3;
    }
    .count {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 900;
      margin-top: 1mm;
      font-variant-numeric: tabular-nums;
    }
    .order-notes {
      margin-top: 2mm;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.4;
      padding: 2mm;
      border: 1.5px solid #111;
      border-radius: 2mm;
    }
  </style>
</head>
<body>
  <div class="ticket">
    ${logo}
    <h1 class="brand">${esc(data.restaurantName || "المطعم")}</h1>
    <p class="branch">${esc(data.branchName || "")}</p>
    <div class="banner">تذكرة مطبخ</div>
    <div class="order-no">#${esc(String(data.invoiceNumber || "").slice(-4) || data.invoiceNumber)}</div>
    <div class="meta">
      ${typeChip ? `<div class="chip">${esc(typeChip)}</div>` : ""}
      ${seatChip}
      ${
        data.kitchenStatusLabel?.trim()
          ? `<div class="chip">${esc(data.kitchenStatusLabel.trim())}</div>`
          : ""
      }
    </div>
    <p class="when" dir="ltr">${esc(data.dateLabel)} · ${esc(data.timeLabel)}</p>
    <hr class="rule" />
    <p class="section">الأصناف</p>
    ${itemsHtml || `<p class="when">لا توجد أصناف</p>`}
    <hr class="rule-dashed" />
    <div class="count">
      <span>عدد القطع</span>
      <span dir="ltr">${itemCount}</span>
    </div>
    ${
      data.orderNotes?.trim()
        ? `<div class="order-notes"><strong>ملاحظة الطلب:</strong> ${esc(data.orderNotes.trim())}</div>`
        : ""
    }
  </div>
</body>
</html>`;
}

/** Professional kitchen ticket for 80mm thermal paper (no prices). */
export function printKitchenTicketThermal(data: KitchenTicketThermalData) {
  openThermalHtmlDocument(
    buildKitchenTicketHtml(data),
    "rms-kitchen-ticket",
    "تذكرة مطبخ 80×80"
  );
}

export type SupplierPurchaseReceiptItem = {
  name: string;
  qty: number;
  unitLabel: string;
  price: number;
  amount: number;
};

export type SupplierPurchaseReceiptData = {
  restaurantName: string;
  logoUrl?: string | null;
  mobile?: string | null;
  /** Document title under restaurant identity */
  docTitle?: string;
  /** Label for paid/settled amount row (e.g. مبلغ الدفع / مبلغ واصل) */
  paidLabel?: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceTime: string;
  supplierName: string;
  notes?: string | null;
  items: SupplierPurchaseReceiptItem[];
  totalQty: number;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  remainingAmount: number;
  /** Balance before this invoice */
  oldBalance: number;
  /** Balance after this invoice */
  newBalance: number;
  formatMoney: (n: number) => string;
};

/** Party label: positive → restaurant, negative → supplier */
export function purchaseBalancePartyLabel(
  amount: number,
  supplierName: string,
  restaurantName: string
) {
  if (amount > 0) return `باقي عند ${restaurantName}`;
  if (amount < 0) return `باقي عند ${supplierName}`;
  return "متوازن";
}

function buildSupplierPurchaseHtml(data: SupplierPurchaseReceiptData) {
  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td class="item-name">${esc(item.name)}</td>
        <td class="num">${esc(String(item.qty))} ${esc(item.unitLabel)}</td>
        <td class="num">${esc(data.formatMoney(item.price))}</td>
        <td class="num total">${esc(data.formatMoney(item.amount))}</td>
      </tr>`
    )
    .join("");

  const oldParty = purchaseBalancePartyLabel(
    data.oldBalance,
    data.supplierName,
    data.restaurantName
  );
  const newParty = purchaseBalancePartyLabel(
    data.newBalance,
    data.supplierName,
    data.restaurantName
  );
  // Do not HTML-escape data URLs (base64); only quote-safe attribute wrap
  const rawLogo = data.logoUrl?.trim() || "";
  const logoSrc = rawLogo.replace(/"/g, "");
  const logo = logoSrc
    ? `<img class="logo" src="${logoSrc}" alt="" />`
    : "";
  const phone = data.mobile?.trim() || "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>فاتورة شراء ${esc(data.invoiceNo)} — 80×80</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { width: 80mm; }
    .ticket {
      width: 72mm;
      margin: 0 auto;
      padding: 3mm 4.5mm 4mm;
      color: #000;
    }
    .identity {
      text-align: center;
      margin: 0 0 2mm;
    }
    .logo {
      display: block;
      width: 24mm;
      height: 24mm;
      object-fit: contain;
      margin: 0 auto 1.5mm;
      border-radius: 2mm;
    }
    .brand {
      text-align: center;
      font-size: 15px;
      font-weight: 900;
      line-height: 1.3;
      margin: 0 0 1mm;
      color: #000;
    }
    .doc-title {
      text-align: center;
      font-size: 13px;
      font-weight: 900;
      margin: 0 0 2mm;
      color: #000;
      letter-spacing: 0.04em;
    }
    .phone {
      text-align: center;
      font-size: 12px;
      font-weight: 800;
      margin: 0 0 1mm;
      color: #000;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    .rule {
      border: 0;
      border-top: 1.6px solid #000;
      margin: 2mm 0;
    }
    .rule-dashed {
      border: 0;
      border-top: 1.2px dashed #000;
      margin: 2mm 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.45;
      margin: 0.9mm 0;
      color: #000;
    }
    .row span:last-child {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: plaintext;
      text-align: left;
    }
    .party {
      display: block;
      font-size: 12px;
      font-weight: 800;
      color: #000;
      margin-top: 0.4mm;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead th {
      font-size: 11px;
      font-weight: 900;
      border-bottom: 1.4px solid #000;
      padding: 0 0 1mm;
      text-align: right;
      color: #000;
    }
    thead th.num, tbody td.num {
      text-align: left;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    tbody td {
      font-size: 12px;
      font-weight: 800;
      padding: 1.3mm 0;
      vertical-align: top;
      border-bottom: 0.7px dotted #111;
      color: #000;
    }
    .item-name { width: 38%; word-break: break-word; }
    .num { width: 18%; }
    .num.total { width: 26%; font-weight: 900; }
    .grand {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2mm;
      margin-top: 1.5mm;
      padding: 1.8mm 1.5mm;
      border: 1.8px solid #000;
      font-size: 13px;
      font-weight: 900;
      color: #000;
    }
    .grand strong {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    .balance-box {
      margin-top: 2mm;
      padding: 1.8mm 1.5mm;
      border: 1.5px solid #000;
    }
    .balance-box .row { margin: 1mm 0; font-size: 12px; }
    .footer {
      text-align: center;
      margin-top: 3mm;
      font-size: 12px;
      font-weight: 800;
      color: #000;
    }
    @media print {
      html, body { width: 80mm; }
      .ticket { width: 72mm; padding-left: 4.5mm; padding-right: 4.5mm; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="identity">
      ${logo}
      <h1 class="brand">${esc(data.restaurantName || "المطعم")}</h1>
      ${phone ? `<p class="phone">${esc(phone)}</p>` : ""}
    </div>
    <p class="doc-title">${esc(data.docTitle?.trim() || "فاتورة شراء من المورد")}</p>
    <hr class="rule" />
    <div class="row"><span>رقم الفاتورة</span><span>${esc(data.invoiceNo)}</span></div>
    <div class="row"><span>التاريخ</span><span dir="ltr">${esc(formatDisplayDateForApp(data.invoiceDate, data.invoiceDate))}</span></div>
    <div class="row"><span>الساعة</span><span>${esc(data.invoiceTime)}</span></div>
    <div class="row"><span>المورد</span><span>${esc(data.supplierName)}</span></div>
    ${
      data.notes?.trim()
        ? `<div class="row"><span>ملاحظة</span><span>${esc(data.notes.trim())}</span></div>`
        : ""
    }
    <hr class="rule-dashed" />
    <table>
      <thead>
        <tr>
          <th>الصنف</th>
          <th class="num">كمية</th>
          <th class="num">سعر</th>
          <th class="num">مبلغ</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <hr class="rule-dashed" />
    <div class="row"><span>مجموع الكمية</span><span>${esc(data.formatMoney(data.totalQty))}</span></div>
    <div class="row"><span>مجموع المبلغ</span><span>${esc(data.formatMoney(data.totalAmount))}</span></div>
    <div class="row"><span>${esc(data.paidLabel?.trim() || "مبلغ الدفع")}</span><span>${esc(data.formatMoney(data.paidAmount))}</span></div>
    <div class="row"><span>خصم</span><span>${esc(data.formatMoney(data.discountAmount))}</span></div>
    <div class="grand"><span>باقي قائمة</span><strong>${esc(data.formatMoney(data.remainingAmount))}</strong></div>
    <div class="balance-box">
      <div class="row">
        <span>رصيد القديم<span class="party">${esc(oldParty)}</span></span>
        <span>${esc(data.formatMoney(Math.abs(data.oldBalance)))}</span>
      </div>
      <div class="row">
        <span>باقي الرصيد<span class="party">${esc(newParty)}</span></span>
        <span>${esc(data.formatMoney(Math.abs(data.newBalance)))}</span>
      </div>
    </div>
    <p class="footer">شكراً لتعاملكم</p>
  </div>
</body>
</html>`;
}

/** Professional supplier purchase invoice for 80mm thermal paper */
export function printSupplierPurchaseThermal(data: SupplierPurchaseReceiptData) {
  const html = buildSupplierPurchaseHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const popup = window.open(
    url,
    "rms-supplier-purchase-receipt",
    "width=420,height=780,left=80,top=40"
  );

  if (popup) {
    let printed = false;
    const start = () => {
      if (printed) return;
      printed = true;
      printFromWindow(popup);
      window.setTimeout(() => URL.revokeObjectURL(url), 8000);
    };
    popup.onload = start;
    window.setTimeout(() => {
      try {
        if (popup.document?.readyState === "complete") start();
      } catch {
        start();
      }
    }, 400);
    return;
  }

  URL.revokeObjectURL(url);
  const iframe = document.createElement("iframe");
  iframe.title = "فاتورة شراء 80×80";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:80mm;height:1400px;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!win || !doc) {
    iframe.remove();
    throw new Error("تعذر تجهيز نافذة الطباعة — افتح النظام في المتصفح واسمح بالنوافذ المنبثقة");
  }

  doc.open();
  doc.write(html);
  doc.close();

  void waitForImages(doc).then(() => {
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } finally {
        window.setTimeout(() => iframe.remove(), 1500);
      }
    }, 100);
  });
}

export type SupplierMovementReceiptData = {
  restaurantName: string;
  logoUrl?: string | null;
  mobile?: string | null;
  invoiceNo: string;
  movementDate: string;
  movementTime: string;
  supplierName: string;
  amountTypeLabel: string;
  amount: number;
  notes?: string | null;
  oldBalance: number;
  newBalance: number;
  formatMoney: (n: number) => string;
};

function buildSupplierMovementHtml(data: SupplierMovementReceiptData) {
  const oldParty = purchaseBalancePartyLabel(
    data.oldBalance,
    data.supplierName,
    data.restaurantName
  );
  const newParty = purchaseBalancePartyLabel(
    data.newBalance,
    data.supplierName,
    data.restaurantName
  );
  const rawLogo = data.logoUrl?.trim() || "";
  const logoSrc = rawLogo.replace(/"/g, "");
  const logo = logoSrc ? `<img class="logo" src="${logoSrc}" alt="" />` : "";
  const phone = data.mobile?.trim() || "";
  const dateLabel = formatDisplayDateForApp(data.movementDate, data.movementDate);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>حركة مورد ${esc(data.invoiceNo)} — 80×80</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: #fff;
      color: #000;
      font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", "Arial", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { width: 80mm; }
    .ticket {
      width: 72mm;
      margin: 0 auto;
      padding: 3.5mm 4mm 4.5mm;
      color: #000;
    }
    .identity { text-align: center; margin-bottom: 2.5mm; }
    .logo {
      display: block;
      max-width: 22mm;
      max-height: 18mm;
      margin: 0 auto 1.5mm;
      object-fit: contain;
    }
    .brand {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.02em;
      line-height: 1.25;
      color: #000;
    }
    .phone {
      margin-top: 0.8mm;
      font-size: 12px;
      font-weight: 700;
      color: #000;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    .doc-title {
      margin: 2mm 0 2.2mm;
      text-align: center;
      font-size: 13px;
      font-weight: 800;
      color: #000;
      letter-spacing: 0.04em;
    }
    .rule {
      border: 0;
      border-top: 1.4px solid #000;
      margin: 1.8mm 0;
    }
    .rule-soft {
      border: 0;
      border-top: 1px dashed #222;
      margin: 1.6mm 0;
    }
    .meta { display: grid; gap: 1.2mm; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 2mm;
      font-size: 12.5px;
      font-weight: 700;
      color: #000;
      line-height: 1.35;
    }
    .row span:last-child {
      font-weight: 800;
      text-align: left;
      direction: ltr;
      unicode-bidi: plaintext;
      white-space: nowrap;
    }
    .row .label { font-weight: 700; color: #000; }
    .amount-card {
      margin: 2.2mm 0;
      padding: 2.4mm 2.2mm;
      border: 1.6px solid #000;
      border-radius: 1.6mm;
      text-align: center;
    }
    .amount-card .kicker {
      font-size: 11px;
      font-weight: 700;
      color: #000;
      margin-bottom: 0.8mm;
    }
    .amount-card .value {
      font-size: 18px;
      font-weight: 900;
      color: #000;
      letter-spacing: 0.03em;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    .amount-card .type {
      margin-top: 1mm;
      font-size: 12.5px;
      font-weight: 800;
      color: #000;
    }
    .balance-box {
      margin-top: 1.5mm;
      padding: 1.8mm 1.6mm;
      border: 1px solid #111;
      border-radius: 1.4mm;
    }
    .balance-box .row {
      font-size: 12px;
      margin: 0.6mm 0;
    }
    .party {
      display: block;
      font-size: 10.5px;
      font-weight: 700;
      opacity: 0.85;
      margin-top: 0.3mm;
    }
    .notes {
      margin-top: 1.6mm;
      font-size: 12px;
      font-weight: 700;
      color: #000;
      line-height: 1.4;
      word-break: break-word;
    }
    .footer {
      margin-top: 3mm;
      text-align: center;
      font-size: 12px;
      font-weight: 800;
      color: #000;
      letter-spacing: 0.06em;
    }
    @media print {
      html, body { width: 80mm; }
      .ticket { width: 72mm; padding-left: 4mm; padding-right: 4mm; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="identity">
      ${logo}
      <h1 class="brand">${esc(data.restaurantName || "المطعم")}</h1>
      ${phone ? `<p class="phone">${esc(phone)}</p>` : ""}
    </div>
    <p class="doc-title">حركة مورد</p>
    <hr class="rule" />
    <div class="meta">
      <div class="row"><span class="label">رقم الفاتورة</span><span>${esc(data.invoiceNo)}</span></div>
      <div class="row"><span class="label">التاريخ</span><span>${esc(dateLabel)}</span></div>
      <div class="row"><span class="label">الساعة</span><span>${esc(data.movementTime)}</span></div>
      <div class="row"><span class="label">المورد</span><span style="white-space:normal;text-align:start;direction:rtl">${esc(data.supplierName)}</span></div>
    </div>
    <div class="amount-card">
      <div class="kicker">المبلغ</div>
      <div class="value">${esc(data.formatMoney(data.amount))}</div>
      <div class="type">${esc(data.amountTypeLabel)}</div>
    </div>
    <hr class="rule-soft" />
    <div class="balance-box">
      <div class="row">
        <span>رصيد قديم<span class="party">${esc(oldParty)}</span></span>
        <span>${esc(data.formatMoney(Math.abs(data.oldBalance)))}</span>
      </div>
      <div class="row">
        <span>باقي الرصيد<span class="party">${esc(newParty)}</span></span>
        <span>${esc(data.formatMoney(Math.abs(data.newBalance)))}</span>
      </div>
    </div>
    ${
      data.notes?.trim()
        ? `<p class="notes"><strong>ملاحظة:</strong> ${esc(data.notes.trim())}</p>`
        : ""
    }
    <p class="footer">شكراً لتعاملكم</p>
  </div>
</body>
</html>`;
}

/** Professional supplier movement voucher for 80mm thermal paper */
export function printSupplierMovementThermal(data: SupplierMovementReceiptData) {
  const html = buildSupplierMovementHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const popup = window.open(
    url,
    "rms-supplier-movement-receipt",
    "width=420,height=760,left=80,top=40"
  );

  if (popup) {
    let printed = false;
    const start = () => {
      if (printed) return;
      printed = true;
      printFromWindow(popup);
      window.setTimeout(() => URL.revokeObjectURL(url), 8000);
    };
    popup.onload = start;
    window.setTimeout(() => {
      try {
        if (popup.document?.readyState === "complete") start();
      } catch {
        start();
      }
    }, 400);
    return;
  }

  URL.revokeObjectURL(url);
  const iframe = document.createElement("iframe");
  iframe.title = "حركة مورد 80×80";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:80mm;height:1400px;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!win || !doc) {
    iframe.remove();
    throw new Error("تعذر تجهيز نافذة الطباعة — افتح النظام في المتصفح واسمح بالنوافذ المنبثقة");
  }

  doc.open();
  doc.write(html);
  doc.close();

  void waitForImages(doc).then(() => {
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } finally {
        window.setTimeout(() => iframe.remove(), 1500);
      }
    }, 100);
  });
}

export type SupplierStatementReceiptLine = {
  dateLabel: string;
  docType: string;
  invoiceNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  kind?: string;
};

export type SupplierStatementReceiptData = {
  restaurantName: string;
  logoUrl?: string | null;
  mobile?: string | null;
  supplierName: string;
  supplierCode: string;
  fromLabel: string;
  toLabel: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  balanceLabel: string;
  lines: SupplierStatementReceiptLine[];
  formatMoney: (n: number) => string;
};

function statementTypeClass(docType: string) {
  if (docType === "شراء" || docType === "واصل") return "type-blue";
  if (docType === "مرجوع" || docType === "مدفوع" || docType === "خصم") return "type-red";
  return "";
}

function buildSupplierStatementA4Html(data: SupplierStatementReceiptData) {
  const rawLogo = data.logoUrl?.trim() || "";
  const logoSrc = rawLogo.replace(/"/g, "");
  const logo = logoSrc ? `<img class="logo" src="${logoSrc}" alt="" />` : "";
  const phone = data.mobile?.trim() || "";

  const rows = data.lines
    .map((l) => {
      const balClass = l.balance > 0 ? "pos" : l.balance < 0 ? "neg" : "";
      const openClass = l.kind === "opening" ? "row-open" : "";
      return `<tr class="${openClass}">
        <td class="num" dir="ltr">${esc(l.dateLabel)}</td>
        <td class="type ${statementTypeClass(l.docType)}">${esc(l.docType)}</td>
        <td class="num" dir="ltr">${esc(l.invoiceNo)}</td>
        <td class="note">${esc(l.description || "—")}</td>
        <td class="num" dir="ltr">${esc(data.formatMoney(l.debit))}</td>
        <td class="num" dir="ltr">${esc(data.formatMoney(l.credit))}</td>
        <td class="num bal ${balClass}" dir="ltr">${esc(data.formatMoney(l.balance))}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>كشف حساب المورد — ${esc(data.supplierName)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 12mm 14mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0f172a;
      font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { width: 210mm; margin: 0 auto; }
    .sheet { width: 100%; padding: 0; color: #0f172a; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 2.5px solid #0f172a;
      margin-bottom: 14px;
    }
    .brand-block { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .logo {
      width: 54px;
      height: 54px;
      object-fit: contain;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 800;
      margin: 0;
      line-height: 1.25;
      color: #0f172a;
    }
    .brand-phone {
      margin: 3px 0 0;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    .doc-side { text-align: left; }
    .doc-title {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: #0f172a;
    }
    .doc-sub {
      margin: 4px 0 0;
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .info-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
      padding: 10px 12px;
    }
    .info-card .k {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 4px;
    }
    .info-card .v {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.35;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .stat {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 10px 11px;
      background: #fff;
    }
    .stat.accent {
      border-color: #cbd5e1;
      background: #f1f5f9;
    }
    .stat .k {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 4px;
    }
    .stat .v {
      font-size: 14px;
      font-weight: 800;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 13px;
      font-weight: 700;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }
    thead th {
      background: #0f172a;
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      padding: 10px 8px;
      text-align: center;
      border: 0;
    }
    tbody td {
      padding: 9px 8px;
      text-align: center;
      border-bottom: 1px solid #eef2f7;
      color: #0f172a;
      font-size: 13px;
      font-weight: 700;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr.row-open td { background: #e2e8f0; font-weight: 800; }
    td.num { font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
    td.note { font-size: 12.5px; color: #334155; max-width: 160px; word-break: break-word; }
    td.type { font-size: 13.5px; font-weight: 800; }
    .type-blue { color: #0284c7 !important; }
    .type-red { color: #dc2626 !important; }
    .pos { color: #b45309 !important; }
    .neg { color: #047857 !important; }
    .bal { font-weight: 800; }
    .footer {
      margin-top: 16px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
    }
    @media print {
      html, body { width: auto; }
      .sheet { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand-block">
        ${logo}
        <div>
          <h1 class="brand-name">${esc(data.restaurantName || "المطعم")}</h1>
          ${phone ? `<p class="brand-phone">${esc(phone)}</p>` : ""}
        </div>
      </div>
      <div class="doc-side">
        <p class="doc-title">كشف حساب المورد</p>
        <p class="doc-sub">تقرير A4 · فترة محددة</p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="k">المورد</div>
        <div class="v">${esc(data.supplierName)}</div>
      </div>
      <div class="info-card">
        <div class="k">كود المورد</div>
        <div class="v" dir="ltr">${esc(data.supplierCode)}</div>
      </div>
      <div class="info-card">
        <div class="k">الفترة</div>
        <div class="v" dir="ltr">${esc(data.fromLabel)} — ${esc(data.toLabel)}</div>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="k">رصيد مرحّل</div>
        <div class="v">${esc(data.formatMoney(data.openingBalance))}</div>
      </div>
      <div class="stat">
        <div class="k">مجموع مدين</div>
        <div class="v">${esc(data.formatMoney(data.totalDebit))}</div>
      </div>
      <div class="stat">
        <div class="k">مجموع دائن</div>
        <div class="v">${esc(data.formatMoney(data.totalCredit))}</div>
      </div>
      <div class="stat accent">
        <div class="k">الرصيد النهائي · ${esc(data.balanceLabel)}</div>
        <div class="v">${esc(data.formatMoney(data.closingBalance))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>النوع</th>
          <th>رقم الفاتورة</th>
          <th>البيان</th>
          <th>مدين</th>
          <th>دائن</th>
          <th>الرصيد</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="footer">
      <span>تم إنشاء التقرير تلقائياً من نظام إدارة المطاعم</span>
      <span>شكراً لتعاملكم</span>
    </div>
  </div>
</body>
</html>`;
}

function openPrintHtmlDocument(
  html: string,
  windowName: string,
  opts?: { landscape?: boolean }
) {
  const landscape = Boolean(opts?.landscape);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(
    url,
    windowName,
    landscape
      ? "width=1200,height=860,left=20,top=20"
      : "width=980,height=820,left=40,top=20"
  );

  if (popup) {
    let printed = false;
    const start = () => {
      if (printed) return;
      printed = true;
      printFromWindow(popup);
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    popup.onload = start;
    window.setTimeout(() => {
      try {
        if (popup.document?.readyState === "complete") start();
      } catch {
        start();
      }
    }, 400);
    return;
  }

  URL.revokeObjectURL(url);
  const iframe = document.createElement("iframe");
  iframe.title = landscape ? "تقرير A4 أفقي" : "تقرير A4";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = landscape
    ? "position:fixed;left:-10000px;top:0;width:297mm;height:210mm;border:0;opacity:0;pointer-events:none;z-index:-1;"
    : "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!win || !doc) {
    iframe.remove();
    throw new Error("تعذر فتح تقرير الطباعة — اسمح بالنوافذ المنبثقة ثم أعد المحاولة");
  }
  doc.open();
  doc.write(html);
  doc.close();
  void waitForImages(doc).then(() => {
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } finally {
        window.setTimeout(() => iframe.remove(), 1500);
      }
    }, 120);
  });
}

/** Professional A4 supplier account statement */
export function printSupplierStatementA4(data: SupplierStatementReceiptData) {
  openPrintHtmlDocument(
    buildSupplierStatementA4Html(data),
    "rms-supplier-statement-a4"
  );
}

export type ExpenseThermalReceiptData = {
  restaurantName: string;
  logoUrl?: string | null;
  mobile?: string | null;
  invoiceNo: string;
  expenseDate: string;
  expenseTypeName: string;
  branchName: string;
  amount: number;
  notes?: string | null;
  formatMoney: (n: number) => string;
};

function buildExpenseThermalHtml(data: ExpenseThermalReceiptData) {
  const rawLogo = data.logoUrl?.trim() || "";
  const logoSrc = rawLogo.replace(/"/g, "");
  const logo = logoSrc ? `<img class="logo" src="${logoSrc}" alt="" />` : "";
  const phone = data.mobile?.trim() || "";
  const dateLabel = formatDisplayDateForApp(data.expenseDate, data.expenseDate);
  const notes = data.notes?.trim() || "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>مصروف ${esc(data.invoiceNo)} — 80×80</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: #fff;
      color: #000;
      font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", "Arial", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { width: 80mm; }
    .ticket {
      width: 72mm;
      margin: 0 auto;
      padding: 3.5mm 4mm 4.5mm;
      color: #000;
    }
    .identity { text-align: center; margin-bottom: 2.5mm; }
    .logo {
      display: block;
      max-width: 22mm;
      max-height: 18mm;
      margin: 0 auto 1.5mm;
      object-fit: contain;
    }
    .brand {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.02em;
      line-height: 1.25;
    }
    .phone {
      margin-top: 0.8mm;
      font-size: 12px;
      font-weight: 700;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    .doc-title {
      margin: 2mm 0 2.2mm;
      text-align: center;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .rule {
      border: 0;
      border-top: 1.5px dashed #000;
      margin: 2mm 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.45;
      margin: 1mm 0;
    }
    .row .k { color: #111; flex-shrink: 0; }
    .row .v { text-align: left; font-weight: 800; word-break: break-word; }
    .amount-box {
      margin: 2.5mm 0 1.5mm;
      border: 2px solid #000;
      border-radius: 2mm;
      padding: 2.2mm 2.5mm;
      text-align: center;
    }
    .amount-box .lab {
      font-size: 11px;
      font-weight: 800;
      margin-bottom: 0.8mm;
    }
    .amount-box .val {
      font-size: 18px;
      font-weight: 900;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    .notes {
      margin-top: 1.5mm;
      font-size: 11.5px;
      font-weight: 700;
      line-height: 1.4;
      word-break: break-word;
    }
    .footer {
      margin-top: 2.5mm;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="identity">
      ${logo}
      <div class="brand">${esc(data.restaurantName || "المطعم")}</div>
      ${phone ? `<div class="phone">${esc(phone)}</div>` : ""}
    </div>
    <div class="doc-title">سند مصروف</div>
    <hr class="rule" />
    <div class="row"><span class="k">رقم القائمة</span><span class="v" dir="ltr">${esc(data.invoiceNo)}</span></div>
    <div class="row"><span class="k">التاريخ</span><span class="v" dir="ltr">${esc(dateLabel)}</span></div>
    <div class="row"><span class="k">نوع المصروف</span><span class="v">${esc(data.expenseTypeName || "—")}</span></div>
    <div class="row"><span class="k">الفرع</span><span class="v">${esc(data.branchName || "—")}</span></div>
    <div class="amount-box">
      <div class="lab">المبلغ</div>
      <div class="val">${esc(data.formatMoney(data.amount))}</div>
    </div>
    ${notes ? `<div class="notes"><strong>ملاحظة:</strong> ${esc(notes)}</div>` : ""}
    <hr class="rule" />
    <div class="footer">شكراً لكم</div>
  </div>
</body>
</html>`;
}

/** Professional expense voucher for 80mm thermal paper */
export function printExpenseThermal(data: ExpenseThermalReceiptData) {
  const html = buildExpenseThermalHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(
    url,
    "rms-expense-thermal",
    "width=420,height=780,left=80,top=40"
  );

  if (popup) {
    let printed = false;
    const start = () => {
      if (printed) return;
      printed = true;
      printFromWindow(popup);
      window.setTimeout(() => URL.revokeObjectURL(url), 8000);
    };
    popup.onload = start;
    window.setTimeout(() => {
      try {
        if (popup.document?.readyState === "complete") start();
      } catch {
        start();
      }
    }, 400);
    return;
  }

  URL.revokeObjectURL(url);
  openPrintHtmlDocument(html, "rms-expense-thermal-iframe");
}

export type ExpenseReportA4Line = {
  invoiceNo: string;
  dateLabel: string;
  typeName: string;
  branchName: string;
  amount: number;
  notes?: string | null;
};

export type ExpenseReportA4Data = {
  restaurantName: string;
  logoUrl?: string | null;
  mobile?: string | null;
  fromLabel: string;
  toLabel: string;
  filterSummary: string;
  totalAmount: number;
  count: number;
  lines: ExpenseReportA4Line[];
  formatMoney: (n: number) => string;
};

function buildExpenseReportA4LandscapeHtml(data: ExpenseReportA4Data) {
  const rawLogo = data.logoUrl?.trim() || "";
  const logoSrc = rawLogo.replace(/"/g, "");
  const logo = logoSrc ? `<img class="logo" src="${logoSrc}" alt="" />` : "";
  const phone = data.mobile?.trim() || "";

  const rows = data.lines
    .map(
      (l, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td class="num" dir="ltr">${esc(l.invoiceNo)}</td>
        <td class="num" dir="ltr">${esc(l.dateLabel)}</td>
        <td>${esc(l.typeName || "—")}</td>
        <td>${esc(l.branchName || "—")}</td>
        <td class="num amount" dir="ltr">${esc(data.formatMoney(l.amount))}</td>
        <td class="note">${esc(l.notes?.trim() || "—")}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير المصاريف — A4 أفقي</title>
  <style>
    /* Force landscape for Chromium / Edge / Firefox print dialogs */
    @page {
      size: A4 landscape;
      size: 297mm 210mm;
      margin: 10mm 12mm 12mm;
    }
    @media print {
      @page {
        size: A4 landscape;
        size: 297mm 210mm;
        margin: 10mm 12mm 12mm;
      }
      html, body {
        width: 297mm !important;
        height: 210mm !important;
      }
      .sheet { width: 277mm !important; max-width: 277mm !important; }
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0f172a;
      font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { width: 297mm; min-height: 210mm; margin: 0 auto; }
    .sheet { width: 100%; max-width: 297mm; padding: 0; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 10px;
      border-bottom: 2.5px solid #0f172a;
      margin-bottom: 12px;
    }
    .brand-block { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .logo {
      width: 52px;
      height: 52px;
      object-fit: contain;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .brand-name {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.25;
      color: #0f172a;
    }
    .brand-phone {
      margin: 3px 0 0;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      direction: ltr;
      unicode-bidi: plaintext;
    }
    .doc-side { text-align: left; }
    .doc-title {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.03em;
      color: #0f172a;
    }
    .doc-sub {
      margin: 4px 0 0;
      font-size: 13px;
      font-weight: 700;
      color: #64748b;
    }
    .meta {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .meta-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
      padding: 10px 12px;
    }
    .meta-card .k {
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 4px;
    }
    .meta-card .v {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.35;
    }
    .meta-card.accent {
      border-color: #cbd5e1;
      background: #f1f5f9;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 14px;
      font-weight: 700;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }
    thead th {
      background: #0f172a;
      color: #fff;
      font-size: 14px;
      font-weight: 800;
      padding: 11px 9px;
      text-align: center;
      border: 0;
    }
    tbody td {
      padding: 10px 9px;
      text-align: center;
      border-bottom: 1px solid #eef2f7;
      color: #0f172a;
      font-size: 14px;
      font-weight: 700;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    tbody tr:last-child td { border-bottom: 0; }
    td.num { font-variant-numeric: tabular-nums; }
    td.amount { font-weight: 800; color: #b91c1c; }
    td.note {
      font-size: 13px;
      color: #334155;
      max-width: 220px;
      word-break: break-word;
    }
    .empty {
      padding: 28px;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      color: #64748b;
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
    }
    .footer {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
    }
    @media print {
      html, body { width: auto; }
      .sheet { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand-block">
        ${logo}
        <div>
          <h1 class="brand-name">${esc(data.restaurantName || "المطعم")}</h1>
          ${phone ? `<p class="brand-phone">${esc(phone)}</p>` : ""}
        </div>
      </div>
      <div class="doc-side">
        <p class="doc-title">تقرير المصاريف</p>
        <p class="doc-sub">A4 أفقي · حسب فلتر البحث</p>
      </div>
    </div>

    <div class="meta">
      <div class="meta-card">
        <div class="k">الفترة</div>
        <div class="v" dir="ltr">${esc(data.fromLabel)} — ${esc(data.toLabel)}</div>
      </div>
      <div class="meta-card">
        <div class="k">الفلاتر</div>
        <div class="v">${esc(data.filterSummary || "الكل")}</div>
      </div>
      <div class="meta-card">
        <div class="k">عدد السجلات</div>
        <div class="v" dir="ltr">${data.count}</div>
      </div>
      <div class="meta-card accent">
        <div class="k">إجمالي المصاريف</div>
        <div class="v" dir="ltr">${esc(data.formatMoney(data.totalAmount))}</div>
      </div>
    </div>

    ${
      data.lines.length
        ? `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>رقم القائمة</th>
          <th>التاريخ</th>
          <th>نوع المصروف</th>
          <th>الفرع</th>
          <th>المبلغ</th>
          <th>ملاحظات</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
        : `<div class="empty">لا توجد مصاريف مطابقة للبحث الحالي</div>`
    }

    <div class="footer">
      <span>تم إنشاء التقرير تلقائياً من نظام إدارة المطاعم</span>
      <span>خط التقرير: 14 Bold · تصميم احترافي</span>
    </div>
  </div>
</body>
</html>`;
}

/** Professional A4 landscape expenses report (filtered CRUD view) */
export function printExpenseReportA4Landscape(data: ExpenseReportA4Data) {
  openPrintHtmlDocument(
    buildExpenseReportA4LandscapeHtml(data),
    "rms-expense-report-a4-landscape",
    { landscape: true }
  );
}

export type WarehouseStockReportLine = {
  code: string;
  nameAr: string;
  categoryNameAr: string;
  remainingLabel: string;
  costPerMinor: number;
  totalCost: number;
};

export type WarehouseStockReportData = {
  restaurantName: string;
  branchName?: string | null;
  logoUrl?: string | null;
  mobile?: string | null;
  printedAtLabel: string;
  formatMoney: (n: number) => string;
  lines: WarehouseStockReportLine[];
  totalCostSum: number;
};

function buildWarehouseStockReportA4Html(data: WarehouseStockReportData) {
  const rawLogo = data.logoUrl?.trim() || "";
  const logoSrc = rawLogo.replace(/"/g, "");
  const logo = logoSrc ? `<img class="logo" src="${logoSrc}" alt="" />` : "";
  const phone = data.mobile?.trim() || "";
  const rows = data.lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td>
        <td class="amount" dir="ltr">${esc(l.code)}</td>
        <td>${esc(l.nameAr)}</td>
        <td>${esc(l.categoryNameAr || "—")}</td>
        <td class="qty">${esc(l.remainingLabel)}</td>
        <td class="amount" dir="ltr">${esc(data.formatMoney(l.costPerMinor))}</td>
        <td class="amount total" dir="ltr">${esc(data.formatMoney(l.totalCost))}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير الكمية المتبقية — A4 أفقي</title>
  <style>
    /*
      Page box = A4 landscape. Margins 0.6cm are ONLY on @page.
      Content must be width:100% of the printable area — never 297mm —
      otherwise the left/right edge is cut and a blank 2nd page appears.
    */
    @page {
      size: A4 landscape;
      size: 297mm 210mm;
      margin: 0.6cm;
    }
    @media print {
      @page {
        size: A4 landscape;
        size: 297mm 210mm;
        margin: 0.6cm;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      .sheet {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        page-break-after: avoid;
        page-break-inside: avoid;
      }
      .header, .totals, .footer, table.stock, table.stock tr {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #fff;
      color: #0b1220;
      font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif;
      font-size: 14px;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      margin: 0 0 8px;
      border-radius: 10px;
      background: linear-gradient(115deg, #0f172a 0%, #1e293b 55%, #0ea5e9 160%);
      color: #fff;
    }
    .brand-block { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
    .logo {
      width: 44px; height: 44px; object-fit: contain; border-radius: 9px;
      border: 1px solid rgba(255,255,255,0.25); background: #fff; flex-shrink: 0;
    }
    .brand-name { margin: 0; font-size: 17px; font-weight: 800; line-height: 1.2; }
    .brand-meta { margin: 2px 0 0; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.82); }
    .doc-side { text-align: left; flex-shrink: 0; max-width: 42%; }
    .doc-title { margin: 0; font-size: 15px; font-weight: 800; }
    .doc-sub { margin: 2px 0 0; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.8); }
    table.stock {
      width: 100%;
      max-width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      direction: rtl;
      margin: 0;
    }
    table.stock thead { display: table-header-group; }
    table.stock tbody { display: table-row-group; }
    table.stock th, table.stock td {
      border: 1px solid #cbd5e1;
      padding: 6px 4px;
      text-align: center;
      vertical-align: middle;
      font-size: 14px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    table.stock th {
      background: #0f172a;
      color: #fff;
      font-weight: 800;
      border-color: #0f172a;
      line-height: 1.25;
    }
    table.stock col.c-idx { width: 5%; }
    table.stock col.c-code { width: 12%; }
    table.stock col.c-name { width: 18%; }
    table.stock col.c-cat { width: 14%; }
    table.stock col.c-qty { width: 16%; }
    table.stock col.c-cost { width: 17%; }
    table.stock col.c-total { width: 18%; }
    table.stock tbody tr:nth-child(even) td { background: #f8fafc; }
    .qty { color: #047857; font-weight: 800; }
    .amount { font-variant-numeric: tabular-nums; }
    .total { color: #0369a1; font-weight: 800; }
    .totals {
      margin: 8px 0 0;
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      background: #f1f5f9;
      font-size: 14px;
      font-weight: 800;
      text-align: center;
    }
    .totals span {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0;
    }
    .footer {
      margin: 8px 0 0;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand-block">
        ${logo}
        <div>
          <p class="brand-name">${esc(data.restaurantName || "المطعم")}</p>
          <p class="brand-meta">${esc(data.branchName || "كل الفروع")}${phone ? ` · ${esc(phone)}` : ""}</p>
        </div>
      </div>
      <div class="doc-side">
        <p class="doc-title">تقرير الكمية المتبقية حسب الصنف</p>
        <p class="doc-sub">${esc(data.printedAtLabel)}</p>
      </div>
    </div>
    <table class="stock">
      <colgroup>
        <col class="c-idx" />
        <col class="c-code" />
        <col class="c-name" />
        <col class="c-cat" />
        <col class="c-qty" />
        <col class="c-cost" />
        <col class="c-total" />
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>كود الصنف</th>
          <th>اسم الصنف</th>
          <th>الفئة</th>
          <th>الكمية المتبقية</th>
          <th>سعر التكلفة<br/>(وحدة صغرى)</th>
          <th>المجموع</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="7">لا توجد أصناف</td></tr>`}</tbody>
    </table>
    <div class="totals">
      <span>عدد الأصناف: ${data.lines.length}</span>
      <span>إجمالي قيمة المخزون: ${esc(data.formatMoney(data.totalCostSum))}</span>
    </div>
    <div class="footer">
      <span>تم إنشاء التقرير تلقائياً من نظام إدارة المطاعم</span>
      <span>A4 أفقي · هوامش 0.6 سم · خط 14 Bold</span>
    </div>
  </div>
</body>
</html>`;
}

/** Professional A4 landscape warehouse remaining-qty report (14px bold). */
export function printWarehouseStockReportA4(data: WarehouseStockReportData) {
  openPrintHtmlDocument(
    buildWarehouseStockReportA4Html(data),
    "rms-warehouse-stock-a4",
    { landscape: true }
  );
}

export type VaultReportLine = {
  dateLabel: string;
  sourceAr: string;
  label: string;
  invoiceNo?: string | null;
  debit: number;
  credit: number;
  balanceAfter: number;
};

export type VaultReportAccount = {
  titleAr: string;
  kind?: "cash" | "card";
  openingBeforeFrom: number;
  periodDebit: number;
  periodCredit: number;
  periodNet?: number;
  closingBalance: number;
  lines: VaultReportLine[];
};

export type VaultReportData = {
  restaurantName: string;
  logoUrl?: string | null;
  mobile?: string | null;
  branchLabel?: string | null;
  /** بدون بطاقة / اسم البطاقة / كل الحسابات */
  cardFilterLabel?: string | null;
  fromLabel: string;
  toLabel: string;
  openingAsOfLabel: string;
  accounts: VaultReportAccount[];
  formatMoney: (n: number) => string;
};

function escVault(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function vaultKindBadge(kind?: "cash" | "card") {
  if (kind === "card") return `<span class="badge badge-card">بطاقة</span>`;
  return `<span class="badge badge-cash">بدون بطاقة</span>`;
}

function buildVaultA4Html(data: VaultReportData) {
  const logoSrc = (data.logoUrl?.trim() || "").replace(/"/g, "");
  const logo = logoSrc ? `<img class="logo" src="${logoSrc}" alt="" />` : "";
  const phone = data.mobile?.trim() || "";
  const branch = data.branchLabel?.trim() || "كل الفروع";
  const cardFilter = data.cardFilterLabel?.trim() || "كل الحسابات";
  const nowLabel = new Date().toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalClosing = data.accounts.reduce((s, a) => s + Number(a.closingBalance || 0), 0);
  const totalDebit = data.accounts.reduce((s, a) => s + Number(a.periodDebit || 0), 0);
  const totalCredit = data.accounts.reduce((s, a) => s + Number(a.periodCredit || 0), 0);

  const overviewRows = data.accounts
    .map((acc, i) => {
      const net = Number(
        acc.periodNet ?? Number(acc.periodCredit || 0) - Number(acc.periodDebit || 0)
      );
      return `<tr>
        <td>${i + 1}</td>
        <td class="acc-name">${escVault(acc.titleAr)} ${vaultKindBadge(acc.kind)}</td>
        <td class="num" dir="ltr">${escVault(data.formatMoney(acc.openingBeforeFrom))}</td>
        <td class="num debit" dir="ltr">${escVault(data.formatMoney(acc.periodDebit))}</td>
        <td class="num credit" dir="ltr">${escVault(data.formatMoney(acc.periodCredit))}</td>
        <td class="num ${net >= 0 ? "credit" : "debit"}" dir="ltr">${escVault(data.formatMoney(net))}</td>
        <td class="num bal" dir="ltr">${escVault(data.formatMoney(acc.closingBalance))}</td>
      </tr>`;
    })
    .join("");

  const detailBlocks = data.accounts
    .map((acc) => {
      const rows = acc.lines
        .map(
          (l, i) => `<tr>
          <td>${i + 1}</td>
          <td class="num" dir="ltr">${escVault(l.dateLabel)}</td>
          <td><span class="chip ${l.debit > 0 ? "chip-out" : "chip-in"}">${escVault(l.sourceAr)}</span></td>
          <td class="note">${escVault(l.label)}</td>
          <td class="num" dir="ltr">${escVault(l.invoiceNo || "—")}</td>
          <td class="num debit" dir="ltr">${l.debit ? escVault(data.formatMoney(l.debit)) : "—"}</td>
          <td class="num credit" dir="ltr">${l.credit ? escVault(data.formatMoney(l.credit)) : "—"}</td>
          <td class="num bal" dir="ltr">${escVault(data.formatMoney(l.balanceAfter))}</td>
        </tr>`
        )
        .join("");

      return `<section class="acc">
        <div class="acc-head">
          <div class="acc-title">
            <h2>${escVault(acc.titleAr)}</h2>
            ${vaultKindBadge(acc.kind)}
          </div>
          <div class="acc-stats">
            <div class="pill"><span>قبل الفترة</span><b dir="ltr">${escVault(data.formatMoney(acc.openingBeforeFrom))}</b></div>
            <div class="pill out"><span>مدين</span><b dir="ltr">${escVault(data.formatMoney(acc.periodDebit))}</b></div>
            <div class="pill in"><span>دائن</span><b dir="ltr">${escVault(data.formatMoney(acc.periodCredit))}</b></div>
            <div class="pill accent"><span>ختامي</span><b dir="ltr">${escVault(data.formatMoney(acc.closingBalance))}</b></div>
          </div>
        </div>
        <table class="detail">
          <thead>
            <tr>
              <th>#</th><th>التاريخ</th><th>النوع</th><th>البيان</th><th>الرقم</th>
              <th>مدين</th><th>دائن</th><th>الرصيد</th>
            </tr>
          </thead>
          <tbody>${
            rows ||
            `<tr><td colspan="8" class="empty">لا حركات في هذه الفترة</td></tr>`
          }</tbody>
        </table>
      </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>تقرير القاصة</title>
<style>
  @page { size: A4 portrait; margin: 11mm 12mm 13mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #fff; color: #0f172a;
    font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  body { width: 210mm; margin: 0 auto; font-size: 12.5px; font-weight: 700; }
  .sheet { padding: 0; }
  .header {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    padding-bottom: 12px; border-bottom: 2.5px solid #0f172a; margin-bottom: 14px;
  }
  .brand-block { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .logo {
    width: 56px; height: 56px; object-fit: contain; border-radius: 12px;
    border: 1px solid #e2e8f0; background: #f8fafc;
  }
  .brand-name { margin: 0; font-size: 18px; font-weight: 800; line-height: 1.25; }
  .brand-phone { margin: 3px 0 0; font-size: 12.5px; font-weight: 700; color: #475569; direction: ltr; unicode-bidi: plaintext; }
  .doc-side { text-align: left; }
  .doc-kicker {
    display: inline-block; margin: 0 0 6px; padding: 3px 10px; border-radius: 999px;
    background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;
    font-size: 11px; font-weight: 800;
  }
  .doc-title { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: 0.02em; }
  .doc-sub { margin: 4px 0 0; font-size: 12px; font-weight: 700; color: #64748b; }
  .info-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;
  }
  .info-card {
    border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px;
    background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
  }
  .info-card .k { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
  .info-card .v { font-size: 13.5px; font-weight: 800; color: #0f172a; line-height: 1.35; }
  .section-label {
    margin: 4px 0 8px; font-size: 13px; font-weight: 800; color: #0f172a;
    display: flex; align-items: center; gap: 8px;
  }
  .section-label::after {
    content: ""; flex: 1; height: 1px; background: linear-gradient(to left, transparent, #cbd5e1);
  }
  table.overview, table.detail {
    width: 100%; border-collapse: separate; border-spacing: 0;
    border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 14px;
  }
  thead th {
    background: #0f172a; color: #fff; font-size: 12px; font-weight: 800;
    padding: 9px 7px; text-align: center; border: 0;
  }
  tbody td {
    padding: 8px 7px; text-align: center; border-bottom: 1px solid #eef2f7;
    vertical-align: middle; font-size: 12.5px; font-weight: 700;
  }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody tr:last-child td { border-bottom: 0; }
  td.num { font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
  td.note { font-size: 12px; color: #334155; max-width: 170px; word-break: break-word; }
  td.acc-name { font-weight: 800; text-align: right; padding-inline: 10px; }
  td.debit { color: #dc2626 !important; }
  td.credit { color: #059669 !important; }
  td.bal { font-weight: 800; color: #0f172a; }
  td.empty { color: #94a3b8; padding: 18px !important; }
  .badge {
    display: inline-block; margin-inline-start: 6px; padding: 2px 8px; border-radius: 999px;
    font-size: 10px; font-weight: 800; vertical-align: middle;
  }
  .badge-cash { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
  .badge-card { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .chip {
    display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 800;
  }
  .chip-in { background: #ecfdf5; color: #047857; }
  .chip-out { background: #fff1f2; color: #be123c; }
  .totals {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: -4px 0 16px;
  }
  .total-card {
    border-radius: 12px; border: 1px solid #e2e8f0; padding: 10px 12px; background: #fff;
  }
  .total-card.accent { background: #0f172a; color: #fff; border-color: #0f172a; }
  .total-card .k { font-size: 11px; font-weight: 700; opacity: 0.75; margin-bottom: 4px; }
  .total-card .v { font-size: 15px; font-weight: 800; direction: ltr; unicode-bidi: plaintext; }
  .acc { margin-top: 18px; page-break-inside: avoid; }
  .acc-head { margin-bottom: 8px; }
  .acc-title { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .acc-title h2 { margin: 0; font-size: 15px; font-weight: 800; }
  .acc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .pill {
    border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; background: #fff;
  }
  .pill span { display: block; font-size: 10.5px; font-weight: 700; color: #64748b; margin-bottom: 3px; }
  .pill b { font-size: 13px; font-weight: 800; }
  .pill.in { background: #ecfdf5; border-color: #a7f3d0; }
  .pill.in b { color: #047857; }
  .pill.out { background: #fff1f2; border-color: #fecdd3; }
  .pill.out b { color: #be123c; }
  .pill.accent { background: #eff6ff; border-color: #bfdbfe; }
  .pill.accent b { color: #1d4ed8; }
  .footer {
    margin-top: 16px; padding-top: 10px; border-top: 1px dashed #cbd5e1;
    display: flex; justify-content: space-between; gap: 12px;
    font-size: 11.5px; font-weight: 700; color: #64748b;
  }
  @media print {
    html, body { width: auto; }
    .acc { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand-block">
        ${logo}
        <div>
          <p class="brand-name">${escVault(data.restaurantName)}</p>
          ${phone ? `<p class="brand-phone">${escVault(phone)}</p>` : ""}
        </div>
      </div>
      <div class="doc-side">
        <div class="doc-kicker">كشف مالي · Vault</div>
        <h1 class="doc-title">تقرير القاصة</h1>
        <p class="doc-sub">حسب الفرع · بدون بطاقة ولكل بطاقة</p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-card"><div class="k">فلتر الفرع</div><div class="v">${escVault(branch)}</div></div>
      <div class="info-card"><div class="k">فلتر البطاقة</div><div class="v">${escVault(cardFilter)}</div></div>
      <div class="info-card"><div class="k">من تاريخ</div><div class="v" dir="ltr">${escVault(data.fromLabel)}</div></div>
      <div class="info-card"><div class="k">إلى تاريخ</div><div class="v" dir="ltr">${escVault(data.toLabel)}</div></div>
    </div>
    <div class="info-grid" style="grid-template-columns: 1fr 1fr; margin-top: -4px;">
      <div class="info-card"><div class="k">رصيد ما قبل</div><div class="v" dir="ltr">${escVault(data.openingAsOfLabel)}</div></div>
      <div class="info-card"><div class="k">عدد الحسابات في التقرير</div><div class="v">${data.accounts.length}</div></div>
    </div>

    <div class="section-label">ملخص الحسابات</div>
    <table class="overview">
      <thead>
        <tr>
          <th>#</th><th>الحساب</th><th>قبل الفترة</th><th>مدين</th><th>دائن</th><th>صافي</th><th>ختامي</th>
        </tr>
      </thead>
      <tbody>
        ${
          overviewRows ||
          `<tr><td colspan="7" class="empty">لا حسابات</td></tr>`
        }
      </tbody>
    </table>

    <div class="totals">
      <div class="total-card"><div class="k">إجمالي المدين</div><div class="v" style="color:#dc2626">${escVault(data.formatMoney(totalDebit))}</div></div>
      <div class="total-card"><div class="k">إجمالي الدائن</div><div class="v" style="color:#059669">${escVault(data.formatMoney(totalCredit))}</div></div>
      <div class="total-card accent"><div class="k">مجموع الأرصدة الختامية</div><div class="v">${escVault(data.formatMoney(totalClosing))}</div></div>
    </div>

    <div class="section-label">تفاصيل الكشوف</div>
    ${detailBlocks}

    <div class="footer">
      <span>نظام إدارة المطاعم · تقرير القاصة</span>
      <span dir="ltr">${escVault(nowLabel)}</span>
    </div>
  </div>
</body>
</html>`;
}

export function printVaultReportA4(data: VaultReportData) {
  openPrintHtmlDocument(buildVaultA4Html(data), "rms-vault-a4");
}

function buildVaultThermalHtml(data: VaultReportData) {
  const phone = data.mobile?.trim() || "";
  const branch = data.branchLabel?.trim() || "كل الفروع";
  const cardFilter = data.cardFilterLabel?.trim() || "كل الحسابات";
  const logoSrc = (data.logoUrl?.trim() || "").replace(/"/g, "");
  const logo = logoSrc
    ? `<img class="logo" src="${logoSrc}" alt="" />`
    : "";

  const overview = data.accounts
    .map((acc) => {
      const tag = acc.kind === "card" ? "بطاقة" : "نقد";
      return `<div class="ov-row">
        <div class="ov-title"><span>${escVault(acc.titleAr)}</span><span class="tag">${tag}</span></div>
        <div class="ov-line"><span>قبل</span><b dir="ltr">${escVault(data.formatMoney(acc.openingBeforeFrom))}</b></div>
        <div class="ov-line"><span>مدين</span><b class="debit" dir="ltr">${escVault(data.formatMoney(acc.periodDebit))}</b></div>
        <div class="ov-line"><span>دائن</span><b class="credit" dir="ltr">${escVault(data.formatMoney(acc.periodCredit))}</b></div>
        <div class="ov-line strong"><span>ختامي</span><b dir="ltr">${escVault(data.formatMoney(acc.closingBalance))}</b></div>
      </div>`;
    })
    .join('<div class="dash"></div>');

  const detailBlocks = data.accounts
    .map((acc) => {
      const tag = acc.kind === "card" ? "بطاقة" : "بدون بطاقة";
      const lines = acc.lines
        .map(
          (l) => `<div class="row">
          <div class="row-top">
            <span>${escVault(l.dateLabel)}</span>
            <span class="src">${escVault(l.sourceAr)}</span>
          </div>
          <div class="row-mid">${escVault(l.label)}${l.invoiceNo ? ` · ${escVault(l.invoiceNo)}` : ""}</div>
          <div class="nums">
            <span class="debit">م ${escVault(data.formatMoney(l.debit || 0))}</span>
            <span class="credit">د ${escVault(data.formatMoney(l.credit || 0))}</span>
            <span>ر ${escVault(data.formatMoney(l.balanceAfter))}</span>
          </div>
        </div>`
        )
        .join("");
      return `<div class="acc">
        <div class="acc-bar">
          <div class="acc-name">${escVault(acc.titleAr)}</div>
          <div class="acc-tag">${tag}</div>
        </div>
        <div class="acc-sum">
          <div><span>قبل</span><b dir="ltr">${escVault(data.formatMoney(acc.openingBeforeFrom))}</b></div>
          <div><span>ختامي</span><b dir="ltr">${escVault(data.formatMoney(acc.closingBalance))}</b></div>
        </div>
        ${lines || `<div class="empty">لا حركات</div>`}
      </div>`;
    })
    .join('<div class="rule"></div>');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>قاصة 80×80</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #fff; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  body {
    width: 72mm; margin: 0 auto; padding: 2.5mm 2mm 4mm;
    font-family: "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif;
    font-size: 11.5px; font-weight: 700; line-height: 1.35;
  }
  .logo { display: block; width: 34px; height: 34px; object-fit: contain; margin: 0 auto 4px; }
  .brand { text-align: center; font-size: 14px; font-weight: 800; margin: 0; }
  .kicker {
    text-align: center; margin: 4px 0 2px; font-size: 10.5px; font-weight: 800;
    letter-spacing: 0.04em;
  }
  .sub { text-align: center; font-size: 10.5px; margin: 1px 0; }
  .meta {
    margin: 6px 0 8px; border: 1px solid #111; border-radius: 6px; padding: 5px 6px;
  }
  .meta div { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; font-size: 10.5px; }
  .meta b { font-weight: 800; }
  .head-line {
    text-align: center; font-size: 11px; font-weight: 800; margin: 8px 0 5px;
    border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0;
  }
  .ov-row { margin: 4px 0; }
  .ov-title { display: flex; justify-content: space-between; align-items: center; font-weight: 800; margin-bottom: 2px; }
  .tag { font-size: 9.5px; border: 1px solid #000; border-radius: 999px; padding: 0 5px; }
  .ov-line { display: flex; justify-content: space-between; font-size: 10.5px; }
  .ov-line.strong { font-weight: 800; margin-top: 1px; }
  .dash { border-top: 1px dotted #666; margin: 5px 0; }
  .rule { border-top: 2px dashed #000; margin: 8px 0; }
  .acc { margin: 2px 0; }
  .acc-bar {
    display: flex; justify-content: space-between; align-items: center; gap: 4px;
    background: #111; color: #fff; padding: 4px 6px; border-radius: 4px; margin-bottom: 4px;
  }
  .acc-name { font-size: 11.5px; font-weight: 800; }
  .acc-tag { font-size: 9.5px; opacity: 0.9; }
  .acc-sum {
    display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px;
  }
  .acc-sum div {
    border: 1px solid #111; border-radius: 4px; padding: 3px 5px;
    display: flex; justify-content: space-between; gap: 4px; font-size: 10.5px;
  }
  .row { margin: 5px 0; padding-bottom: 4px; border-bottom: 1px dotted #999; }
  .row-top { display: flex; justify-content: space-between; gap: 4px; font-size: 10.5px; }
  .src { font-weight: 800; }
  .row-mid { font-size: 10.5px; margin: 2px 0; }
  .nums {
    display: flex; justify-content: space-between; gap: 3px;
    direction: ltr; font-variant-numeric: tabular-nums; font-size: 10.5px; font-weight: 800;
  }
  .debit { color: #111; }
  .credit { color: #111; }
  .empty { text-align: center; opacity: 0.7; padding: 6px 0; }
  .footer {
    text-align: center; margin-top: 8px; padding-top: 5px;
    border-top: 1px dashed #000; font-size: 10px;
  }
</style>
</head>
<body>
  ${logo}
  <p class="brand">${escVault(data.restaurantName)}</p>
  <div class="kicker">تقرير القاصة</div>
  ${phone ? `<div class="sub" dir="ltr">${escVault(phone)}</div>` : ""}

  <div class="meta">
    <div><span>الفرع</span><b>${escVault(branch)}</b></div>
    <div><span>البطاقة</span><b>${escVault(cardFilter)}</b></div>
    <div><span>من</span><b dir="ltr">${escVault(data.fromLabel)}</b></div>
    <div><span>إلى</span><b dir="ltr">${escVault(data.toLabel)}</b></div>
    <div><span>قبل</span><b dir="ltr">${escVault(data.openingAsOfLabel)}</b></div>
  </div>

  <div class="head-line">ملخص · نقد وبطاقات</div>
  ${overview || `<div class="empty">لا حسابات</div>`}

  <div class="head-line">تفاصيل الحركات</div>
  ${detailBlocks}

  <div class="footer">حسب الفرع · بدون بطاقة ولكل بطاقة</div>
</body>
</html>`;
}

export function printVaultReportThermal(data: VaultReportData) {
  const html = buildVaultThermalHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "rms-vault-thermal", "width=420,height=780,left=80,top=40");
  if (popup) {
    let printed = false;
    const start = () => {
      if (printed) return;
      printed = true;
      printFromWindow(popup);
      window.setTimeout(() => URL.revokeObjectURL(url), 8000);
    };
    popup.onload = start;
    window.setTimeout(() => {
      try {
        if (popup.document?.readyState === "complete") start();
      } catch {
        start();
      }
    }, 400);
    return;
  }
  URL.revokeObjectURL(url);
  openPrintHtmlDocument(html, "rms-vault-thermal-iframe");
}
