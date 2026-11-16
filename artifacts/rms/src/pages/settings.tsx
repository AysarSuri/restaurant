import React, { useEffect, useMemo, useState } from "react";
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
  type DevicePrinter,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Card, Dialog } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { useBranch } from "@/lib/branch-context";
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
  Wallet,
  ChefHat,
  ArrowLeftRight,
} from "lucide-react";
import type { PosSaveTarget } from "@workspace/api-client-react";

type TabId = "restaurant" | "sales" | "printers" | "themes" | "currency";

const TABS: { id: TabId; label: string; icon: typeof Store; hint: string }[] = [
  { id: "restaurant", label: "اسم المطعم", icon: Store, hint: "الهوية الأساسية" },
  { id: "sales", label: "البيع", icon: ShoppingBag, hint: "مسار الطلبات" },
  { id: "printers", label: "الطابعات", icon: Printer, hint: "80×80 لكل جهاز" },
  { id: "currency", label: "العملة", icon: Coins, hint: "د.ع / $ / €" },
  { id: "themes", label: "الثيمات", icon: Palette, hint: "لون المشروع" },
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
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const { data: settings } = useGetSettings();
  const { data: printers, isLoading: printersLoading } = useGetDevicePrinters();
  const { data: branches } = useGetBranches();
  const { mutate: saveSettings, isPending: savingSettings } = useUpdateSettings();
  const { mutate: upsertPrinter, isPending: upserting } = useUpsertDevicePrinter();
  const { mutate: updatePrinter, isPending: updatingPrinter } = useUpdateDevicePrinter();
  const { mutate: deletePrinter, isPending: deleting } = useDeleteDevicePrinter();

  const [tab, setTab] = useState<TabId>("restaurant");
  const [restaurantName, setRestaurantName] = useState("");
  const [themePrimary, setThemePrimary] = useState("38 92% 50%");
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(DEFAULT_CURRENCY.currencyCode);
  const [currencySymbol, setCurrencySymbol] = useState(DEFAULT_CURRENCY.currencySymbol);
  const [currencyName, setCurrencyName] = useState(DEFAULT_CURRENCY.currencyName);
  const [decimalPlaces, setDecimalPlaces] = useState(DEFAULT_CURRENCY.decimalPlaces);
  const [posSaveTarget, setPosSaveTarget] = useState<PosSaveTarget>("cashier");
  const [cashierSendToKitchen, setCashierSendToKitchen] = useState(true);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  const deviceKey = useMemo(() => getOrCreateDeviceKey(), []);
  const [deviceName, setDeviceName] = useState(() => suggestDeviceName());
  const [printerName, setPrinterName] = useState("");
  const [deviceBranchId, setDeviceBranchId] = useState<number | "">("");
  const [deleteTarget, setDeleteTarget] = useState<DevicePrinter | null>(null);

  useEffect(() => {
    if (!settings) return;
    setRestaurantName(settings.restaurantName);
    setThemePrimary(settings.themePrimary);
    applyBrandPrimary(settings.themePrimary);
    setCurrencyCode((settings.currencyCode as CurrencyCode) || DEFAULT_CURRENCY.currencyCode);
    setCurrencySymbol(settings.currencySymbol || DEFAULT_CURRENCY.currencySymbol);
    setCurrencyName(settings.currencyName || DEFAULT_CURRENCY.currencyName);
    setDecimalPlaces(clampDecimalPlaces(settings.decimalPlaces, DEFAULT_CURRENCY.decimalPlaces));
    setPosSaveTarget(
      settings.posSaveTarget === "kitchen" || settings.posSaveTarget === "none"
        ? settings.posSaveTarget
        : "cashier"
    );
    setCashierSendToKitchen(settings.cashierSendToKitchen !== false);
  }, [settings]);

  useEffect(() => {
    const mine = (printers ?? []).find((p) => p.deviceKey === deviceKey);
    if (mine) {
      setDeviceName(mine.deviceName);
      setPrinterName(mine.printerName || "");
      setDeviceBranchId(mine.branchId ?? "");
    } else if (selectedBranchId !== "all") {
      setDeviceBranchId(selectedBranchId);
    }
  }, [printers, deviceKey, selectedBranchId]);

  const activeBranches = useMemo(
    () => (branches ?? []).filter((b) => b.isActive !== false),
    [branches]
  );

  const branchOptions = useMemo<ComboboxOption[]>(() => {
    const opts: ComboboxOption[] = [
      {
        value: "",
        label: "بدون فرع محدد",
        subtitle: "الجهاز غير مرتبط بفرع",
        icon: Monitor,
      },
    ];
    for (const b of activeBranches) {
      opts.push({
        value: String(b.id),
        label: b.name,
        subtitle: b.address?.trim() || "فرع نشط",
        icon: Building2,
      });
    }
    return opts;
  }, [activeBranches]);

  const printerOptions = useMemo<ComboboxOption[]>(() => {
    const seen = new Set<string>();
    const opts: ComboboxOption[] = [];
    for (const name of PRINTER_PRESETS) {
      seen.add(name);
      opts.push({
        value: name,
        label: name,
        subtitle: "طابعة حرارية 80×80",
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
          subtitle: "طابعة محفوظة مسبقاً",
          icon: Printer,
        });
      }
    }
    if (printerName.trim() && !seen.has(printerName.trim())) {
      opts.unshift({
        value: printerName.trim(),
        label: printerName.trim(),
        subtitle: "القيمة الحالية",
        icon: Printer,
      });
    }
    return opts;
  }, [printers, printerName]);

  const syncSettings = (next: Record<string, unknown>) => {
    queryClient.setQueryData(getGetSettingsQueryKey(), (prev: any) => ({
      ...(prev ?? {}),
      ...next,
    }));
  };

  const applyCurrencyPreset = (code: Exclude<CurrencyCode, "custom">) => {
    const preset = CURRENCY_PRESETS.find((p) => p.code === code);
    if (!preset) return;
    setCurrencyCode(code);
    setCurrencyName(preset.name);
    setCurrencySymbol(preset.symbol);
    setDecimalPlaces(preset.decimalPlaces);
  };

  const handleSaveCurrency = () => {
    setSaveMsg("");
    setSaveErr("");
    const name = currencyName.trim();
    const symbol = currencySymbol.trim();
    if (!name) {
      setSaveErr("اسم العملة مطلوب");
      return;
    }
    if (!symbol) {
      setSaveErr("رمز العملة مطلوب");
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
          setSaveMsg("تم حفظ إعدادات العملة");
        },
        onError: (err: any) => setSaveErr(err?.data?.message || err?.message || "تعذر الحفظ"),
      }
    );
  };

  const syncPrinters = (updater: (list: DevicePrinter[]) => DevicePrinter[]) => {
    queryClient.setQueryData<DevicePrinter[]>(getGetDevicePrintersQueryKey(), (prev) =>
      updater(prev ?? [])
    );
  };

  const handleSaveRestaurant = () => {
    setSaveMsg("");
    setSaveErr("");
    const name = restaurantName.trim();
    if (!name) {
      setSaveErr("اسم المطعم مطلوب");
      return;
    }
    saveSettings(
      { data: { restaurantName: name } },
      {
        onSuccess: (res) => {
          syncSettings(res);
          setSaveMsg("تم حفظ اسم المطعم");
        },
        onError: (err: any) => setSaveErr(err?.data?.message || err?.message || "تعذر الحفظ"),
      }
    );
  };

  const handleSaveSales = () => {
    setSaveMsg("");
    setSaveErr("");
    saveSettings(
      {
        data: {
          posSaveTarget,
          cashierSendToKitchen,
        },
      },
      {
        onSuccess: (res) => {
          syncSettings(res);
          setPosSaveTarget(
            res.posSaveTarget === "kitchen" || res.posSaveTarget === "none"
              ? res.posSaveTarget
              : "cashier"
          );
          setCashierSendToKitchen(res.cashierSendToKitchen !== false);
          setSaveMsg("تم حفظ إعدادات البيع");
        },
        onError: (err: any) => setSaveErr(err?.data?.message || err?.message || "تعذر الحفظ"),
      }
    );
  };

  const handleSaveTheme = (primary: string) => {
    setSaveMsg("");
    setSaveErr("");
    applyBrandPrimary(primary);
    setThemePrimary(primary);
    saveSettings(
      { data: { themePrimary: primary } },
      {
        onSuccess: (res) => {
          syncSettings(res);
          setSaveMsg("تم حفظ لون الثيم");
        },
        onError: (err: any) => setSaveErr(err?.data?.message || err?.message || "تعذر الحفظ"),
      }
    );
  };

  const handleRegisterDevice = () => {
    setSaveMsg("");
    setSaveErr("");
    const name = deviceName.trim();
    if (!name) {
      setSaveErr("أدخل اسم الجهاز");
      return;
    }
    if (!printerName.trim()) {
      setSaveErr("اختر أو اكتب اسم الطابعة");
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
          setSaveMsg("تم حفظ طابعة هذا الجهاز (80×80)");
        },
        onError: (err: any) => setSaveErr(err?.data?.message || err?.message || "تعذر الحفظ"),
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
        },
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
        },
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
            System Settings
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">الإعدادات</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            اسم المطعم، مسار البيع، طابعات 80×80 لكل جهاز، العملة، وثيم المشروع.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 sm:gap-3">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setSaveMsg("");
                setSaveErr("");
              }}
              className={`text-start rounded-2xl border-2 px-4 py-3.5 transition-all ${
                active
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border/70 bg-card/60 hover:border-primary/35"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-extrabold text-sm sm:text-base truncate">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.hint}</p>
                </div>
                {active && <Check className="w-4 h-4 text-primary ms-auto flex-shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      {(saveMsg || saveErr) && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-sm flex items-start gap-2 ${
            saveErr
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-success/30 bg-success/10 text-success"
          }`}
        >
          {saveErr ? <AlertTriangle className="w-4 h-4 mt-0.5" /> : <Check className="w-4 h-4 mt-0.5" />}
          <span>{saveErr || saveMsg}</span>
        </div>
      )}

      {tab === "sales" && (
        <div className="space-y-5 max-w-3xl">
          <Card className="p-5 sm:p-6 border border-border/60 space-y-5">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-extrabold text-lg">عند الحفظ من نقطة البيع</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  اختر أين يذهب الطلب مباشرة بعد الضغط على الحفظ في شاشة البيع أو طلب الطاولة.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPosSaveTarget("cashier")}
                className={`text-start rounded-2xl border-2 p-4 transition-all ${
                  posSaveTarget === "cashier"
                    ? "border-amber-500/70 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                    : "border-border/70 bg-card/50 hover:border-amber-500/35"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      posSaveTarget === "cashier"
                        ? "bg-amber-500 text-white"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    <Wallet className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">إلى شاشة الكاشير</p>
                    <p className="text-[11px] text-muted-foreground">الحالة: بانتظار الدفع</p>
                  </div>
                  {posSaveTarget === "cashier" && (
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يظهر الطلب في شاشة الكاشير أولاً لاستلام الدفع، ثم يمكن إرساله للمطبخ حسب الخيار أدناه.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPosSaveTarget("kitchen")}
                className={`text-start rounded-2xl border-2 p-4 transition-all ${
                  posSaveTarget === "kitchen"
                    ? "border-orange-500/70 bg-orange-500/10 shadow-lg shadow-orange-500/10"
                    : "border-border/70 bg-card/50 hover:border-orange-500/35"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      posSaveTarget === "kitchen"
                        ? "bg-orange-500 text-white"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    <ChefHat className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">إلى شاشة المطبخ</p>
                    <p className="text-[11px] text-muted-foreground">الحالة: قيد التحضير</p>
                  </div>
                  {posSaveTarget === "kitchen" && (
                    <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يتخطى الطلب شاشة الكاشير ويظهر مباشرة في شاشة المطبخ للتحضير فوراً.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPosSaveTarget("none")}
                className={`text-start rounded-2xl border-2 p-4 transition-all sm:col-span-2 xl:col-span-1 ${
                  posSaveTarget === "none"
                    ? "border-emerald-500/70 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                    : "border-border/70 bg-card/50 hover:border-emerald-500/35"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      posSaveTarget === "none"
                        ? "bg-emerald-500 text-white"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    <Save className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">حفظ تلقائي فقط</p>
                    <p className="text-[11px] text-muted-foreground">الحالة: مدفوع / محفوظ</p>
                  </div>
                  {posSaveTarget === "none" && (
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يُحفظ الطلب مباشرة من نقطة البيع دون إرساله إلى شاشة الكاشير أو شاشة المطبخ.
                </p>
              </button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 border border-border/60 space-y-5">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-lg">عند الحفظ من شاشة الكاشير</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  بعد تأكيد الدفع في الكاشير: هل يُرسل الطلب إلى شاشة المطبخ؟
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCashierSendToKitchen((v) => !v)}
              className={`w-full text-start rounded-2xl border-2 p-4 transition-all ${
                cashierSendToKitchen
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/70 bg-card/50 hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    cashierSendToKitchen
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  <ChefHat className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">إرسال للمطبخ عند حفظ الكاشير</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cashierSendToKitchen
                      ? "مفعّل — الطلب ينتقل للمطبخ بعد الدفع"
                      : "معطّل — الطلب يُحفظ كمدفوع دون المطبخ"}
                  </p>
                </div>
                <span
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
                    cashierSendToKitchen ? "bg-primary" : "bg-secondary"
                  }`}
                  aria-hidden
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      cashierSendToKitchen ? "start-1" : "end-1"
                    }`}
                  />
                </span>
              </div>
            </button>
          </Card>

          <Card className="p-5 sm:p-6 border border-border/60 space-y-4">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              <h3 className="font-extrabold">معاينة المسار الحالي</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/40 px-3 py-1.5 font-bold">
                <ShoppingBag className="w-3.5 h-3.5" />
                نقطة البيع
              </span>
              <span className="text-muted-foreground">←</span>
              {posSaveTarget === "cashier" ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">
                    <Wallet className="w-3.5 h-3.5" />
                    الكاشير
                  </span>
                  {cashierSendToKitchen && (
                    <>
                      <span className="text-muted-foreground">←</span>
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 font-bold text-orange-600 dark:text-orange-400">
                        <ChefHat className="w-3.5 h-3.5" />
                        المطبخ
                      </span>
                    </>
                  )}
                </>
              ) : posSaveTarget === "kitchen" ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 font-bold text-orange-600 dark:text-orange-400">
                  <ChefHat className="w-3.5 h-3.5" />
                  المطبخ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <Save className="w-3.5 h-3.5" />
                  حفظ فقط
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {posSaveTarget === "kitchen"
                ? "الطلبات من نقطة البيع تذهب مباشرة لشاشة المطبخ."
                : posSaveTarget === "none"
                  ? "الطلبات تُحفظ مباشرة من نقطة البيع دون الظهور في الكاشير أو المطبخ."
                  : cashierSendToKitchen
                    ? "الطلبات تمر بالكاشير أولاً، ثم تُرسل للمطبخ بعد تأكيد الدفع."
                    : "الطلبات تظهر في الكاشير فقط، ولن تُرسل للمطبخ عند الحفظ."}
            </p>
          </Card>

          <div className="flex justify-end">
            <Button
              className="gap-2 min-w-[10rem]"
              isLoading={savingSettings}
              onClick={handleSaveSales}
            >
              <Save className="w-4 h-4" />
              حفظ إعدادات البيع
            </Button>
          </div>
        </div>
      )}

      {tab === "restaurant" && (
        <Card className="p-5 sm:p-6 border border-border/60 space-y-5 max-w-2xl">
          <div>
            <h3 className="font-extrabold text-lg">اسم المطعم</h3>
            <p className="text-sm text-muted-foreground mt-1">
              يظهر في الواجهة والهوية العامة للنظام.
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">الاسم *</label>
            <Input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="مثال: مطعم الذواقة"
            />
          </div>
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-transparent to-transparent p-4">
            <p className="text-[11px] text-muted-foreground mb-1">معاينة</p>
            <p className="text-xl font-extrabold">{restaurantName.trim() || "—"}</p>
          </div>
          <Button className="gap-2" isLoading={savingSettings} onClick={handleSaveRestaurant}>
            <Save className="w-4 h-4" /> حفظ الاسم
          </Button>
        </Card>
      )}

      {tab === "printers" && (
        <div className="space-y-5">
          <Card className="p-5 sm:p-6 border border-primary/25 bg-gradient-to-br from-card via-card to-primary/[0.05] space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-lg">هذا الجهاز</h3>
                  <Badge variant="default">طابعة 80×80</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  سجّل اسم الحاسوب/الجهاز واختر طابعته الخاصة. كل فرع يمكن أن يملك عدة أجهزة.
                </p>
              </div>
              <Monitor className="w-8 h-8 text-primary opacity-80" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">اسم الجهاز *</label>
                <Input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="مثال: كاشير الفرع 1 - جهاز 2"
                />
              </div>
              <ModernCombobox
                label="الفرع"
                hint="ربط الجهاز بفرع"
                icon={Building2}
                value={deviceBranchId === "" ? "" : String(deviceBranchId)}
                onChange={(v) => setDeviceBranchId(v ? Number(v) : "")}
                options={branchOptions}
                placeholder="اختر الفرع"
                searchPlaceholder="ابحث عن فرع..."
              />
              <div className="md:col-span-2">
                <ModernCombobox
                  label="اسم الطابعة"
                  hint="80×80"
                  icon={Printer}
                  value={printerName}
                  onChange={setPrinterName}
                  options={printerOptions}
                  placeholder="اختر اسم الطابعة"
                  searchPlaceholder="ابحث عن طابعة..."
                  allowCustom
                  customPlaceholder="أو اكتب اسم الطابعة كما في ويندوز"
                  dir="ltr"
                />
              </div>
            </div>

            <Button className="gap-2" isLoading={upserting} onClick={handleRegisterDevice}>
              <Plus className="w-4 h-4" /> حفظ طابعة هذا الجهاز
            </Button>
          </Card>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-extrabold text-lg">الأجهزة المسجّلة</h3>
              <button
                type="button"
                className="text-xs font-bold text-primary inline-flex items-center gap-1"
                onClick={() => queryClient.invalidateQueries({ queryKey: getGetDevicePrintersQueryKey() })}
              >
                <RefreshCw className="w-3.5 h-3.5" /> تحديث
              </button>
            </div>

            {printersLoading && !printers ? (
              <p className="text-muted-foreground text-sm py-8 text-center">جاري التحميل...</p>
            ) : (printers ?? []).length === 0 ? (
              <Card className="p-8 text-center border border-dashed border-border/70">
                <Printer className="w-10 h-10 mx-auto text-primary mb-3 opacity-80" />
                <p className="font-bold">لا توجد أجهزة بعد</p>
                <p className="text-sm text-muted-foreground mt-1">
                  سجّل هذا الجهاز من النموذج أعلاه.
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
                            {isMine && <Badge variant="default">هذا الجهاز</Badge>}
                            <Badge variant="outline">80×80</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {row.branchName || "بدون فرع"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="w-9 h-9 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center justify-center"
                          onClick={() => setDeleteTarget(row)}
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                          اسم الجهاز
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
                          placeholder="اسم الجهاز"
                        />
                      </div>
                      <ModernCombobox
                        label="اسم الطابعة"
                        hint="80×80"
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
                                  subtitle: "القيمة الحالية",
                                  icon: Printer,
                                },
                                ...printerOptions,
                              ]
                            : printerOptions
                        }
                        placeholder="اختر الطابعة"
                        searchPlaceholder="ابحث عن طابعة..."
                        allowCustom
                        customPlaceholder="أو اكتب اسم طابعة مخصص"
                        disabled={updatingPrinter}
                        dir="ltr"
                      />
                      <ModernCombobox
                        label="الفرع"
                        icon={Building2}
                        value={row.branchId ? String(row.branchId) : ""}
                        onChange={(v) =>
                          handleUpdateRow(row, {
                            branchId: v ? Number(v) : null,
                          })
                        }
                        options={branchOptions}
                        placeholder="اختر الفرع"
                        searchPlaceholder="ابحث عن فرع..."
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
              <h3 className="font-extrabold text-lg">عملة المشروع</h3>
              <p className="text-sm text-muted-foreground mt-1">
                اختر دينار عراقي أو دولار أو يورو، أو عرّف عملة مخصصة مع عدد الخانات العشرية.
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
                        <p className="font-extrabold">{preset.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {preset.hint} · {preset.decimalPlaces} خانات عشرية
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
                    <p className="font-extrabold">عملة مخصصة</p>
                    <p className="text-[11px] text-muted-foreground">اسم ورمز و Decimal Places حسب اختيارك</p>
                  </div>
                  {currencyCode === "custom" && <Check className="w-4 h-4 text-primary ms-auto" />}
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">اسم العملة *</label>
                <Input
                  value={currencyName}
                  onChange={(e) => {
                    setCurrencyName(e.target.value);
                    if (currencyCode !== "custom") setCurrencyCode("custom");
                  }}
                  placeholder="مثال: دينار عراقي"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">رمز العملة *</label>
                <Input
                  value={currencySymbol}
                  onChange={(e) => {
                    setCurrencySymbol(e.target.value);
                    if (currencyCode !== "custom") setCurrencyCode("custom");
                  }}
                  placeholder="د.ع / $ / €"
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
                0 بدون كسور · 2 مناسب للدولار واليورو · حتى 4 كحد أقصى
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-transparent to-transparent p-4">
              <p className="text-[11px] text-muted-foreground mb-1">معاينة</p>
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
              <Save className="w-4 h-4" /> حفظ العملة
            </Button>
          </Card>
        </div>
      )}

      {tab === "themes" && (
        <div className="space-y-5 max-w-3xl">
          <Card className="p-5 sm:p-6 border border-border/60 space-y-4">
            <div>
              <h3 className="font-extrabold text-lg">ثيمات المشروع</h3>
              <p className="text-sm text-muted-foreground mt-1">
                اختر لوناً أساسياً للهوية — يُطبَّق فوراً على الأزرار والشارات والعناصر الرئيسية.
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
                    <p className="font-bold text-sm">{preset.label}</p>
                    {active && (
                      <p className="text-[10px] text-primary font-bold mt-0.5 flex items-center gap-1">
                        <Check className="w-3 h-3" /> مفعّل
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4 space-y-3">
              <p className="font-bold text-sm">لون مخصص</p>
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
                  title="اختيار لون"
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
                  <Save className="w-4 h-4" /> حفظ اللون
                </Button>
              </div>
              <div
                className="h-14 rounded-xl border border-border/60 flex items-center justify-center font-bold text-primary-foreground"
                style={{ background: `linear-gradient(90deg, hsl(${themePrimary}), hsl(${themePrimary}) 60%, #d97706)` }}
              >
                معاينة اللون الأساسي
              </div>
            </div>
          </Card>
        </div>
      )}

      <Dialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="حذف الجهاز"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-bold text-lg">حذف «{deleteTarget?.deviceName}»؟</p>
            <p className="text-sm text-muted-foreground mt-1">سيتم إزالة ربط الطابعة لهذا الجهاز.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" className="flex-1" isLoading={deleting} onClick={handleDelete}>
              حذف
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
