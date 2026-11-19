import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function isVisible(el: HTMLElement) {
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  return el.getClientRects().length > 0;
}

function getFocusableElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => {
      if (!isVisible(el)) return false;
      if (el.hasAttribute("disabled")) return false;
      if ((el as HTMLInputElement).readOnly && el.tagName === "INPUT") {
        // still allow focusing readonly fields in tab order; Enter can leave them
      }
      return true;
    }
  );
}

/** Fields where Enter should move focus like Tab */
function isEnterAsTabTarget(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;

  if (tag === "TEXTAREA") return false;
  if (el.isContentEditable) return false;

  if (tag === "INPUT") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    if (
      type === "button" ||
      type === "submit" ||
      type === "reset" ||
      type === "checkbox" ||
      type === "radio" ||
      type === "file" ||
      type === "image" ||
      type === "hidden"
    ) {
      return false;
    }
    return true;
  }

  if (tag === "SELECT") return true;

  return false;
}

/**
 * Globally map Enter → Tab (and Shift+Enter → Shift+Tab) in text-like inputs.
 */
export function useEnterAsTab() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.defaultPrevented) return;
      if (event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (!isEnterAsTabTarget(event.target)) return;

      const focusables = getFocusableElements();
      const current = event.target as HTMLElement;
      const index = focusables.indexOf(current);
      if (index < 0) return;

      const next = event.shiftKey
        ? focusables[index - 1]
        : focusables[index + 1];

      if (!next) return;

      event.preventDefault();
      next.focus();
      if (
        next instanceof HTMLInputElement &&
        typeof next.select === "function" &&
        !["checkbox", "radio", "file", "button", "submit", "reset"].includes(
          (next.type || "").toLowerCase()
        )
      ) {
        try {
          next.select();
        } catch {
          /* ignore non-selectable inputs like date in some browsers */
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
