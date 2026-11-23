import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetShifts,
  useCreateShift,
  useCloseShift,
  useDeleteShift,
  useGetBranches,
  getGetShiftsQueryKey,
  type Shift,
  type ShiftKind,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Dialog, Card } from "@/components/ui-elements";
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import { YmdDateInput } from "@/components/ymd-date-input";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import {
  Plus,
  Trash2,
  Search,
  Clock3,
  Building2,
  SunMedium,
  MoonStar,
  Lock,
  Unlock,
  AlertTriangle,
} from "lucide-react";

const KIND_META: Record<
  ShiftKind,
  {
    labelKey: string;
    hintKey: string;
    color: string;
    soft: string;
    icon: typeof SunMedium;
  }
> = {
  morning: {
    labelKey: "shifts.kindMorning",
    hintKey: "shifts.kindMorningHint",
    color: "#0ea5e9",
    soft: "from-sky-400/25 via-sky-500/10 to-amber-300/15",
    icon: SunMedium,
  },
  evening: {
    labelKey: "shifts.kindEvening",
    hintKey: "shifts.kindEveningHint",
    color: "#64748b",
    soft: "from-slate-500/30 via-slate-600/15 to-indigo-500/10",
    icon: MoonStar,
  },
};

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Always Latin (English) digits for shift open/close timestamps
  return new Intl.DateTimeFormat("en-GB", {
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default function ShiftsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const { data: shifts, isLoading } = useGetShifts();
  const { data: branches } = useGetBranches();
  const { mutate: createShift, isPending: isCreating } = useCreateShift();
  const { mutate: closeShift, isPending: isClosing } = useCloseShift();
  const { mutate: deleteShift, isPending: isDeleting } = useDeleteShift();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [closeTarget, setCloseTarget] = useState<Shift | null>(null);
  const [kind, setKind] = useState<ShiftKind | "">("morning");
  const [branchId, setBranchId] = useState<number | "">("");
  const [openDate, setOpenDate] = useState(todayYmd);
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState("");

  const activeBranches = useMemo(
    () => (branches ?? []).filter((b) => b.isActive !== false),
    [branches]
  );

  const branchOptions = useMemo<ComboboxOption[]>(
    () =>
      activeBranches.map((b) => ({
        value: String(b.id),
        label: b.name,
        icon: Building2,
      })),
    [activeBranches]
  );

  const syncShifts = (next: Shift[]) => {
    queryClient.setQueryData<Shift[]>(getGetShiftsQueryKey(), next);
  };

  const filtered = useMemo(() => {
    const list = shifts ?? [];
    const scoped =
      selectedBranchId === "all"
        ? list
        : list.filter((s) => s.branchId === selectedBranchId);
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.branchName ?? "").toLowerCase().includes(q) ||
        s.openDate.includes(q) ||
        s.kind.includes(q)
    );
  }, [shifts, selectedBranchId, search]);

  const stats = useMemo(() => {
    const list =
      selectedBranchId === "all"
        ? shifts ?? []
        : (shifts ?? []).filter((s) => s.branchId === selectedBranchId);
    return {
      total: list.length,
      open: list.filter((s) => s.isOpen).length,
      morning: list.filter((s) => s.kind === "morning").length,
      evening: list.filter((s) => s.kind === "evening").length,
    };
  }, [shifts, selectedBranchId]);

  const openAdd = () => {
    const defaultBranch =
      selectedBranchId !== "all"
        ? selectedBranchId
        : activeBranches.length === 1
          ? activeBranches[0].id
          : "";
    setKind("morning");
    setBranchId(defaultBranch);
    setOpenDate(todayYmd());
    setNotes("");
    setSubmitError("");
    setFormOpen(true);
  };

  const openShiftForBranch = useMemo(() => {
    if (branchId === "" || !Number(branchId)) return null;
    return (shifts ?? []).find(
      (s) => s.branchId === Number(branchId) && s.isOpen
    ) ?? null;
  }, [shifts, branchId]);

  const handleOpenShift = () => {
    setSubmitError("");
    if (!kind) {
      setSubmitError(t("shifts.errKind"));
      return;
    }
    if (branchId === "" || !Number(branchId)) {
      setSubmitError(t("shifts.errBranch"));
      return;
    }
    if (!openDate) {
      setSubmitError(t("shifts.errOpenDate"));
      return;
    }
    if (openShiftForBranch) {
      setSubmitError(
        t("shifts.errBranchAlreadyOpen", {
          name: t(KIND_META[openShiftForBranch.kind].labelKey),
        })
      );
      return;
    }
    createShift(
      {
        data: {
          kind,
          branchId: Number(branchId),
          openedAt: openDate,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: (created) => {
          syncShifts([created, ...(shifts ?? []).filter((s) => s.id !== created.id)]);
          setFormOpen(false);
        },
        onError: (err: any) => {
          setSubmitError(err?.data?.message || err?.message || t("shifts.saveFailed"));
        },
      }
    );
  };

  const confirmClose = () => {
    if (!closeTarget) return;
    closeShift(
      { id: closeTarget.id },
      {
        onSuccess: (updated) => {
          syncShifts((shifts ?? []).map((s) => (s.id === updated.id ? updated : s)));
          setCloseTarget(null);
        },
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteShift(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          syncShifts((shifts ?? []).filter((s) => s.id !== deleteTarget.id));
          setDeleteTarget(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-l from-sky-500/15 via-card to-card p-5 sm:p-7">
        <div className="absolute -top-16 -start-10 h-44 w-44 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -end-8 h-48 w-48 rounded-full bg-slate-400/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-display tracking-[0.22em] uppercase text-sky-600 dark:text-sky-300 mb-2">
              {t("shifts.eyebrow")}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/25">
                <Clock3 className="w-5 h-5" />
              </span>
              {t("shifts.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
              {t("shifts.subtitleSimple")}
            </p>
          </div>
          <Button className="h-12 px-5 gap-2 shadow-lg shadow-sky-500/20" onClick={openAdd}>
            <Plus className="w-5 h-5" />
            {t("shifts.openShift")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: t("shifts.statTotal"), value: stats.total, icon: Clock3, tone: "text-sky-600" },
          { label: t("shifts.statOpen"), value: stats.open, icon: Unlock, tone: "text-emerald-600" },
          { label: t("shifts.kindMorning"), value: stats.morning, icon: SunMedium, tone: "text-sky-500" },
          { label: t("shifts.kindEvening"), value: stats.evening, icon: MoonStar, tone: "text-slate-500" },
        ].map((card) => (
          <Card
            key={card.label}
            className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3.5 flex items-center gap-3"
          >
            <span
              className={`h-10 w-10 rounded-xl bg-secondary/80 flex items-center justify-center ${card.tone}`}
            >
              <card.icon className="w-5 h-5" />
            </span>
            <div>
              <p className="text-[11px] text-muted-foreground font-bold">{card.label}</p>
              <p className="text-xl font-display font-extrabold tabular-nums">{card.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("shifts.searchSimple")}
          className="ps-10 h-12 rounded-2xl"
        />
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-dashed border-border/70 py-20 text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-secondary/20 py-16 text-center">
          <Clock3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-bold">{t("shifts.empty")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("shifts.emptyHintSimple")}</p>
          <Button className="mt-5 gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            {t("shifts.openShift")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((shift) => {
            const meta = KIND_META[shift.kind] ?? KIND_META.morning;
            const Icon = meta.icon;
            const color = shift.color || meta.color;
            return (
              <article
                key={shift.id}
                className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)]"
              >
                <div
                  className="absolute inset-y-0 start-0 w-1.5"
                  style={{ backgroundColor: color }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-3">
                    <span
                      className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 border"
                      style={{
                        backgroundColor: `${color}22`,
                        color,
                        borderColor: `${color}55`,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-extrabold truncate">
                          {t(meta.labelKey)}
                        </h2>
                        <Badge
                          className={
                            shift.isOpen
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30"
                          }
                        >
                          {shift.isOpen ? t("shifts.statusOpen") : t("shifts.statusClosed")}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {shift.branchName || t("branch.noneSpecified")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-3.5 flex-shrink-0">
                    {shift.isOpen ? (
                      <button
                        type="button"
                        onClick={() => setCloseTarget(shift)}
                        className="h-11 min-w-[5.75rem] sm:min-w-[6.5rem] px-4 rounded-xl border border-amber-500/35 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 flex items-center justify-center gap-2 text-sm font-extrabold touch-manipulation"
                      >
                        <Lock className="w-4 h-4" />
                        {t("shifts.close")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(shift)}
                      className="h-11 min-w-[5.75rem] sm:min-w-[6.5rem] px-4 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 flex items-center justify-center gap-2 text-sm font-extrabold touch-manipulation"
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("common.delete")}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-secondary/45 px-3 py-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground">
                      {t("shifts.openedAt")}
                    </p>
                    <p className="font-display font-extrabold tabular-nums text-sm mt-0.5" dir="ltr">
                      {formatDateTime(shift.openedAt)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-secondary/45 px-3 py-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground">
                      {t("shifts.closedAt")}
                    </p>
                    <p className="font-display font-extrabold tabular-nums text-sm mt-0.5" dir="ltr">
                      {shift.closedAt
                        ? formatDateTime(shift.closedAt)
                        : t("shifts.stillOpen")}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={t("shifts.openShift")}
        maxWidth="max-w-xl"
      >
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">{t("shifts.openHint")}</p>
          {submitError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-bold flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-extrabold mb-2.5">{t("shifts.kind")}</p>
            <div className="grid grid-cols-2 gap-3">
              {(["morning", "evening"] as const).map((k) => {
                const meta = KIND_META[k];
                const Icon = meta.icon;
                const selected = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`relative min-h-[7.5rem] touch-manipulation overflow-hidden rounded-[1.35rem] border-2 p-4 text-start transition-all active:scale-[0.98] ${
                      selected
                        ? "shadow-lg"
                        : "border-border/60 bg-card/70 hover:border-border"
                    }`}
                    style={
                      selected
                        ? {
                            borderColor: meta.color,
                            boxShadow: `0 14px 32px -18px ${meta.color}`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${meta.soft} pointer-events-none ${
                        selected ? "opacity-100" : "opacity-50"
                      }`}
                    />
                    <div className="relative flex h-full flex-col justify-between gap-3">
                      <span
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border"
                        style={{
                          backgroundColor: `${meta.color}22`,
                          borderColor: `${meta.color}55`,
                          color: meta.color,
                        }}
                      >
                        <Icon className="w-6 h-6" />
                      </span>
                      <div>
                        <p className="text-lg font-black leading-none">{t(meta.labelKey)}</p>
                        <p className="mt-1.5 text-xs font-bold text-muted-foreground">
                          {t(meta.hintKey)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-2.5 w-2.5 rounded-full ${
                          selected ? "opacity-100" : "opacity-40"
                        }`}
                        style={{ backgroundColor: meta.color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-extrabold mb-2.5">{t("common.branch")}</p>
            {activeBranches.length > 0 && activeBranches.length <= 6 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeBranches.map((b) => {
                  const selected = branchId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBranchId(b.id)}
                      className={`min-h-14 touch-manipulation rounded-2xl border-2 px-4 py-3 text-start transition-all active:scale-[0.98] ${
                        selected
                          ? "border-primary bg-primary/10 shadow-md shadow-primary/15"
                          : "border-border/60 bg-card/70 hover:border-primary/35"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                        </span>
                        <span className="font-extrabold text-sm sm:text-base truncate">
                          {b.name}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <ModernCombobox
                icon={Building2}
                value={branchId === "" ? "" : String(branchId)}
                onChange={(v) => setBranchId(v ? Number(v) : "")}
                options={branchOptions}
                placeholder={t("shifts.chooseBranch")}
                searchPlaceholder={t("branch.search")}
              />
            )}
            {openShiftForBranch ? (
              <div className="mt-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-3 text-sm font-bold text-amber-800 dark:text-amber-200">
                {t("shifts.errBranchAlreadyOpen", {
                  name: t(KIND_META[openShiftForBranch.kind].labelKey),
                })}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-extrabold mb-2.5">
              {t("shifts.openDate")}
            </label>
            <div className="rounded-2xl border border-border/60 bg-secondary/30 p-2">
              <YmdDateInput value={openDate} onChange={setOpenDate} />
            </div>
            <p className="text-xs text-muted-foreground mt-2 font-semibold">
              {t("shifts.openDateHint")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-extrabold mb-2.5">{t("common.notes")}</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("shifts.notesOptional")}
              className="h-14 rounded-2xl text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              variant="outline"
              className="h-14 rounded-2xl text-base font-extrabold touch-manipulation"
              onClick={() => setFormOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              isLoading={isCreating}
              disabled={Boolean(openShiftForBranch)}
              onClick={handleOpenShift}
              className="h-14 rounded-2xl text-base font-extrabold gap-2 touch-manipulation shadow-lg shadow-primary/20"
            >
              <Unlock className="w-5 h-5" />
              {t("shifts.openShift")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(closeTarget)}
        onClose={() => setCloseTarget(null)}
        title={t("shifts.closeTitle")}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("shifts.closeAsk", {
              name: closeTarget ? t(KIND_META[closeTarget.kind].labelKey) : "",
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-14 rounded-2xl text-base font-extrabold touch-manipulation"
              onClick={() => setCloseTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              isLoading={isClosing}
              onClick={confirmClose}
              className="h-14 rounded-2xl text-base font-extrabold gap-2 touch-manipulation"
            >
              <Lock className="w-5 h-5" />
              {t("shifts.close")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("shifts.deleteTitle")}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("shifts.deleteAskSimple", {
              name: deleteTarget ? t(KIND_META[deleteTarget.kind].labelKey) : "",
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-14 rounded-2xl text-base font-extrabold touch-manipulation"
              onClick={() => setDeleteTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              isLoading={isDeleting}
              onClick={confirmDelete}
              className="h-14 rounded-2xl text-base font-extrabold touch-manipulation"
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
