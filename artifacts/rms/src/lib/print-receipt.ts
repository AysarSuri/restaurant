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
    <div class="row"><span>التاريخ</span><span>${esc(data.dateLabel)}</span></div>
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

/**
 * Prints a professional 80×80 thermal receipt from a dedicated document window
 * (not the host Cursor/app page — avoids empty "app doesn't support print preview").
 */
export function printThermalReceipt(data: ThermalReceiptData) {
  const html = buildReceiptHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const popup = window.open(
    url,
    "rms-thermal-receipt",
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
    // Some browsers fire load before we attach the handler
    window.setTimeout(() => {
      try {
        if (popup.document?.readyState === "complete") start();
      } catch {
        start();
      }
    }, 400);
    return;
  }

  // Popup blocked — fallback: dedicated iframe with real size (not 0×0)
  URL.revokeObjectURL(url);
  const iframe = document.createElement("iframe");
  iframe.title = "فاتورة 80×80";
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
    <div class="row"><span>التاريخ</span><span>${esc(data.invoiceDate)}</span></div>
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
    <div class="row"><span>مبلغ الدفع</span><span>${esc(data.formatMoney(data.paidAmount))}</span></div>
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
