/** Detect money / price / amount / numeric value fields. */

const MONEY_RE =
  /amount|price|fee|cost|total|paid|pay|balance|salary|wage|expense|debt|money|discount|tax|unitPrice|unit_price|deliveryFee|delivery_fee|سعر|مبلغ|تكلفة|رسوم|دين|واصل|مدفوع|أجور|مصروف|خصم|ضريبة|أجرة|نقد|كاش|دفعة|رصيد|ثمن/i;

const EXCLUDE_RE =
  /capacity|quantity|\bqty\b|pin|year|month|day|phone|mobile|email|search|note|notes|address|person|count|seats|سع[ةه]|كمي[ةه]|شخص|هاتف|جوال|بحث|عنوان|رقم.?الطاول|رقم.?الغرف/i;

function nearbyLabelText(el: HTMLInputElement): string {
  const fromLabels = Array.from(el.labels ?? [])
    .map((l) => l.textContent ?? "")
    .join(" ");
  if (fromLabels.trim()) return fromLabels;
  const wrap =
    el.closest("label")?.textContent ??
    el.parentElement?.querySelector("label")?.textContent ??
    el.parentElement?.previousElementSibling?.textContent ??
    el.parentElement?.parentElement?.querySelector("label")?.textContent ??
    "";
  return wrap || "";
}

function fieldHaystack(el: HTMLInputElement): string {
  return [
    el.name,
    el.id,
    el.placeholder,
    el.title,
    el.getAttribute("aria-label"),
    el.dataset.amountPad,
    el.className,
    nearbyLabelText(el),
  ]
    .filter(Boolean)
    .join(" ");
}

export function isAmountMoneyField(el: Element | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.disabled || el.readOnly) return false;
  if (el.dataset.noAmountPad === "true") return false;
  if (el.dataset.amountPad === "true") return true;
  if (el.closest("[data-global-amount-pad]")) return false;
  if (el.closest("[data-no-global-amount-pad]")) return false;
  if (el.closest("[data-global-text-keyboard]")) return false;

  const type = (el.type || "text").toLowerCase();
  if (
    type === "password" ||
    type === "file" ||
    type === "checkbox" ||
    type === "radio" ||
    type === "hidden" ||
    type === "tel" ||
    type === "email" ||
    type === "search" ||
    type === "url"
  ) {
    return false;
  }

  const mode = (el.inputMode || "").toLowerCase();
  const isNumericType =
    type === "number" || mode === "decimal" || mode === "numeric";
  if (!isNumericType) return false;

  const hay = fieldHaystack(el);
  if (EXCLUDE_RE.test(hay)) return false;
  if (MONEY_RE.test(hay)) return true;

  // Any remaining number/decimal field is treated as amount/price input
  return type === "number" || mode === "decimal" || mode === "numeric";
}

export function setNativeInputValue(el: HTMLInputElement, value: string) {
  const proto = HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function parseAmountFromInput(el: HTMLInputElement): number {
  const n = Number(String(el.value).replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
