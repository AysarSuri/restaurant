import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetShifts,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  useGetBranches,
  useGetEmployees,
  getGetShiftsQueryKey,
  type Shift,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Dialog } from "@/components/ui-elements";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Clock3,
  Building2,
  Users,
  MoonStar,
  SunMedium,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Check,
  Timer,
  Coffee,
  Shield,
  Palette,
  CalendarDays,
  Hash,
  StickyNote,
} from "lucide-react";

const COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const EMPTY_FORM = {
  name: "",
  nameAr: "",
  code: "",
  branchId: "" as number | "",
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: "30",
  graceMinutes: "10",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6] as number[],
  color: "#0ea5e9",
  supervisorEmployeeId: "" as number | "",
  notes: "",
  isActive: true,
  employeeIds: [] as number[],
};

type FormData = typeof EMPTY_FORM;
type FormErrors = Partial<
  Record<"name" | "branchId" | "startTime" | "endTime" | "breakMinutes" | "days", string>
>;

function formatDuration(mins: number, t: (k: string, p?: Record<string, string | number>) => string) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return t("shifts.durationHm", { h, m });
  if (h > 0) return t("shifts.durationH", { h });
  return t("shifts.durationM", { m });
}

function durationPreview(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return 0;
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM <= startM) endM += 24 * 60;
  return endM - startM;
}

