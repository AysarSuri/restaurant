import { useEnterAsTab } from "@/hooks/use-enter-as-tab";

/** Enables Enter = Tab across the whole app for form fields. */
export function EnterAsTab() {
  useEnterAsTab();
  return null;
}
