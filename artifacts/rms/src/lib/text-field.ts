import { isAmountMoneyField } from "@/lib/amount-field";

const PIN_RE = /\bpin\b|password|كلمة.?السر|رمز.?الدخول/i;

/** Text / search fields that should open the multilingual on-screen keyboard. */
export function isTextKeyboardField(
  el: Element | null
): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (el.disabled || el.readOnly) return false;
  if (el.dataset.noTextKeyboard === "true") return false;
  if (el.dataset.textKeyboard === "true") return true;
  if (el.closest("[data-global-text-keyboard]")) return false;
  if (el.closest("[data-global-amount-pad]")) return false;
  if (el.closest("[data-no-global-text-keyboard]")) return false;

  // Money fields belong to the numeric pad, not the text keyboard
  if (el instanceof HTMLInputElement && isAmountMoneyField(el)) return false;

  if (el instanceof HTMLTextAreaElement) return true;

  const type = (el.type || "text").toLowerCase();
  if (
    type === "password" ||
    type === "number" ||
    type === "file" ||
    type === "checkbox" ||
    type === "radio" ||
    type === "hidden" ||
    type === "date" ||
    type === "time" ||
    type === "datetime-local" ||
    type === "color" ||
    type === "range" ||
    type === "button" ||
    type === "submit" ||
    type === "reset" ||
    type === "image"
  ) {
    return false;
  }

  const mode = (el.inputMode || "").toLowerCase();
  if (mode === "decimal" || mode === "numeric") return false;

  const hay = [el.name, el.id, el.placeholder, el.className, el.autocomplete].join(" ");
  if (PIN_RE.test(hay)) return false;

  return (
    type === "text" ||
    type === "search" ||
    type === "tel" ||
    type === "url" ||
    type === "email" ||
    type === ""
  );
}

export function setNativeTextValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
