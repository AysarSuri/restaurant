import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSettings,
  useUpdateSettings,
  useGetDevicePrinters,
  useUpsertDevicePrinter,
  useUpdateDevicePrinter,
  useDeleteDevicePrinter,
  useGetBranches,
  getGetSettingsQueryKey,
  getGetDevicePrintersQueryKey,
  type AppSettings,
  type DevicePrinter,
} from "@workspace/api-client-react";
import { DEVICE_PRINTERS_QUERY_KEY } from "@/lib/device-printer-query";
import { Button, Input, Badge, Card, Dialog } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { useBranch } from "@/lib/branch-context";
import { toast } from "@/hooks/use-toast";
import {
  getOrCreateDeviceKey,
  setStoredDeviceName,
  suggestDeviceName,
} from "@/lib/device-id";
import {
  THEME_PRESETS,
  applyBrandPrimary,
  hexToHslComponents,
  hslComponentsToHex,
} from "@/lib/brand-theme";
import {
  CURRENCY_PRESETS,
  DEFAULT_CURRENCY,
  clampDecimalPlaces,
  formatMoney,
  type CurrencyCode,
} from "@/lib/currency";
import {
  Settings as SettingsIcon,
  Store,
  Printer,
  Palette,
  Monitor,
  Building2,
  Save,
  Trash2,
  Plus,
  Check,
  AlertTriangle,
  RefreshCw,
  Coins,
  ShoppingBag,
  ChefHat,
  Wallet,
  ImageIcon,
  Upload,
  X,
  Phone,
  Bike,
  UtensilsCrossed,
  Package,
  MoreHorizontal,
  Maximize2,
  Calculator,
  Keyboard,
} from "lucide-react";
import { useI18n } from "@/i18n";

type TabId =
  | "restaurant"
  | "sales"
  | "printers"
  | "themes"
  | "currency"
  | "keyboard"
  | "numbers"
  | "other";
type DeviceSalesPaymentAt = "pos" | "cashier";
type SalesPaymentOrderType = "dine_in" | "takeaway" | "delivery";

function paymentAtForType(
  row: DevicePrinter,
  orderType: SalesPaymentOrderType
): DeviceSalesPaymentAt {
  const legacy = row.salesPaymentAt === "cashier" ? "cashier" : "pos";
  const byType =
    orderType === "takeaway"
      ? row.salesPaymentAtTakeaway
      : orderType === "delivery"
        ? row.salesPaymentAtDelivery
        : row.salesPaymentAtDineIn;
  if (byType == null) return legacy;
  return byType === "cashier" ? "cashier" : "pos";
}

const MAX_LOGO_BYTES = 2.5 * 1024 * 1024;