export default function ShiftsPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const { data: shifts, isLoading } = useGetShifts();
  const { data: branches } = useGetBranches();
  const { data: employees } = useGetEmployees();
  const { mutate: createShift, isPending: isCreating } = useCreateShift();
  const { mutate: updateShift, isPending: isUpdating } = useUpdateShift();
  const { mutate: deleteShift, isPending: isDeleting } = useDeleteShift();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [editTarget, setEditTarget] = useState<Shift | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");

  const dayLabels = useMemo(
    () => [
      t("shifts.day.sun"),
      t("shifts.day.mon"),
      t("shifts.day.tue"),
      t("shifts.day.wed"),
      t("shifts.day.thu"),
      t("shifts.day.fri"),
      t("shifts.day.sat"),
    ],
    [t, locale]
  );

  const activeBranches = useMemo(
    () => (branches ?? []).filter((b) => b.isActive !== false),
    [branches]
  );

  const activeEmployees = useMemo(
    () => (employees ?? []).filter((e) => e.isActive !== false),
    [employees]
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
        (s.nameAr ?? "").toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.branchName ?? "").toLowerCase().includes(q) ||
        (s.employeeNames ?? []).some((n) => n.toLowerCase().includes(q))
    );
  }, [shifts, selectedBranchId, search]);

  const stats = useMemo(() => {
    const list =
      selectedBranchId === "all"
        ? shifts ?? []
        : (shifts ?? []).filter((s) => s.branchId === selectedBranchId);
    return {
      total: list.length,
      active: list.filter((s) => s.isActive).length,
      overnight: list.filter((s) => s.isOvernight).length,
      staff: new Set(list.flatMap((s) => s.employeeIds ?? [])).size,
    };
  }, [shifts, selectedBranchId]);

  const previewDuration = durationPreview(form.startTime, form.endTime);
  const previewBreak = Math.max(0, Number(form.breakMinutes) || 0);
  const previewWork = Math.max(0, previewDuration - previewBreak);

  const openAdd = () => {
    const defaultBranch =
      selectedBranchId !== "all"
        ? selectedBranchId
        : activeBranches.length === 1
          ? activeBranches[0].id
          : "";
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, branchId: defaultBranch });
    setErrors({});
    setSubmitError("");
    setFormOpen(true);
  };

  const openEdit = (shift: Shift) => {
    setEditTarget(shift);
    setForm({
      name: shift.name,
      nameAr: shift.nameAr ?? "",
      code: shift.code ?? "",
      branchId: shift.branchId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: String(shift.breakMinutes ?? 0),
      graceMinutes: String(shift.graceMinutes ?? 0),
      daysOfWeek: [...(shift.daysOfWeek ?? WEEK_DAYS)],
      color: shift.color || "#0ea5e9",
      supervisorEmployeeId: shift.supervisorEmployeeId ?? "",
      notes: shift.notes ?? "",
      isActive: shift.isActive !== false,
      employeeIds: [...(shift.employeeIds ?? [])],
    });
    setErrors({});
    setSubmitError("");
    setFormOpen(true);
  };

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = t("shifts.errName");
    if (form.branchId === "" || !Number(form.branchId)) e.branchId = t("shifts.errBranch");
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.startTime)) e.startTime = t("shifts.errTime");
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.endTime)) e.endTime = t("shifts.errTime");
    if (form.startTime === form.endTime) e.endTime = t("shifts.errSameTime");
    if (form.daysOfWeek.length === 0) e.days = t("shifts.errDays");
    if (previewBreak >= previewDuration && previewDuration > 0) {
      e.breakMinutes = t("shifts.errBreak");
    }
    return e;
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    nameAr: form.nameAr.trim() || undefined,
    code: form.code.trim() || undefined,
    branchId: Number(form.branchId),
    startTime: form.startTime,
    endTime: form.endTime,
    breakMinutes: Math.max(0, Number(form.breakMinutes) || 0),
    graceMinutes: Math.max(0, Number(form.graceMinutes) || 0),
    daysOfWeek: [...form.daysOfWeek].sort((a, b) => a - b),
    color: form.color,
    supervisorEmployeeId:
      form.supervisorEmployeeId === "" ? null : Number(form.supervisorEmployeeId),
    notes: form.notes.trim() || undefined,
    isActive: form.isActive,
    employeeIds: form.employeeIds,
  });

  const handleSubmit = () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setSubmitError("");
    const payload = buildPayload();

    if (editTarget) {
      updateShift(
        { id: editTarget.id, data: payload },
        {
          onSuccess: (updated) => {
            syncShifts(
              (shifts ?? []).map((s) => (s.id === updated.id ? updated : s))
            );
            setFormOpen(false);
          },
          onError: (err: any) => {
            setSubmitError(
              err?.data?.message || err?.message || t("shifts.saveFailed")
            );
          },
        }
      );
      return;
    }

    createShift(
      { data: payload },
      {
        onSuccess: (created) => {
          syncShifts([created, ...(shifts ?? [])]);
          setFormOpen(false);
        },
        onError: (err: any) => {
          setSubmitError(
            err?.data?.message || err?.message || t("shifts.saveFailed")
          );
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

  const toggleDay = (day: number) => {
    setForm((prev) => {
      const has = prev.daysOfWeek.includes(day);
      return {
        ...prev,
        daysOfWeek: has
          ? prev.daysOfWeek.filter((d) => d !== day)
          : [...prev.daysOfWeek, day].sort((a, b) => a - b),
      };
    });
  };

  const toggleEmployee = (id: number) => {
    setForm((prev) => ({
      ...prev,
      employeeIds: prev.employeeIds.includes(id)
        ? prev.employeeIds.filter((x) => x !== id)
        : [...prev.employeeIds, id],
    }));
  };

  const displayName = (s: Shift) =>
    locale === "en" ? s.name : s.nameAr?.trim() || s.name;

  return (
    <div className="space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-l from-sky-500/15 via-card to-card p-5 sm:p-7">
        <div className="absolute -top-16 -start-10 h-44 w-44 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -end-8 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
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
              {t("shifts.subtitle")}
            </p>
          </div>
          <Button className="h-12 px-5 gap-2 shadow-lg shadow-sky-500/20" onClick={openAdd}>
            <Plus className="w-5 h-5" />
            {t("shifts.add")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: t("shifts.statTotal"), value: stats.total, icon: CalendarDays, tone: "text-sky-600" },
          { label: t("shifts.statActive"), value: stats.active, icon: SunMedium, tone: "text-emerald-600" },
          { label: t("shifts.statOvernight"), value: stats.overnight, icon: MoonStar, tone: "text-violet-600" },
          { label: t("shifts.statStaff"), value: stats.staff, icon: Users, tone: "text-amber-600" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3.5 flex items-center gap-3"
          >
            <span className={`h-10 w-10 rounded-xl bg-secondary/80 flex items-center justify-center ${card.tone}`}>
              <card.icon className="w-5 h-5" />
            </span>
            <div>
              <p className="text-[11px] text-muted-foreground font-bold">{card.label}</p>
              <p className="text-xl font-display font-extrabold tabular-nums">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("shifts.search")}
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
          <p className="text-sm text-muted-foreground mt-1">{t("shifts.emptyHint")}</p>
          <Button className="mt-5 gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            {t("shifts.add")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((shift) => (
            <article
              key={shift.id}
              className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)]"
            >
              <div
                className="absolute inset-y-0 start-0 w-1.5"
                style={{ backgroundColor: shift.color || "#0ea5e9" }}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-extrabold truncate">{displayName(shift)}</h2>
                    {shift.code ? (
                      <Badge className="font-display text-[10px]">{shift.code}</Badge>
                    ) : null}
                    <Badge
                      className={
                        shift.isActive
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "bg-secondary text-muted-foreground"
                      }
                    >
                      {shift.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                    {shift.isOvernight ? (
                      <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30 gap-1">
                        <MoonStar className="w-3 h-3" />
                        {t("shifts.overnight")}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {shift.branchName}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(shift)}
                    className="h-10 w-10 rounded-xl border border-border/60 hover:bg-secondary flex items-center justify-center"
                    aria-label={t("common.edit")}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(shift)}
                    className="h-10 w-10 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 flex items-center justify-center"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-2xl bg-secondary/50 border border-border/50 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    {t("shifts.hours")}
                  </p>
                  <p className="font-display font-extrabold tabular-nums mt-0.5" dir="ltr">
                    {shift.startTime} – {shift.endTime}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/50 border border-border/50 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground">{t("shifts.duration")}</p>
                  <p className="font-extrabold mt-0.5">
                    {formatDuration(shift.durationMinutes, t)}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/50 border border-border/50 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Coffee className="w-3 h-3" />
                    {t("shifts.break")}
                  </p>
                  <p className="font-extrabold mt-0.5">
                    {formatDuration(shift.breakMinutes, t)}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/50 border border-border/50 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground">{t("shifts.workTime")}</p>
                  <p className="font-extrabold mt-0.5">
                    {formatDuration(shift.workMinutes, t)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(shift.daysOfWeek ?? []).map((d) => (
                  <span
                    key={d}
                    className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-border/60 bg-background/70 px-1.5 text-[11px] font-bold"
                  >
                    {dayLabels[d]}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {shift.supervisorName ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1">
                    <Shield className="w-3 h-3 text-sky-600" />
                    {t("shifts.supervisor")}: {shift.supervisorName}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1">
                  <Users className="w-3 h-3" />
                  {t("shifts.staffCount", { n: shift.employeeIds?.length ?? 0 })}
                </span>
                {(shift.employeeNames ?? []).slice(0, 4).map((name) => (
                  <span
                    key={name}
                    className="inline-flex rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2.5 py-1 font-semibold"
                  >
                    {name}
                  </span>
                ))}
                {(shift.employeeNames?.length ?? 0) > 4 ? (
                  <span className="font-bold">
                    +{(shift.employeeNames?.length ?? 0) - 4}
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog
        isOpen={formOpen}
        onClose={() => !isCreating && !isUpdating && setFormOpen(false)}
        title={editTarget ? t("shifts.editNamed", { name: editTarget.name }) : t("shifts.add")}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5 max-h-[min(72vh,720px)] overflow-y-auto pe-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                {t("shifts.name")} *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={t("shifts.namePh")}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name ? <p className="text-xs text-destructive mt-1">{errors.name}</p> : null}
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                {t("shifts.nameAr")}
              </label>
              <Input
                value={form.nameAr}
                onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder={t("shifts.nameArPh")}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {t("shifts.code")}
              </label>
              <Input
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder={t("shifts.codePh")}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                {t("shifts.branch")} *
              </label>
              <select
                value={form.branchId === "" ? "" : String(form.branchId)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    branchId: e.target.value ? Number(e.target.value) : "",
                  }))
                }
                className={`w-full h-11 rounded-xl border bg-background px-3 text-sm font-semibold ${
                  errors.branchId ? "border-destructive" : "border-border"
                }`}
              >
                <option value="">{t("shifts.chooseBranch")}</option>
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {errors.branchId ? (
                <p className="text-xs text-destructive mt-1">{errors.branchId}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                {t("shifts.start")} *
              </label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                className={errors.startTime ? "border-destructive" : ""}
                dir="ltr"
              />
              {errors.startTime ? (
                <p className="text-xs text-destructive mt-1">{errors.startTime}</p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                {t("shifts.end")} *
              </label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                className={errors.endTime ? "border-destructive" : ""}
                dir="ltr"
              />
              {errors.endTime ? (
                <p className="text-xs text-destructive mt-1">{errors.endTime}</p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                {t("shifts.breakMins")}
              </label>
              <Input
                type="number"
                min={0}
                value={form.breakMinutes}
                onChange={(e) => setForm((p) => ({ ...p, breakMinutes: e.target.value }))}
                className={errors.breakMinutes ? "border-destructive" : ""}
              />
              {errors.breakMinutes ? (
                <p className="text-xs text-destructive mt-1">{errors.breakMinutes}</p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                {t("shifts.graceMins")}
              </label>
              <Input
                type="number"
                min={0}
                value={form.graceMinutes}
                onChange={(e) => setForm((p) => ({ ...p, graceMinutes: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 flex flex-wrap gap-3 text-sm">
            <span className="font-bold text-sky-800 dark:text-sky-200">
              {t("shifts.previewDuration")}: {formatDuration(previewDuration, t)}
            </span>
            <span className="text-muted-foreground">
              {t("shifts.workTime")}: {formatDuration(previewWork, t)}
            </span>
            {form.endTime <= form.startTime && form.startTime !== form.endTime ? (
              <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300 font-bold">
                <MoonStar className="w-3.5 h-3.5" />
                {t("shifts.overnight")}
              </span>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-2 block">
              {t("shifts.days")} *
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map((day) => {
                const on = form.daysOfWeek.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`h-10 min-w-12 rounded-xl border px-3 text-sm font-extrabold transition-colors ${
                      on
                        ? "border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-300"
                        : "border-border/60 text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {dayLabels[day]}
                  </button>
                );
              })}
            </div>
            {errors.days ? <p className="text-xs text-destructive mt-1">{errors.days}</p> : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {t("shifts.supervisor")}
              </label>
              <select
                value={
                  form.supervisorEmployeeId === ""
                    ? ""
                    : String(form.supervisorEmployeeId)
                }
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    supervisorEmployeeId: e.target.value
                      ? Number(e.target.value)
                      : "",
                  }))
                }
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
              >
                <option value="">{t("shifts.noSupervisor")}</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Palette className="w-3 h-3" />
                {t("shifts.color")}
              </label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, color: c }))}
                    className={`h-9 w-9 rounded-xl border-2 transition-transform ${
                      form.color === c ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-2 block">
              {t("shifts.staff")}
            </label>
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("shifts.noEmployees")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto rounded-2xl border border-border/60 p-2">
                {activeEmployees.map((emp) => {
                  const on = form.employeeIds.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleEmployee(emp.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start transition-colors ${
                        on
                          ? "border-sky-500/45 bg-sky-500/10"
                          : "border-border/50 hover:bg-secondary/60"
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-md border flex items-center justify-center ${
                          on
                            ? "bg-sky-500 border-sky-500 text-white"
                            : "border-border"
                        }`}
                      >
                        {on ? <Check className="w-3.5 h-3.5" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold truncate">{emp.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{emp.role}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block flex items-center gap-1">
              <StickyNote className="w-3 h-3" />
              {t("shifts.notes")}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              placeholder={t("shifts.notesPh")}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm resize-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
            className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
              form.isActive
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-border/60 bg-secondary/40"
            }`}
          >
            <div className="text-start">
              <p className="font-extrabold text-sm">{t("shifts.status")}</p>
              <p className="text-xs text-muted-foreground">
                {form.isActive ? t("shifts.activeHint") : t("shifts.inactiveHint")}
              </p>
            </div>
            {form.isActive ? (
              <ToggleRight className="w-8 h-8 text-emerald-600" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-muted-foreground" />
            )}
          </button>

          {submitError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive font-semibold">
              {submitError}
            </div>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setFormOpen(false)}
              disabled={isCreating || isUpdating}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="flex-1 h-12 gap-2"
              onClick={handleSubmit}
              isLoading={isCreating || isUpdating}
            >
              <Check className="w-4 h-4" />
              {editTarget ? t("common.save") : t("shifts.create")}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title={t("shifts.deleteTitle")}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{t("shifts.deleteAsk")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("shifts.deleteHint", { name: deleteTarget?.name ?? "" })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="flex-1 bg-rose-600 hover:bg-rose-500"
              onClick={confirmDelete}
              isLoading={isDeleting}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
