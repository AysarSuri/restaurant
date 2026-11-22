import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDrivers,
  useCreateDriver,
  useUpdateDriver,
  useDeleteDriver,
  useGetBranches,
  useGetShifts,
  useGetSettings,
  type Driver,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Card, Dialog } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { YmdDateInput } from "@/components/ymd-date-input";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import { formatMoney } from "@/lib/currency";
import {
  Bike,
  Building2,
  Clock3,
  Plus,
  Search,
  Pencil,
  Trash2,
  Phone,
  Car,
  StickyNote,
  Wallet,
  Receipt,
  Package,
  Sigma,
  Filter,
} from "lucide-react";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  name: "",
  phone: "",
  vehicleInfo: "",
  branchId: "" as number | "",
  notes: "",
  isActive: true,
};

type FormData = typeof EMPTY_FORM;

export default function DriversPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const { data: settings } = useGetSettings();
  const { data: branches } = useGetBranches();
  const { data: shifts } = useGetShifts();

  const [date, setDate] = useState(todayYmd);
  const [filterBranchId, setFilterBranchId] = useState<number | "">(
    selectedBranchId === "all" ? "" : selectedBranchId
  );
  const [filterShiftId, setFilterShiftId] = useState<number | "">("");
  const [filterDriverId, setFilterDriverId] = useState<number | "">("");
  const [search, setSearch] = useState("");

  const params = useMemo(
    () => ({
      date,
      branchId: filterBranchId,
      shiftId: filterShiftId,
      driverId: filterDriverId,
      search: search.trim() || undefined,
    }),
    [date, filterBranchId, filterShiftId, filterDriverId, search]
  );

  const { data, isLoading } = useGetDrivers({ params });
  const { mutate: createDriver, isPending: creating } = useCreateDriver();
  const { mutate: updateDriver, isPending: updating } = useUpdateDriver();
  const { mutate: removeDriver, isPending: deleting } = useDeleteDriver();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [error, setError] = useState("");

  const money = (n: number) =>
    formatMoney(n, {
      currencyCode: (settings?.currencyCode as any) || "iqd",
      currencySymbol: settings?.currencySymbol || "د.ع",
      decimalPlaces: settings?.decimalPlaces ?? 0,
    });

  const activeBranches = useMemo(
    () => (branches ?? []).filter((b) => b.isActive !== false),
    [branches]
  );

  const branchOptions = useMemo<ComboboxOption[]>(() => {
    const opts: ComboboxOption[] = [
      { value: "", label: t("drivers.allBranches"), icon: Building2 },
    ];
    for (const b of activeBranches) {
      opts.push({ value: String(b.id), label: b.name, icon: Building2 });
    }
    return opts;
  }, [activeBranches, t]);

  const formBranchOptions = useMemo<ComboboxOption[]>(() => {
    const opts: ComboboxOption[] = [
      { value: "", label: t("branch.noneSpecified"), icon: Building2 },
    ];
    for (const b of activeBranches) {
      opts.push({ value: String(b.id), label: b.name, icon: Building2 });
    }
    return opts;
  }, [activeBranches, t]);

  const shiftOptions = useMemo<ComboboxOption[]>(() => {
    const opts: ComboboxOption[] = [
      { value: "", label: t("drivers.allShifts"), icon: Clock3 },
    ];
    const scoped = (shifts ?? []).filter((s) => {
      if (filterBranchId === "") return true;
      return s.branchId === filterBranchId;
    });
    for (const s of scoped) {
      opts.push({
        value: String(s.id),
        label: s.nameAr?.trim() || s.name,
        subtitle: `${s.startTime} – ${s.endTime}${s.branchName ? ` · ${s.branchName}` : ""}`,
        icon: Clock3,
      });
    }
    return opts;
  }, [shifts, filterBranchId, t]);

  const driverFilterOptions = useMemo<ComboboxOption[]>(() => {
    const opts: ComboboxOption[] = [
      { value: "", label: t("drivers.allDrivers"), icon: Bike },
    ];
    for (const d of data?.drivers ?? []) {
      opts.push({
        value: String(d.id),
        label: d.name,
        subtitle: d.phone?.trim() || d.branchName || undefined,
        icon: Bike,
      });
    }
    return opts;
  }, [data?.drivers, t]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm({
      ...EMPTY_FORM,
      branchId:
        filterBranchId !== ""
          ? filterBranchId
          : selectedBranchId === "all"
            ? ""
            : selectedBranchId,
    });
    setError("");
    setFormOpen(true);
  };

  const openEdit = (row: Driver) => {
    setEditTarget(row);
    setForm({
      name: row.name,
      phone: row.phone ?? "",
      vehicleInfo: row.vehicleInfo ?? "",
      branchId: row.branchId ?? "",
      notes: row.notes ?? "",
      isActive: row.isActive !== false,
    });
    setError("");
    setFormOpen(true);
  };

  const submitForm = () => {
    const name = form.name.trim();
    if (!name) {
      setError(t("drivers.nameRequired"));
      return;
    }
    const payload = {
      name,
      phone: form.phone.trim() || null,
      vehicleInfo: form.vehicleInfo.trim() || null,
      branchId: form.branchId === "" ? null : Number(form.branchId),
      notes: form.notes.trim() || null,
      isActive: form.isActive,
    };
    if (editTarget) {
      updateDriver(
        { id: editTarget.id, data: payload },
        {
          onSuccess: () => {
            setFormOpen(false);
            invalidate();
          },
          onError: (err: any) =>
            setError(err?.data?.message || err?.message || t("drivers.saveFailed")),
        }
      );
      return;
    }
    createDriver(
      { data: payload },
      {
        onSuccess: () => {
          setFormOpen(false);
          invalidate();
        },
        onError: (err: any) =>
          setError(err?.data?.message || err?.message || t("drivers.saveFailed")),
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeDriver(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          invalidate();
        },
      }
    );
  };

  const drivers = data?.drivers ?? [];
  const totals = data?.totals ?? {
    orderCount: 0,
    invoiceCount: 0,
    invoiceAmount: 0,
    deliveryAmount: 0,
    grandTotal: 0,
  };

  const statCards = [
    {
      key: "orders",
      label: t("drivers.statOrders"),
      value: String(totals.orderCount),
      icon: Package,
      tone: "from-sky-500/20 to-sky-500/5 text-sky-700 dark:text-sky-300",
    },
    {
      key: "invoices",
      label: t("drivers.statInvoices"),
      value: String(totals.invoiceCount),
      icon: Receipt,
      tone: "from-violet-500/20 to-violet-500/5 text-violet-700 dark:text-violet-300",
    },
    {
      key: "invoiceAmount",
      label: t("drivers.statInvoiceAmount"),
      value: money(totals.invoiceAmount),
      icon: Wallet,
      tone: "from-emerald-500/20 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    },
    {
      key: "deliveryAmount",
      label: t("drivers.statDeliveryAmount"),
      value: money(totals.deliveryAmount),
      icon: Bike,
      tone: "from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-300",
    },
    {
      key: "grand",
      label: t("drivers.statGrandTotal"),
      value: money(totals.grandTotal),
      icon: Sigma,
      tone: "from-primary/25 to-primary/5 text-primary",
    },
  ];

  return (
    <div className="space-y-5 pb-8">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-gradient-to-br from-card via-card to-sky-500/[0.07] p-5 sm:p-7">
        <div className="absolute -end-10 -top-12 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -start-8 bottom-0 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
              {t("drivers.kicker")}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">{t("drivers.title")}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("drivers.subtitle")}</p>
          </div>
          <Button className="gap-2 shadow-lg shadow-sky-500/15" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            {t("drivers.add")}
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-5 border border-border/60 space-y-4">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <Filter className="w-4 h-4 text-primary" />
          {t("drivers.filters")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              {t("common.date")}
            </label>
            <YmdDateInput value={date} onChange={setDate} />
          </div>
          <ModernCombobox
            label={t("common.branch")}
            icon={Building2}
            value={filterBranchId === "" ? "" : String(filterBranchId)}
            onChange={(v) => {
              setFilterBranchId(v ? Number(v) : "");
              setFilterShiftId("");
            }}
            options={branchOptions}
            placeholder={t("drivers.allBranches")}
            searchPlaceholder={t("branch.search")}
          />
          <ModernCombobox
            label={t("nav.shifts")}
            icon={Clock3}
            value={filterShiftId === "" ? "" : String(filterShiftId)}
            onChange={(v) => setFilterShiftId(v ? Number(v) : "")}
            options={shiftOptions}
            placeholder={t("drivers.allShifts")}
            searchPlaceholder={t("shifts.search")}
          />
          <ModernCombobox
            label={t("drivers.driver")}
            icon={Bike}
            value={filterDriverId === "" ? "" : String(filterDriverId)}
            onChange={(v) => setFilterDriverId(v ? Number(v) : "")}
            options={driverFilterOptions}
            placeholder={t("drivers.allDrivers")}
            searchPlaceholder={t("drivers.search")}
          />
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              {t("common.search")}
            </label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="ps-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("drivers.search")}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.key}
              className={`p-4 border border-border/50 bg-gradient-to-br ${s.tone} space-y-2`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold opacity-80">{s.label}</p>
                <Icon className="w-4 h-4 opacity-70" />
              </div>
              <p className="font-display text-lg sm:text-xl font-black tabular-nums truncate" dir="ltr">
                {s.value}
              </p>
            </Card>
          );
        })}
      </div>

      {isLoading && !data ? (
        <Card className="p-10 text-center text-muted-foreground border border-dashed">
          {t("common.loading")}
        </Card>
      ) : drivers.length === 0 ? (
        <Card className="p-10 text-center border border-dashed border-border/70 space-y-3">
          <Bike className="w-12 h-12 mx-auto text-sky-500/80" />
          <p className="font-extrabold text-lg">{t("drivers.empty")}</p>
          <p className="text-sm text-muted-foreground">{t("drivers.emptyHint")}</p>
          <Button className="gap-2 mt-2" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            {t("drivers.add")}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {drivers.map((row) => (
            <Card
              key={row.id}
              className={`p-4 sm:p-5 border space-y-4 transition-shadow hover:shadow-md ${
                row.isActive === false
                  ? "border-border/40 opacity-70"
                  : "border-border/60 bg-card/90"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                    <Bike className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-base truncate">{row.name}</h3>
                      {row.isActive === false ? (
                        <Badge variant="outline">{t("common.inactive")}</Badge>
                      ) : (
                        <Badge variant="default">{t("common.active")}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {row.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span dir="ltr">{row.phone}</span>
                        </span>
                      ) : null}
                      {row.vehicleInfo ? (
                        <span className="inline-flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          {row.vehicleInfo}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {row.branchName || t("branch.noneSpecified")}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="w-9 h-9 rounded-xl border border-border/70 hover:bg-secondary flex items-center justify-center"
                    title={t("common.edit")}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(row)}
                    className="w-9 h-9 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 flex items-center justify-center"
                    title={t("common.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="rounded-xl bg-secondary/50 px-2.5 py-2">
                  <p className="text-[10px] font-bold text-muted-foreground">{t("drivers.statOrders")}</p>
                  <p className="font-display font-black tabular-nums">{row.orderCount}</p>
                </div>
                <div className="rounded-xl bg-secondary/50 px-2.5 py-2">
                  <p className="text-[10px] font-bold text-muted-foreground">{t("drivers.statInvoices")}</p>
                  <p className="font-display font-black tabular-nums">{row.invoiceCount}</p>
                </div>
                <div className="rounded-xl bg-secondary/50 px-2.5 py-2">
                  <p className="text-[10px] font-bold text-muted-foreground">{t("drivers.statInvoiceAmount")}</p>
                  <p className="font-display font-black tabular-nums text-sm truncate" dir="ltr">
                    {money(row.invoiceAmount)}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/50 px-2.5 py-2">
                  <p className="text-[10px] font-bold text-muted-foreground">{t("drivers.statDeliveryAmount")}</p>
                  <p className="font-display font-black tabular-nums text-sm truncate" dir="ltr">
                    {money(row.deliveryAmount)}
                  </p>
                </div>
                <div className="rounded-xl bg-primary/10 px-2.5 py-2 col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-bold text-primary/80">{t("drivers.statGrandTotal")}</p>
                  <p className="font-display font-black tabular-nums text-sm text-primary truncate" dir="ltr">
                    {money(row.grandTotal)}
                  </p>
                </div>
              </div>

              {row.notes?.trim() ? (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <StickyNote className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{row.notes}</span>
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? t("drivers.edit") : t("drivers.add")}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("drivers.formHint")}</p>
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive font-bold">
              {error}
            </div>
          ) : null}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5">{t("drivers.name")}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={t("drivers.namePh")}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5">{t("common.phoneNumber")}</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="07xxxxxxxxx"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">{t("drivers.vehicle")}</label>
                <Input
                  value={form.vehicleInfo}
                  onChange={(e) => setForm((p) => ({ ...p, vehicleInfo: e.target.value }))}
                  placeholder={t("drivers.vehiclePh")}
                />
              </div>
            </div>
            <ModernCombobox
              label={t("common.branch")}
              icon={Building2}
              value={form.branchId === "" ? "" : String(form.branchId)}
              onChange={(v) => setForm((p) => ({ ...p, branchId: v ? Number(v) : "" }))}
              options={formBranchOptions}
              placeholder={t("auth.selectBranch")}
              searchPlaceholder={t("branch.search")}
            />
            <div>
              <label className="block text-sm font-semibold mb-1.5">{t("common.notes")}</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={t("drivers.notesPh")}
              />
            </div>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              className={`w-full rounded-2xl border-2 px-4 py-3 text-start transition-all ${
                form.isActive
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-border/70 bg-secondary/40"
              }`}
            >
              <p className="font-extrabold text-sm">
                {form.isActive ? t("common.active") : t("common.inactive")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("drivers.activeHint")}</p>
            </button>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button isLoading={creating || updating} onClick={submitForm}>
              {editTarget ? t("common.save") : t("drivers.add")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("drivers.deleteTitle")}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("drivers.deleteAsk", { name: deleteTarget?.name ?? "" })}
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" isLoading={deleting} onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