/** Compress / resize restaurant logo and return a data URL for storage */
function fileToStoredLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("الملف يجب أن يكون صورة"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      reject(new Error("حجم الصورة كبير جداً (الحد 2.5 ميجا)"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("صورة غير صالحة"));
      img.onload = () => {
        const maxSide = 512;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("تعذر معالجة الصورة"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const TABS: { id: TabId; labelKey: string; icon: typeof Store; hintKey: string }[] = [
  { id: "restaurant", labelKey: "settings.restaurantName", icon: Store, hintKey: "cards.identity" },
  { id: "sales", labelKey: "settings.sales", icon: ShoppingBag, hintKey: "settings.orderPath" },
  { id: "printers", labelKey: "settings.printers", icon: Printer, hintKey: "settings.printer80" },
  { id: "currency", labelKey: "settings.currency", icon: Coins, hintKey: "settings.currencyHint" },
  { id: "themes", labelKey: "settings.themes", icon: Palette, hintKey: "settings.themeHint" },
  { id: "keyboard", labelKey: "settings.keyboard", icon: Keyboard, hintKey: "settings.keyboardHint" },
  { id: "numbers", labelKey: "settings.numbers", icon: Calculator, hintKey: "settings.numbersHint" },
  { id: "other", labelKey: "settings.other", icon: MoreHorizontal, hintKey: "settings.otherHint" },
];

const DECIMAL_OPTIONS = [0, 1, 2, 3, 4];

const PRINTER_PRESETS = [
  "XP-80",
  "EPSON TM-T20",
  "EPSON TM-T82",
  "Rongta RP80",
  "GPrinter GP-80250",
  "Sunmi 80mm",
  "Generic 80mm",
];

export default function SettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const { data: settings } = useGetSettings();
  // Always load the full device list (ignore branch header) so a saved printer
  // does not vanish when the header branch differs from the device branch.
  const { data: printers, isLoading: printersLoading } = useGetDevicePrinters({
    query: {
      queryKey: DEVICE_PRINTERS_QUERY_KEY,
    },
    request: {
      headers: { "x-branch-id": "all" },
    },
  });
  const { data: branches } = useGetBranches();
  const { mutate: saveSettings, isPending: savingSettings } = useUpdateSettings();
  const { mutate: upsertPrinter, isPending: upserting } = useUpsertDevicePrinter();
  const { mutate: updatePrinter, isPending: updatingPrinter } = useUpdateDevicePrinter();
  const { mutate: deletePrinter, isPending: deleting } = useDeleteDevicePrinter();

  const [tab, setTab] = useState<TabId>("restaurant");
  const [restaurantName, setRestaurantName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [mobile, setMobile] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoDeleteOpen, setLogoDeleteOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [themePrimary, setThemePrimary] = useState("38 92% 50%");
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(DEFAULT_CURRENCY.currencyCode);
  const [currencySymbol, setCurrencySymbol] = useState(DEFAULT_CURRENCY.currencySymbol);
  const [currencyName, setCurrencyName] = useState(DEFAULT_CURRENCY.currencyName);
  const [decimalPlaces, setDecimalPlaces] = useState(DEFAULT_CURRENCY.decimalPlaces);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const saveBannerRef = useRef<HTMLDivElement>(null);
  const saveFlashTimer = useRef<number | null>(null);

  const clearSaveFlash = () => {
    if (saveFlashTimer.current != null) {
      window.clearTimeout(saveFlashTimer.current);
      saveFlashTimer.current = null;
    }
  };

  const notifySaveOk = (message: string) => {
    clearSaveFlash();
    setSaveErr("");
    setSaveMsg(message);
    toast({
      title: t("common.saved"),
      description: message,
    });
    window.requestAnimationFrame(() => {
      saveBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    saveFlashTimer.current = window.setTimeout(() => {
      setSaveMsg("");
      saveFlashTimer.current = null;
    }, 4000);
  };

  const notifySaveErr = (message: string) => {
    clearSaveFlash();
    setSaveMsg("");
    setSaveErr(message);
    toast({
      variant: "destructive",
      title: t("common.saveFailed"),
      description: message,
    });
    window.requestAnimationFrame(() => {
      saveBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  useEffect(() => {
    return () => clearSaveFlash();
  }, []);

  const deviceKey = useMemo(() => getOrCreateDeviceKey(), []);
  const [deviceName, setDeviceName] = useState(() => suggestDeviceName());
  const [printerName, setPrinterName] = useState("");
  const [deviceBranchId, setDeviceBranchId] = useState<number | "">("");
  const [deleteTarget, setDeleteTarget] = useState<DevicePrinter | null>(null);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState("0");

  useEffect(() => {
    if (!settings) return;
    setRestaurantName(settings.restaurantName);
    setLogoUrl(settings.logoUrl?.trim() || "");
    setMobile(settings.mobile?.trim() || "");
    setThemePrimary(settings.themePrimary);
    applyBrandPrimary(settings.themePrimary);
    setCurrencyCode((settings.currencyCode as CurrencyCode) || DEFAULT_CURRENCY.currencyCode);
    setCurrencySymbol(settings.currencySymbol || DEFAULT_CURRENCY.currencySymbol);
    setCurrencyName(settings.currencyName || DEFAULT_CURRENCY.currencyName);
    setDecimalPlaces(clampDecimalPlaces(settings.decimalPlaces, DEFAULT_CURRENCY.decimalPlaces));
    setDeliveryFeeInput(String(Number(settings.deliveryFee) || 0));
  }, [settings]);

  const myDevicePrinter = useMemo(
    () => (printers ?? []).find((p) => p.deviceKey === deviceKey) ?? null,
    [printers, deviceKey]
  );

  useEffect(() => {
    if (myDevicePrinter) {
      setDeviceName(myDevicePrinter.deviceName);
      setPrinterName(myDevicePrinter.printerName || "");
      setDeviceBranchId(myDevicePrinter.branchId ?? "");
    } else if (selectedBranchId !== "all") {
      setDeviceBranchId(selectedBranchId);
    }
  }, [myDevicePrinter, selectedBranchId]);

  const activeBranches = useMemo(
    () => (branches ?? []).filter((b) => b.isActive !== false),
    [branches]
  );

  const branchOptions = useMemo<ComboboxOption[]>(() => {
    const opts: ComboboxOption[] = [
      {
        value: "",
        label: t("branch.noneSpecified"),
        subtitle: t("branch.deviceNotLinked"),
        icon: Monitor,
      },
    ];
    for (const b of activeBranches) {
      opts.push({
        value: String(b.id),
        label: b.name,
        subtitle: b.address?.trim() || t("settings.branchActive"),
        icon: Building2,
      });
    }
    return opts;
  }, [activeBranches, t]);

  const printerOptions = useMemo<ComboboxOption[]>(() => {
    const seen = new Set<string>();
    const opts: ComboboxOption[] = [];
    for (const name of PRINTER_PRESETS) {
      seen.add(name);
      opts.push({
        value: name,
        label: name,
        subtitle: t("settings.thermal80"),
        icon: Printer,
      });
    }
    // Keep any already-saved custom printer names available in the list
    for (const row of printers ?? []) {
      const n = row.printerName?.trim();
      if (n && !seen.has(n)) {
        seen.add(n);
        opts.push({
          value: n,
          label: n,
          subtitle: t("settings.savedPrinterName"),
          icon: Printer,
        });
      }
    }
    if (printerName.trim() && !seen.has(printerName.trim())) {
      opts.unshift({
        value: printerName.trim(),
        label: printerName.trim(),
        subtitle: t("settings.currentValue"),
        icon: Printer,
      });
    }
    return opts;
  }, [printers, printerName, t]);

  const syncSettings = (next: AppSettings) => {
    queryClient.setQueryData(getGetSettingsQueryKey(), (prev: any) => ({
      ...(prev ?? {}),
      ...next,
    }));
  };

  const applyCurrencyPreset = (code: Exclude<CurrencyCode, "custom">) => {
    const preset = CURRENCY_PRESETS.find((p) => p.code === code);
    if (!preset) return;
    setCurrencyCode(code);
    setCurrencyName(t(code === "usd" ? "currency.usd" : code === "eur" ? "currency.eur" : "currency.iqd"));
    setCurrencySymbol(preset.symbol);
    setDecimalPlaces(preset.decimalPlaces);
  };

  const handleSaveCurrency = () => {
    clearSaveFlash();
    setSaveMsg("");
    setSaveErr("");
    const name = currencyName.trim();
    const symbol = currencySymbol.trim();
    if (!name) {
      notifySaveErr(t("settings.currencyNameRequired"));
      return;
    }
    if (!symbol) {
      notifySaveErr(t("settings.symbolRequired"));
      return;
    }
    const decimals = clampDecimalPlaces(decimalPlaces);
    saveSettings(
      {
        data: {
          currencyCode,
          currencyName: name,
          currencySymbol: symbol,
          decimalPlaces: decimals,
        },
      },
      {
        onSuccess: (res) => {
          syncSettings(res);
          setCurrencyCode((res.currencyCode as CurrencyCode) || currencyCode);
          setCurrencyName(res.currencyName);
          setCurrencySymbol(res.currencySymbol);
          setDecimalPlaces(clampDecimalPlaces(res.decimalPlaces));
          notifySaveOk(t("settings.savedCurrency"));
        },
        onError: (err: any) =>
          notifySaveErr(err?.data?.message || err?.message || t("settings.saveCurrencyFailed")),
      }
    );
  };

  const printersQueryKey = DEVICE_PRINTERS_QUERY_KEY;

  const syncPrinters = (updater: (list: DevicePrinter[]) => DevicePrinter[]) => {
    queryClient.setQueryData<DevicePrinter[]>(printersQueryKey, (prev) =>
      updater(prev ?? [])
    );
  };

  const handleLogoPick = async (file?: File | null) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const dataUrl = await fileToStoredLogo(file);
      setLogoUrl(dataUrl);
    } catch (err: any) {
      notifySaveErr(err?.message || t("settings.logoUploadFailed"));
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleSaveRestaurant = () => {
    clearSaveFlash();
    setSaveMsg("");
    setSaveErr("");
    const name = restaurantName.trim();
    if (!name) {
      notifySaveErr(t("settings.restaurantNameRequired"));
      return;
    }
    saveSettings(
      {
        data: {
          restaurantName: name,
          logoUrl: logoUrl.trim() || null,
          mobile: mobile.trim() || null,
        },
      },
      {
        onSuccess: (res) => {
          syncSettings(res);
          setLogoUrl(res.logoUrl?.trim() || "");
          setMobile(res.mobile?.trim() || "");
          notifySaveOk(t("settings.savedRestaurantName"));
        },
        onError: (err: any) =>
          notifySaveErr(err?.data?.message || err?.message || t("settings.saveRestaurantFailed")),
      }
    );
  };

  const handleSaveDeliveryFee = () => {
    clearSaveFlash();
    setSaveMsg("");
    setSaveErr("");
    const n = Number(String(deliveryFeeInput).replace(/,/g, "").trim());
    if (!Number.isFinite(n) || n < 0) {
      notifySaveErr(t("settings.deliveryFeeInvalid"));
      return;
    }
    saveSettings(
      { data: { deliveryFee: n } },
      {
        onSuccess: (res) => {
          syncSettings(res);
          setDeliveryFeeInput(String(Number(res.deliveryFee) || 0));
          notifySaveOk(t("settings.savedDeliveryFee"));
        },
        onError: (err: any) =>
          notifySaveErr(err?.data?.message || err?.message || t("settings.saveDeliveryFeeFailed")),
      }
    );
  };

  const handleSaveDeviceSales = (
    row: DevicePrinter,
    patch: {
      salesPaymentAtDineIn?: DeviceSalesPaymentAt;
      salesPaymentAtTakeaway?: DeviceSalesPaymentAt;
      salesPaymentAtDelivery?: DeviceSalesPaymentAt;
      salesSendToKitchen?: boolean;
      formsFullscreen?: boolean;
      virtualNumericKeypad?: boolean;
      virtualKeyboard?: boolean;
    },
    opts?: { successKey?: string; errorKey?: string }
  ) => {
    clearSaveFlash();
    setSaveMsg("");
    setSaveErr("");
    const nextDineIn =
      patch.salesPaymentAtDineIn ?? paymentAtForType(row, "dine_in");
    const nextTakeaway =
      patch.salesPaymentAtTakeaway ?? paymentAtForType(row, "takeaway");
    const nextDelivery =
      patch.salesPaymentAtDelivery ?? paymentAtForType(row, "delivery");
    const nextKitchen =
      patch.salesSendToKitchen ?? row.salesSendToKitchen !== false;
    const nextFullscreen =
      "formsFullscreen" in patch
        ? Boolean(patch.formsFullscreen)
        : Boolean(row.formsFullscreen);
    const nextNumericKeypad =
      "virtualNumericKeypad" in patch
        ? Boolean(patch.virtualNumericKeypad)
        : Boolean(row.virtualNumericKeypad);
    const nextVirtualKeyboard =
      "virtualKeyboard" in patch
        ? Boolean(patch.virtualKeyboard)
        : Boolean(row.virtualKeyboard);

    const optimistic: DevicePrinter = {
      ...row,
      salesPaymentAt: nextDineIn,
      salesPaymentAtDineIn: nextDineIn,
      salesPaymentAtTakeaway: nextTakeaway,
      salesPaymentAtDelivery: nextDelivery,
      salesSendToKitchen: nextKitchen,
      formsFullscreen: nextFullscreen,
      virtualNumericKeypad: nextNumericKeypad,
      virtualKeyboard: nextVirtualKeyboard,
    };

    // Optimistic UI so choices stick immediately
    syncPrinters((list) => list.map((p) => (p.id === row.id ? optimistic : p)));

    updatePrinter(
      {
        id: row.id,
        data: {
          deviceName: row.deviceName,
          printerName: row.printerName ?? "",
          branchId: row.branchId ?? null,
          isActive: row.isActive !== false,
          salesPaymentAt: nextDineIn,
          salesPaymentAtDineIn: nextDineIn,
          salesPaymentAtTakeaway: nextTakeaway,
          salesPaymentAtDelivery: nextDelivery,
          salesSendToKitchen: nextKitchen,
          formsFullscreen: nextFullscreen,
          virtualNumericKeypad: nextNumericKeypad,
          virtualKeyboard: nextVirtualKeyboard,
        },
      },
      {
        onSuccess: (updated) => {
          // Always keep the values we just saved — avoid response/refetch flipping toggles off
          syncPrinters((list) =>
            list.map((p) =>
              p.id === updated.id || p.id === row.id
                ? {
                    ...p,
                    ...updated,
                    salesPaymentAtDineIn:
                      updated.salesPaymentAtDineIn != null
                        ? updated.salesPaymentAtDineIn === "cashier"
                          ? "cashier"
                          : "pos"
                        : nextDineIn,
                    salesPaymentAtTakeaway:
                      updated.salesPaymentAtTakeaway != null
                        ? updated.salesPaymentAtTakeaway === "cashier"
                          ? "cashier"
                          : "pos"
                        : nextTakeaway,
                    salesPaymentAtDelivery:
                      updated.salesPaymentAtDelivery != null
                        ? updated.salesPaymentAtDelivery === "cashier"
                          ? "cashier"
                          : "pos"
                        : nextDelivery,
                    salesPaymentAt:
                      updated.salesPaymentAt != null
                        ? updated.salesPaymentAt === "cashier"
                          ? "cashier"
                          : "pos"
                        : nextDineIn,
                    salesSendToKitchen:
                      updated.salesSendToKitchen != null
                        ? updated.salesSendToKitchen !== false
                        : nextKitchen,
                    formsFullscreen: nextFullscreen,
                    virtualNumericKeypad: nextNumericKeypad,
                    virtualKeyboard: nextVirtualKeyboard,
                  }
                : p
            )
          );
          notifySaveOk(t(opts?.successKey ?? "settings.savedSales"));
        },
        onError: (err: any) => {
          // Revert optimistic change
          syncPrinters((list) => list.map((p) => (p.id === row.id ? row : p)));
          notifySaveErr(
            err?.data?.message ||
              err?.message ||
              t(opts?.errorKey ?? "settings.saveSalesFailed")
          );
        },
      }
    );
  };

  const handleSaveTheme = (primary: string) => {
    clearSaveFlash();
    setSaveMsg("");
    setSaveErr("");
    applyBrandPrimary(primary);
    setThemePrimary(primary);
    saveSettings(
      { data: { themePrimary: primary } },
      {
        onSuccess: (res) => {
          syncSettings(res);
          notifySaveOk(t("settings.savedTheme"));
        },
        onError: (err: any) =>
          notifySaveErr(err?.data?.message || err?.message || t("settings.saveThemeFailed")),
      }
    );
  };

  const handleRegisterDevice = () => {
    clearSaveFlash();
    setSaveMsg("");
    setSaveErr("");
    const name = deviceName.trim();
    if (!name) {
      notifySaveErr(t("settings.enterDeviceName"));
      return;
    }
    if (!printerName.trim()) {
      notifySaveErr(t("settings.typeOrPickPrinter"));
      return;
    }
    setStoredDeviceName(name);
    upsertPrinter(
      {
        data: {
          deviceKey,
          deviceName: name,
          printerName: printerName.trim(),
          branchId: deviceBranchId === "" ? null : Number(deviceBranchId),
        },
      },
      {
        onSuccess: (row) => {
          syncPrinters((list) => {
            const without = list.filter((p) => p.deviceKey !== row.deviceKey && p.id !== row.id);
            return [row, ...without];
          });
          notifySaveOk(
            myDevicePrinter
              ? t("settings.printerUpdatedOne")
              : t("settings.printerSaved80")
          );
        },
        onError: (err: any) =>
          notifySaveErr(err?.data?.message || err?.message || t("settings.savePrinterFailed")),
      }
    );
  };

  const handleUpdateRow = (row: DevicePrinter, patch: Partial<DevicePrinter>) => {
    updatePrinter(
      {
        id: row.id,
        data: {
          deviceName: patch.deviceName ?? row.deviceName,
          printerName: patch.printerName ?? row.printerName,
          branchId: patch.branchId !== undefined ? patch.branchId : row.branchId,
          isActive: patch.isActive ?? row.isActive,
        },
      },
      {
        onSuccess: (updated) => {
          syncPrinters((list) => list.map((p) => (p.id === updated.id ? updated : p)));
          notifySaveOk(t("settings.savedPrinter"));
        },
        onError: (err: any) =>
          notifySaveErr(err?.data?.message || err?.message || t("settings.updatePrinterFailed")),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deletePrinter(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          syncPrinters((list) => list.filter((p) => p.id !== deleteTarget.id));
          setDeleteTarget(null);
          notifySaveOk(t("settings.deviceDeleted"));
        },
        onError: (err: any) =>
          notifySaveErr(err?.data?.message || err?.message || t("settings.deleteDeviceFailed")),
      }
    );
  };

  const customHex = hslComponentsToHex(themePrimary);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 xl:p-8 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-2">
            <SettingsIcon className="w-3.5 h-3.5" />
            {t("settings.kicker")}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t("settings.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("settings.subtitle")}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch lg:items-start">
      <nav className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-2">
        {TABS.map((tabItem) => {
          const active = tab === tabItem.id;
          const Icon = tabItem.icon;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => {
                setTab(tabItem.id);
                clearSaveFlash();
                setSaveMsg("");
                setSaveErr("");
              }}
              className={`w-full text-start rounded-2xl border-2 px-4 py-3.5 transition-all touch-manipulation ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-sm sm:text-base truncate">{t(tabItem.labelKey)}</p>
                  <p
                    className={`text-[11px] ${
                      active ? "text-primary-foreground/80" : "text-primary/70"
                    }`}
                  >
                    {t(tabItem.hintKey)}
                  </p>
                </div>
                {active ? (
                  <Check className="w-4 h-4 text-primary-foreground flex-shrink-0" />
                ) : null}
              </div>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 w-full space-y-5">
      {(saveMsg || saveErr) && (
        <div
          ref={saveBannerRef}
          role="status"
          aria-live="polite"
          className={`sticky top-2 z-20 rounded-2xl border-2 px-4 py-3 text-sm font-bold flex items-start gap-2.5 shadow-lg backdrop-blur-md ${
            saveErr
              ? "border-destructive/40 bg-destructive/15 text-destructive shadow-destructive/10"
              : "border-emerald-500/45 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-emerald-500/15"
          }`}
        >
          {saveErr ? (
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          ) : (
            <Check className="w-5 h-5 mt-0.5 flex-shrink-0" />
          )}
          <span className="min-w-0 flex-1">{saveErr || saveMsg}</span>
        </div>
      )}

      {tab === "sales" && (
        <div className="space-y-5 max-w-4xl">
          <Card className="p-5 sm:p-6 border border-border/60 space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                <Bike className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-lg">{t("settings.deliveryFeeTitle")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.deliveryFeeHint")}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-semibold mb-1.5">
                  {t("settings.deliveryFeeAmount")}
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    amountPad
                    dir="ltr"
                    value={deliveryFeeInput}
                    onChange={(e) => setDeliveryFeeInput(e.target.value)}
                    placeholder="0"
                    className="pe-14 font-display font-bold tabular-nums"
                  />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    {currencySymbol || settings?.currencySymbol || "د.ع"}
                  </span>
                </div>
              </div>
              <Button
                className="gap-2 sm:w-auto w-full"
                isLoading={savingSettings}
                onClick={handleSaveDeliveryFee}
              >
                <Save className="w-4 h-4" />
                {t("settings.saveDeliveryFee")}
              </Button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 border border-border/60 space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <Bike className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-lg">{t("settings.deliveryRequiredTitle")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.deliveryRequiredHint")}
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              {(
                [
                  {
                    key: "deliveryRequireDriver" as const,
                    label: t("settings.deliveryRequireDriver"),
                    on: settings?.deliveryRequireDriver !== false,
                  },
                  {
                    key: "deliveryRequirePhone" as const,
                    label: t("settings.deliveryRequirePhone"),
                    on: settings?.deliveryRequirePhone !== false,
                  },
                  {
                    key: "deliveryRequireAddress" as const,
                    label: t("settings.deliveryRequireAddress"),
                    on: settings?.deliveryRequireAddress !== false,
                  },
                ] as const
              ).map((row) => (
                <button
                  key={row.key}
                  type="button"
                  disabled={savingSettings}
                  onClick={() => {
                    clearSaveFlash();
                    saveSettings(
                      { data: { [row.key]: !row.on } },
                      {
                        onSuccess: (res) => {
                          syncSettings(res);
                          notifySaveOk(t("settings.savedDeliveryRequired"));
                        },
                        onError: (err: any) =>
                          notifySaveErr(
                            err?.data?.message ||
                              err?.message ||
                              t("settings.saveDeliveryRequiredFailed")
                          ),
                      }
                    );
                  }}
                  className={`w-full text-start rounded-2xl border-2 p-3.5 sm:p-4 transition-all touch-manipulation ${
                    row.on
                      ? "border-rose-500/55 bg-rose-500/10"
                      : "border-border/70 bg-card/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-sm sm:text-base">{row.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {row.on
                          ? t("settings.deliveryRequiredOn")
                          : t("settings.deliveryRequiredOff")}
                      </p>
                    </div>
                    <span
                      className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full ${
                        row.on ? "bg-rose-500" : "bg-secondary"
                      }`}
                      aria-hidden
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          row.on ? "start-1" : "end-1"
                        }`}
                      />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6 border border-border/60 space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-lg">{t("settings.deviceSalesTitle")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.deviceSalesHint")}
                </p>
              </div>
            </div>
          </Card>

          {(printers ?? []).length === 0 ? (
            <Card className="p-8 border border-dashed border-border/60 text-center space-y-2">
              <Monitor className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-extrabold">{t("settings.noDevices")}</p>
              <p className="text-sm text-muted-foreground">{t("settings.registerAbove")}</p>
              <Button variant="outline" className="mt-2" onClick={() => setTab("printers")}>
                {t("settings.printers")}
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {(printers ?? []).map((row) => {
                const kitchenOn = row.salesSendToKitchen !== false;
                const isMine = row.deviceKey === deviceKey;
                const paymentRows: {
                  type: SalesPaymentOrderType;
                  labelKey: string;
                  Icon: typeof UtensilsCrossed;
                  accent: string;
                  accentBg: string;
                  selectedBorder: string;
                  selectedBg: string;
                }[] = [
                  {
                    type: "dine_in",
                    labelKey: "order.dineIn",
                    Icon: UtensilsCrossed,
                    accent: "bg-amber-500 text-white",
                    accentBg: "bg-secondary",
                    selectedBorder: "border-amber-500/60",
                    selectedBg: "bg-amber-500/10",
                  },
                  {
                    type: "takeaway",
                    labelKey: "order.takeaway",
                    Icon: Package,
                    accent: "bg-violet-500 text-white",
                    accentBg: "bg-secondary",
                    selectedBorder: "border-violet-500/60",
                    selectedBg: "bg-violet-500/10",
                  },
                  {
                    type: "delivery",
                    labelKey: "order.delivery",
                    Icon: Bike,
                    accent: "bg-cyan-500 text-white",
                    accentBg: "bg-secondary",
                    selectedBorder: "border-cyan-500/60",
                    selectedBg: "bg-cyan-500/10",
                  },
                ];
                return (
                  <Card
                    key={row.id}
                    className={`p-4 sm:p-5 border space-y-4 ${
                      isMine ? "border-primary/40 bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold text-base truncate">{row.deviceName}</p>
                          {isMine ? (
                            <Badge variant="default">{t("settings.thisDevice")}</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold mt-1">
                          {row.branchName?.trim() || t("branch.noneSpecified")}
                          {row.printerName?.trim() ? ` · ${row.printerName}` : ""}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-extrabold mb-2">{t("settings.kitchenIndependent")}</p>
                      <button
                        type="button"
                        disabled={updatingPrinter}
                        onClick={() =>
                          handleSaveDeviceSales(row, { salesSendToKitchen: !kitchenOn })
                        }
                        className={`w-full text-start rounded-2xl border-2 p-4 transition-all touch-manipulation ${
                          kitchenOn
                            ? "border-orange-500/60 bg-orange-500/10"
                            : "border-border/70 bg-card/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              kitchenOn ? "bg-orange-500 text-white" : "bg-secondary"
                            }`}
                          >
                            <ChefHat className="w-5 h-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold">{t("settings.toKitchen")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {kitchenOn
                                ? t("settings.kitchenOnIndependent")
                                : t("settings.kitchenOffIndependent")}
                            </p>
                          </div>
                          <span
                            className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full ${
                              kitchenOn ? "bg-orange-500" : "bg-secondary"
                            }`}
                            aria-hidden
                          >
                            <span
                              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                                kitchenOn ? "start-1" : "end-1"
                              }`}
                            />
                          </span>
                        </div>
                      </button>
                    </div>

                    <div>
                      <p className="text-sm font-extrabold mb-1">{t("settings.saveOnlyWhere")}</p>
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                        {t("settings.saveOnlyWhereByTypeHint")}
                      </p>
                      <div className="space-y-3">
                        {paymentRows.map(
                          ({
                            type,
                            labelKey,
                            Icon,
                            accent,
                            accentBg,
                            selectedBorder,
                            selectedBg,
                          }) => {
                            const paymentAt = paymentAtForType(row, type);
                            const patchKey =
                              type === "takeaway"
                                ? "salesPaymentAtTakeaway"
                                : type === "delivery"
                                  ? "salesPaymentAtDelivery"
                                  : "salesPaymentAtDineIn";
                            return (
                              <div
                                key={type}
                                className={`rounded-2xl border-2 p-3.5 sm:p-4 space-y-3 ${selectedBorder} ${selectedBg}`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </span>
                                  <p className="font-extrabold text-sm sm:text-base">
                                    {t(labelKey)}
                                  </p>
                                </div>
                                {type === "delivery" ? (
                                  <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2.5 text-[11px] sm:text-xs font-bold text-cyan-900 dark:text-cyan-100 leading-relaxed">
                                    {t("settings.deliveryRequiredFields")}
                                  </div>
                                ) : null}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  <button
                                    type="button"
                                    disabled={updatingPrinter}
                                    onClick={() =>
                                      handleSaveDeviceSales(row, {
                                        [patchKey]: "pos",
                                      })
                                    }
                                    className={`text-start rounded-xl border-2 p-3 transition-all touch-manipulation ${
                                      paymentAt === "pos"
                                        ? "border-emerald-500/70 bg-emerald-500/10"
                                        : "border-border/70 bg-card/70"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span
                                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                          paymentAt === "pos"
                                            ? "bg-emerald-500 text-white"
                                            : accentBg
                                        }`}
                                      >
                                        <ShoppingBag className="w-4 h-4" />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="font-extrabold text-sm">
                                          {t("settings.saveFromPos")}
                                        </p>
                                      </div>
                                      {paymentAt === "pos" ? (
                                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                      ) : null}
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={updatingPrinter}
                                    onClick={() =>
                                      handleSaveDeviceSales(row, {
                                        [patchKey]: "cashier",
                                      })
                                    }
                                    className={`text-start rounded-xl border-2 p-3 transition-all touch-manipulation ${
                                      paymentAt === "cashier"
                                        ? "border-sky-500/70 bg-sky-500/10"
                                        : "border-border/70 bg-card/70"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span
                                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                          paymentAt === "cashier"
                                            ? "bg-sky-500 text-white"
                                            : accentBg
                                        }`}
                                      >
                                        <Wallet className="w-4 h-4" />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="font-extrabold text-sm">
                                          {t("settings.saveFromCashier")}
                                        </p>
                                      </div>
                                      {paymentAt === "cashier" ? (
                                        <Check className="w-4 h-4 text-sky-500 flex-shrink-0" />
                                      ) : null}
                                    </div>
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "restaurant" && (
        <Card className="p-5 sm:p-6 border border-border/60 space-y-5 max-w-2xl">
          <div>
            <h3 className="font-extrabold text-lg">{t("settings.restaurantName")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("settings.nameAppears")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">{t("settings.nameStar")}</label>
            <Input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder={t("settings.nameExample")}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <Phone className="w-4 h-4 inline me-1 text-primary" />
              {t("settings.mobile")}
            </label>
            <div className="relative">
              <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="ps-9"
                dir="ltr"
                inputMode="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder={t("settings.mobilePlaceholder")}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <ImageIcon className="w-4 h-4 inline me-1 text-primary" />
              {t("settings.logo")}
            </label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void handleLogoPick(e.target.files?.[0])}
            />
            <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-border/70 bg-secondary/30 p-3">
              <div className="w-16 h-16 rounded-xl border border-border/50 bg-background overflow-hidden flex items-center justify-center flex-shrink-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={t("settings.logoAlt")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-7 h-7 text-muted-foreground/60" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {logoUrl ? t("settings.logoSelected") : t("settings.logoChoose")}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("settings.logoHint")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-destructive"
                    onClick={() => setLogoDeleteOpen(true)}
                    aria-label={t("settings.logoRemove")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-1.5 px-3"
                  isLoading={logoBusy}
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {logoUrl ? t("settings.logoChange") : t("settings.logoUpload")}
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-transparent to-transparent p-4">
            <p className="text-[11px] text-muted-foreground mb-2">{t("common.preview")}</p>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border border-border/50"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-xl font-extrabold">{restaurantName.trim() || "—"}</p>
                {mobile.trim() ? (
                  <p className="text-sm font-bold text-muted-foreground mt-0.5" dir="ltr">
                    {mobile.trim()}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <Button className="gap-2" isLoading={savingSettings} onClick={handleSaveRestaurant}>
            <Save className="w-4 h-4" /> {t("settings.saveName")}
          </Button>
        </Card>
      )}

      <Dialog
        isOpen={logoDeleteOpen}
        onClose={() => setLogoDeleteOpen(false)}
        title={t("settings.logoRemoveTitle")}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl border border-border/50 overflow-hidden bg-secondary/40 flex items-center justify-center flex-shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-bold">{t("settings.logoRemoveAsk")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("settings.logoRemoveHint")}</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setLogoDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLogoUrl("");
                setLogoDeleteOpen(false);
              }}
            >
              {t("settings.logoRemove")}
            </Button>
          </div>
        </div>
      </Dialog>

      {tab === "printers" && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6 border border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.05] space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-lg">{t("settings.thisDevice")}</h3>
                  <Badge variant="default">{t("settings.printer80Badge")}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.onePrinterBody")}
                </p>
              </div>
              <Monitor className="w-8 h-8 text-primary opacity-80" />
            </div>

            {myDevicePrinter && (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-sm font-bold text-amber-700 dark:text-amber-300">
                {t("settings.alreadyRegistered")}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">{t("settings.deviceNameStar")}</label>
                <Input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder={t("settings.deviceNameExample")}
                />
              </div>
              <ModernCombobox
                label={t("common.branch")}
                hint={t("settings.linkBranch")}
                icon={Building2}
                value={deviceBranchId === "" ? "" : String(deviceBranchId)}
                onChange={(v) => setDeviceBranchId(v ? Number(v) : "")}
                options={branchOptions}
                placeholder={t("auth.selectBranch")}
                searchPlaceholder={t("branch.search")}
              />
              <div className="md:col-span-2">
                <ModernCombobox
                  label={t("settings.printerName")}
                  hint={t("settings.printerPerDevice")}
                  icon={Printer}
                  value={printerName}
                  onChange={setPrinterName}
                  options={printerOptions}
                  placeholder={t("settings.pickPrinterName")}
                  searchPlaceholder={t("settings.searchPrinter")}
                  allowCustom
                  customPlaceholder={t("settings.customPrinterHint")}
                  dir="ltr"
                />
              </div>
            </div>

            <Button className="gap-2" isLoading={upserting} onClick={handleRegisterDevice}>
              {myDevicePrinter ? (
                <>
                  <Save className="w-4 h-4" /> {t("settings.updateDevicePrinter")}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> {t("settings.saveDevicePrinter")}
                </>
              )}
            </Button>
          </Card>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-extrabold text-lg">{t("settings.registeredDevices")}</h3>
              <button
                type="button"
                className="text-xs font-bold text-primary inline-flex items-center gap-1"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: getGetDevicePrintersQueryKey() })
                }
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t("common.update")}
              </button>
            </div>

            {printersLoading && !printers ? (
              <p className="text-muted-foreground text-sm py-8 text-center">{t("common.loading")}</p>
            ) : (printers ?? []).length === 0 ? (
              <Card className="p-8 text-center border border-dashed border-border/70">
                <Printer className="w-10 h-10 mx-auto text-primary mb-3 opacity-80" />
                <p className="font-bold">{t("settings.noDevices")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.registerAbove")}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {(printers ?? []).map((row) => {
                  const isMine = row.deviceKey === deviceKey;
                  return (
                    <Card
                      key={row.id}
                      className={`p-4 border space-y-3 ${
                        isMine ? "border-primary/40 bg-primary/[0.06]" : "border-border/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-extrabold truncate">{row.deviceName}</p>
                            {isMine && <Badge variant="default">{t("settings.thisDevice")}</Badge>}
                            <Badge variant="outline">80×80</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {row.branchName || t("branch.none")}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="w-9 h-9 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center justify-center"
                          onClick={() => setDeleteTarget(row)}
                          title={t("common.delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                          {t("settings.deviceName")}
                        </label>
                        <Input
                          value={row.deviceName}
                          onChange={(e) =>
                            syncPrinters((list) =>
                              list.map((p) =>
                                p.id === row.id ? { ...p, deviceName: e.target.value } : p
                              )
                            )
                          }
                          onBlur={(e) =>
                            handleUpdateRow(row, { deviceName: e.target.value.trim() || row.deviceName })
                          }
                          placeholder={t("settings.deviceName")}
                        />
                      </div>
                      <ModernCombobox
                        label={t("settings.printerName")}
                        hint={t("settings.hint80")}
                        icon={Printer}
                        value={row.printerName || ""}
                        onChange={(v) => {
                          syncPrinters((list) =>
                            list.map((p) => (p.id === row.id ? { ...p, printerName: v } : p))
                          );
                          handleUpdateRow(row, { printerName: v });
                        }}
                        options={
                          row.printerName &&
                          !printerOptions.some((o) => o.value === row.printerName)
                            ? [
                                {
                                  value: row.printerName,
                                  label: row.printerName,
                                  subtitle: t("settings.currentValue"),
                                  icon: Printer,
                                },
                                ...printerOptions,
                              ]
                            : printerOptions
                        }
                        placeholder={t("settings.pickPrinter")}
                        searchPlaceholder={t("settings.searchPrinter")}
                        allowCustom
                        customPlaceholder={t("settings.customPrinterName")}
                        disabled={updatingPrinter}
                        dir="ltr"
                      />
                      <ModernCombobox
                        label={t("common.branch")}
                        icon={Building2}
                        value={row.branchId ? String(row.branchId) : ""}
                        onChange={(v) =>
                          handleUpdateRow(row, {
                            branchId: v ? Number(v) : null,
                          })
                        }
                        options={branchOptions}
                        placeholder={t("auth.selectBranch")}
                        searchPlaceholder={t("branch.search")}
                        disabled={updatingPrinter}
                      />
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "currency" && (
        <div className="space-y-5 max-w-3xl">
          <Card className="p-5 sm:p-6 border border-border/60 space-y-5">
            <div>
              <h3 className="font-extrabold text-lg">{t("settings.projectCurrency")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("settings.currencyIntro")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CURRENCY_PRESETS.map((preset) => {
                const active = currencyCode === preset.code;
                return (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => applyCurrencyPreset(preset.code)}
                    className={`rounded-2xl border-2 p-4 text-start transition-all ${
                      active
                        ? "border-primary bg-primary/10 shadow-md shadow-primary/15"
                        : "border-border/70 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-600 text-primary-foreground font-extrabold shadow-md shadow-primary/25">
                        {preset.symbol}
                      </span>
                      <div className="min-w-0">
                        <p className="font-extrabold">{t(preset.code === "usd" ? "currency.usd" : preset.code === "eur" ? "currency.eur" : "currency.iqd")}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {preset.hint} · {t("settings.decimalCount", { n: preset.decimalPlaces })}
                        </p>
                      </div>
                      {active && <Check className="w-4 h-4 text-primary ms-auto" />}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCurrencyCode("custom")}
                className={`rounded-2xl border-2 p-4 text-start transition-all sm:col-span-2 ${
                  currencyCode === "custom"
                    ? "border-primary bg-primary/10 shadow-md shadow-primary/15"
                    : "border-border/70 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-secondary text-primary">
                    <Coins className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-extrabold">{t("settings.customCurrency")}</p>
                    <p className="text-[11px] text-muted-foreground">{t("settings.customCurrencyHint")}</p>
                  </div>
                  {currencyCode === "custom" && <Check className="w-4 h-4 text-primary ms-auto" />}
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">{t("settings.currencyNameStar")}</label>
                <Input
                  value={currencyName}
                  onChange={(e) => {
                    setCurrencyName(e.target.value);
                    if (currencyCode !== "custom") setCurrencyCode("custom");
                  }}
                  placeholder={t("settings.currencyNameExample")}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">{t("settings.symbolStar")}</label>
                <Input
                  value={currencySymbol}
                  onChange={(e) => {
                    setCurrencySymbol(e.target.value);
                    if (currencyCode !== "custom") setCurrencyCode("custom");
                  }}
                  placeholder={t("settings.currencyHint")}
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Decimal Places *</label>
              <div className="flex flex-wrap gap-2">
                {DECIMAL_OPTIONS.map((d) => {
                  const active = decimalPlaces === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDecimalPlaces(d)}
                      className={`h-11 min-w-[3rem] rounded-xl border-2 px-3 font-extrabold font-display transition-all ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background/50 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {t("settings.decimalHint")}
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-transparent to-transparent p-4">
              <p className="text-[11px] text-muted-foreground mb-1">{t("common.preview")}</p>
              <p className="text-2xl font-extrabold font-display" dir="ltr">
                {formatMoney(12345.6789, {
                  currencyCode,
                  currencyName,
                  currencySymbol,
                  decimalPlaces,
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{currencyName}</p>
            </div>

            <Button className="gap-2" isLoading={savingSettings} onClick={handleSaveCurrency}>
              <Save className="w-4 h-4" /> {t("settings.saveCurrency")}
            </Button>
          </Card>
        </div>
      )}

      {tab === "keyboard" && (
        <div className="space-y-5 max-w-4xl">
          <Card className="p-5 sm:p-6 border border-border/60 space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                <Keyboard className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-lg">{t("settings.virtualKeyboardTitle")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.virtualKeyboardHint")}
                </p>
              </div>
            </div>
          </Card>

          {(printers ?? []).length === 0 ? (
            <Card className="p-8 border border-dashed border-border/60 text-center space-y-2">
              <Monitor className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-extrabold">{t("settings.noDevices")}</p>
              <p className="text-sm text-muted-foreground">{t("settings.registerAbove")}</p>
              <Button variant="outline" className="mt-2" onClick={() => setTab("printers")}>
                {t("settings.printers")}
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {(printers ?? []).map((row) => {
                const keyboardOn = Boolean(row.virtualKeyboard);
                const isMine = row.deviceKey === deviceKey;
                return (
                  <Card
                    key={row.id}
                    className={`p-4 sm:p-5 border space-y-3 ${
                      isMine ? "border-primary/40 bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold text-base truncate">{row.deviceName}</p>
                          {isMine ? (
                            <Badge variant="default">{t("settings.thisDevice")}</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold mt-1">
                          {row.branchName?.trim() || t("branch.noneSpecified")}
                          {row.printerName?.trim() ? ` · ${row.printerName}` : ""}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={updatingPrinter}
                      onClick={() =>
                        handleSaveDeviceSales(
                          row,
                          { virtualKeyboard: !keyboardOn },
                          {
                            successKey: "settings.savedVirtualKeyboard",
                            errorKey: "settings.saveVirtualKeyboardFailed",
                          }
                        )
                      }
                      className={`w-full text-start rounded-2xl border-2 p-4 transition-all touch-manipulation ${
                        keyboardOn
                          ? "border-sky-500/60 bg-sky-500/10"
                          : "border-border/70 bg-card/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            keyboardOn ? "bg-sky-500 text-white" : "bg-secondary"
                          }`}
                        >
                          <Keyboard className="w-5 h-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold">{t("settings.virtualKeyboard")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {keyboardOn
                              ? t("settings.virtualKeyboardOn")
                              : t("settings.virtualKeyboardOff")}
                          </p>
                        </div>
                        <span
                          className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
                            keyboardOn ? "bg-sky-500" : "bg-secondary"
                          }`}
                          aria-hidden
                        >
                          <span
                            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                              keyboardOn ? "start-1" : "end-1"
                            }`}
                          />
                        </span>
                      </div>
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "numbers" && (
        <div className="space-y-5 max-w-4xl">
          <Card className="p-5 sm:p-6 border border-border/60 space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-lg">{t("settings.numericKeypadTitle")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.numericKeypadHint")}
                </p>
              </div>
            </div>
          </Card>

          {(printers ?? []).length === 0 ? (
            <Card className="p-8 border border-dashed border-border/60 text-center space-y-2">
              <Monitor className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-extrabold">{t("settings.noDevices")}</p>
              <p className="text-sm text-muted-foreground">{t("settings.registerAbove")}</p>
              <Button variant="outline" className="mt-2" onClick={() => setTab("printers")}>
                {t("settings.printers")}
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {(printers ?? []).map((row) => {
                const keypadOn = Boolean(row.virtualNumericKeypad);
                const isMine = row.deviceKey === deviceKey;
                return (
                  <Card
                    key={row.id}
                    className={`p-4 sm:p-5 border space-y-3 ${
                      isMine ? "border-primary/40 bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold text-base truncate">{row.deviceName}</p>
                          {isMine ? (
                            <Badge variant="default">{t("settings.thisDevice")}</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold mt-1">
                          {row.branchName?.trim() || t("branch.noneSpecified")}
                          {row.printerName?.trim() ? ` · ${row.printerName}` : ""}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={updatingPrinter}
                      onClick={() =>
                        handleSaveDeviceSales(
                          row,
                          { virtualNumericKeypad: !keypadOn },
                          {
                            successKey: "settings.savedNumericKeypad",
                            errorKey: "settings.saveNumericKeypadFailed",
                          }
                        )
                      }
                      className={`w-full text-start rounded-2xl border-2 p-4 transition-all touch-manipulation ${
                        keypadOn
                          ? "border-emerald-500/60 bg-emerald-500/10"
                          : "border-border/70 bg-card/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            keypadOn ? "bg-emerald-500 text-white" : "bg-secondary"
                          }`}
                        >
                          <Calculator className="w-5 h-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold">{t("settings.numericKeypad")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {keypadOn
                              ? t("settings.numericKeypadOn")
                              : t("settings.numericKeypadOff")}
                          </p>
                        </div>
                        <span
                          className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
                            keypadOn ? "bg-emerald-500" : "bg-secondary"
                          }`}
                          aria-hidden
                        >
                          <span
                            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                              keypadOn ? "start-1" : "end-1"
                            }`}
                          />
                        </span>
                      </div>
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "other" && (
        <div className="space-y-5 max-w-4xl">
          <Card className="p-5 sm:p-6 border border-border/60 space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Maximize2 className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-lg">{t("settings.formsFullscreenTitle")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.formsFullscreenHint")}
                </p>
              </div>
            </div>
          </Card>

          {(printers ?? []).length === 0 ? (
            <Card className="p-8 border border-dashed border-border/60 text-center space-y-2">
              <Monitor className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-extrabold">{t("settings.noDevices")}</p>
              <p className="text-sm text-muted-foreground">{t("settings.registerAbove")}</p>
              <Button variant="outline" className="mt-2" onClick={() => setTab("printers")}>
                {t("settings.printers")}
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {(printers ?? []).map((row) => {
                const fullscreenOn = row.formsFullscreen === true;
                const isMine = row.deviceKey === deviceKey;
                return (
                  <Card
                    key={row.id}
                    className={`p-4 sm:p-5 border space-y-3 ${
                      isMine ? "border-primary/40 bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold text-base truncate">{row.deviceName}</p>
                          {isMine ? (
                            <Badge variant="default">{t("settings.thisDevice")}</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground font-semibold mt-1">
                          {row.branchName?.trim() || t("branch.noneSpecified")}
                          {row.printerName?.trim() ? ` · ${row.printerName}` : ""}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={updatingPrinter}
                      onClick={() =>
                        handleSaveDeviceSales(
                          row,
                          { formsFullscreen: !fullscreenOn },
                          {
                            successKey: "settings.savedFormsFullscreen",
                            errorKey: "settings.saveFormsFullscreenFailed",
                          }
                        )
                      }
                      className={`w-full text-start rounded-2xl border-2 p-4 transition-all touch-manipulation ${
                        fullscreenOn
                          ? "border-indigo-500/60 bg-indigo-500/10"
                          : "border-border/70 bg-card/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            fullscreenOn ? "bg-indigo-500 text-white" : "bg-secondary"
                          }`}
                        >
                          <Maximize2 className="w-5 h-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold">{t("settings.formsFullscreen")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fullscreenOn
                              ? t("settings.formsFullscreenOn")
                              : t("settings.formsFullscreenOff")}
                          </p>
                        </div>
                        <span
                          className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
                            fullscreenOn ? "bg-indigo-500" : "bg-secondary"
                          }`}
                          aria-hidden
                        >
                          <span
                            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                              fullscreenOn ? "start-1" : "end-1"
                            }`}
                          />
                        </span>
                      </div>
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "themes" && (
        <div className="space-y-5 max-w-3xl">
          <Card className="p-5 sm:p-6 border border-border/60 space-y-4">
            <div>
              <h3 className="font-extrabold text-lg">{t("settings.projectThemes")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("settings.themeIntro")}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEME_PRESETS.map((preset) => {
                const active = themePrimary === preset.primary;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSaveTheme(preset.primary)}
                    className={`rounded-2xl border-2 p-3 text-start transition-all ${
                      active
                        ? "border-primary bg-primary/10 shadow-md shadow-primary/15"
                        : "border-border/70 hover:border-primary/40"
                    }`}
                  >
                    <span
                      className="block h-10 w-full rounded-xl mb-2 border border-black/10"
                      style={{ background: `hsl(${preset.primary})` }}
                    />
                    <p className="font-bold text-sm">{t(
                      preset.id === "emerald"
                        ? "settings.emerald"
                        : preset.id === "sky"
                          ? "settings.sky"
                          : preset.id === "blue"
                            ? "settings.blue"
                            : preset.id === "rose"
                              ? "settings.rose"
                              : preset.id === "violet"
                                ? "settings.purple"
                                : preset.id === "orange"
                                  ? "settings.orange"
                                  : preset.id === "teal"
                                    ? "settings.teal"
                                    : preset.id === "slate"
                                      ? "settings.slate"
                                      : "settings.gold"
                    )}</p>
                    {active && (
                      <p className="text-[10px] text-primary font-bold mt-0.5 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {t("settings.enabled")}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4 space-y-3">
              <p className="font-bold text-sm">{t("settings.customColor")}</p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => {
                    const hsl = hexToHslComponents(e.target.value);
                    if (hsl) {
                      setThemePrimary(hsl);
                      applyBrandPrimary(hsl);
                    }
                  }}
                  className="h-12 w-16 rounded-xl border border-border bg-transparent cursor-pointer"
                  title={t("settings.chooseColor")}
                />
                <div className="flex-1 min-w-[12rem]">
                  <Input
                    value={themePrimary}
                    onChange={(e) => {
                      setThemePrimary(e.target.value);
                      applyBrandPrimary(e.target.value);
                    }}
                    placeholder="38 92% 50%"
                    dir="ltr"
                  />
                </div>
                <Button
                  className="gap-2"
                  isLoading={savingSettings}
                  onClick={() => handleSaveTheme(themePrimary.trim())}
                >
                  <Save className="w-4 h-4" /> {t("settings.saveColor")}
                </Button>
              </div>
              <div
                className="h-14 rounded-xl border border-border/60 flex items-center justify-center font-bold text-primary-foreground"
                style={{ background: `linear-gradient(90deg, hsl(${themePrimary}), hsl(${themePrimary}) 60%, #d97706)` }}
              >
                {t("settings.colorPreview")}
              </div>
            </div>
          </Card>
        </div>
      )}
      </div>
      </div>

      <Dialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("settings.deleteDevice")}
        maxWidth="max-w-md"
      >
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-bold text-lg">{t("settings.deleteDeviceAsk", { name: deleteTarget?.deviceName ?? "" })}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("settings.deleteDeviceHint")}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" className="flex-1" isLoading={deleting} onClick={handleDelete}>
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
