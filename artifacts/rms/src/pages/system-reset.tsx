import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSystemResetTables,
  useResetSystemTable,
  useResetAllSystemTables,
  type SystemResetGroup,
} from "@workspace/api-client-react";
import { Button, Input, Dialog, Card } from "@/components/ui-elements";
import { useI18n } from "@/i18n";
import { useAuth } from "@/App";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eraser,
  Loader2,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

const CONFIRM_WORD = "تصفير";

function apiErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object") {
    const anyErr = err as { message?: string; data?: { message?: string } };
    if (anyErr.data?.message) return String(anyErr.data.message);
    if (anyErr.message && !String(anyErr.message).startsWith("Request failed")) {
      return String(anyErr.message);
    }
  }
  return fallback;
}

function GroupIcon({ seedsAdmin }: { seedsAdmin: boolean }) {
  if (seedsAdmin) return <Shield className="w-5 h-5" />;
  return <Database className="w-5 h-5" />;
}

function ConfirmWordHint({ value, word }: { value: string; word: string }) {
  const typed = value.trim();
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5" dir="rtl">
      {word.split("").map((ch, i) => {
        const ok = typed.length > i && typed[i] === ch;
        const active = typed.length === i;
        return (
          <span
            key={`${ch}-${i}`}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl border text-[15px] font-black transition-all ${
              ok
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 scale-105"
                : active
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-300 ring-2 ring-rose-500/20"
                  : "border-border/70 bg-secondary/40 text-muted-foreground"
            }`}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}

function ResetConfirmShell({
  open,
  onClose,
  tone = "danger",
  icon,
  eyebrow,
  title,
  body,
  meta,
  confirmText,
  onConfirmText,
  confirmReady,
  busy,
  confirmLabel,
  onConfirm,
  cancelLabel,
}: {
  open: boolean;
  onClose: () => void;
  tone?: "danger" | "critical";
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  meta?: React.ReactNode;
  confirmText: string;
  onConfirmText: (v: string) => void;
  confirmReady: boolean;
  busy: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel: string;
}) {
  const ring =
    tone === "critical"
      ? "from-rose-600 via-orange-500 to-amber-400"
      : "from-rose-500 via-rose-400 to-amber-400";
  return (
    <Dialog isOpen={open} onClose={onClose} hideHeader maxWidth="max-w-md">
      <div className="relative overflow-hidden rounded-[1.35rem]">
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-24 start-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-gradient-to-b ${ring} opacity-25 blur-3xl`}
        />
        <div className="relative space-y-5 pt-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`relative shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                  tone === "critical"
                    ? "bg-gradient-to-br from-rose-600 to-orange-500 shadow-rose-500/30"
                    : "bg-gradient-to-br from-rose-500 to-rose-700 shadow-rose-500/25"
                }`}
              >
                {icon}
                <span className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                </span>
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-extrabold tracking-wide text-rose-600 dark:text-rose-300 uppercase">
                  {eyebrow}
                </p>
                <h2 className="text-xl font-black leading-tight mt-0.5">{title}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full min-h-11 min-w-11 p-2.5 hover:bg-secondary transition-colors touch-manipulation inline-flex items-center justify-center"
              aria-label={cancelLabel}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-l from-rose-500/10 via-card to-amber-500/5 px-4 py-3.5 space-y-2">
            {body}
            {meta}
          </div>

          <div className="space-y-2.5">
            <ConfirmWordHint value={confirmText} word={CONFIRM_WORD} />
            <Input
              className={`h-12 text-[16px] font-bold text-center tracking-wide transition-shadow ${
                confirmReady
                  ? "border-emerald-500/50 ring-4 ring-emerald-500/15"
                  : "focus-visible:ring-rose-500/15"
              }`}
              value={confirmText}
              onChange={(e) => onConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-full text-[15px] font-bold"
              onClick={onClose}
              disabled={busy}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className={`h-12 rounded-full text-[15px] font-extrabold shadow-lg ${
                confirmReady ? "shadow-rose-500/30" : "opacity-60"
              }`}
              disabled={!confirmReady || busy}
              onClick={onConfirm}
            >
              {busy ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export default function SystemResetPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useGetSystemResetTables({
    query: { staleTime: 5_000 },
  });
  const resetOne = useResetSystemTable();
  const resetAll = useResetAllSystemTables();

  const [confirmGroup, setConfirmGroup] = useState<SystemResetGroup | null>(null);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [banner, setBanner] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const showResult = (kind: "ok" | "err", text: string) => {
    setBanner({ kind, text });
    setResultOpen(true);
  };

  const groups = data?.groups ?? [];
  const totalRows = useMemo(
    () => groups.reduce((sum, g) => sum + (g.rowCount || 0), 0),
    [groups]
  );

  const confirmReady = confirmText.trim() === CONFIRM_WORD;
  const isAdmin = user?.role === "admin";

  const invalidateAll = () => {
    void queryClient.invalidateQueries();
    void refetch();
  };

  const closeConfirm = () => {
    setConfirmGroup(null);
    setConfirmAllOpen(false);
    setConfirmText("");
  };

  const runResetOne = () => {
    if (!confirmGroup || !confirmReady) return;
    const key = confirmGroup.key;
    setBusyKey(key);
    setBanner(null);
    resetOne.mutate(key, {
      onSuccess: (res) => {
        showResult(
          "ok",
          res.message +
            (res.adminSeeded
              ? ` — تم إنشاء المدير ${res.admin?.name || "Aisar"}`
              : "")
        );
        closeConfirm();
        invalidateAll();
      },
      onError: (e) => {
        showResult("err", apiErrorMessage(e, t("reset.failOne")));
        closeConfirm();
      },
      onSettled: () => setBusyKey(null),
    });
  };

  const runResetAll = () => {
    if (!confirmReady) return;
    setBusyKey("__all__");
    setBanner(null);
    resetAll.mutate(undefined, {
      onSuccess: (res) => {
        showResult(
          "ok",
          res.message +
            (res.adminSeeded ? ` — المدير: ${res.admin?.name || "Aisar"}` : "")
        );
        closeConfirm();
        invalidateAll();
      },
      onError: (e) => {
        showResult("err", apiErrorMessage(e, t("reset.failAll")));
        closeConfirm();
      },
      onSettled: () => setBusyKey(null),
    });
  };

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-extrabold">{t("reset.adminOnlyTitle")}</h1>
        <p className="text-muted-foreground font-semibold">
          {t("reset.adminOnlyBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-6rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-24 -start-16 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute top-40 -end-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background via-background to-secondary/30" />
      </div>

      <div className="max-w-6xl mx-auto space-y-6 pb-10">
        <header className="rounded-[1.75rem] border border-rose-500/25 bg-gradient-to-l from-rose-500/10 via-card/90 to-card px-5 py-6 sm:px-8 sm:py-7 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div className="space-y-2 min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[12px] font-extrabold text-rose-600 dark:text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t("reset.dangerZone")}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {t("reset.title")}
              </h1>
              <p className="text-sm sm:text-[15px] font-semibold text-muted-foreground max-w-2xl leading-relaxed">
                {t("reset.subtitle")}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/70 px-3 py-1.5 text-[13px] font-bold">
                  <Database className="w-3.5 h-3.5 text-muted-foreground" />
                  {t("reset.groupsCount", { n: groups.length })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/70 px-3 py-1.5 text-[13px] font-bold tabular-nums">
                  <Eraser className="w-3.5 h-3.5 text-muted-foreground" />
                  {t("reset.rowsCount", { n: totalRows })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t("reset.adminSeedHint", {
                    name: data?.adminSeed?.name || "Aisar",
                  })}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-full px-5 text-[15px] font-bold touch-manipulation"
                disabled={isFetching || busyKey != null}
                onClick={() => void refetch()}
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 me-1.5" />
                )}
                {t("reset.refresh")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-12 rounded-full px-6 text-[15px] font-extrabold touch-manipulation shadow-lg shadow-rose-500/20"
                disabled={busyKey != null || groups.length === 0}
                onClick={() => {
                  setConfirmText("");
                  setConfirmAllOpen(true);
                }}
              >
                <ShieldAlert className="w-4 h-4 me-1.5" />
                {t("reset.resetAll")}
              </Button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {groups.map((g) => {
              const busy = busyKey === g.key;
              return (
                <Card
                  key={g.key}
                  className="relative overflow-hidden border border-border/60 bg-card/90 backdrop-blur-sm p-4 sm:p-5 space-y-3.5 transition-shadow hover:shadow-md"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-rose-500/50 via-amber-400/40 to-transparent" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border ${
                          g.seedsAdmin
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                            : "border-border/70 bg-secondary/60 text-foreground"
                        }`}
                      >
                        <GroupIcon seedsAdmin={g.seedsAdmin} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[16px] font-extrabold leading-tight truncate">
                          {g.labelAr}
                        </h2>
                        <p className="text-[12px] font-semibold text-muted-foreground mt-1 leading-relaxed">
                          {g.descriptionAr}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-extrabold tabular-nums border ${
                        g.rowCount > 0
                          ? "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "border-border/60 bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      {g.rowCount}
                    </span>
                  </div>

                  {g.seedsAdmin ? (
                    <p className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2">
                      {t("reset.employeesSeedNote")}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 rounded-full text-[14px] font-extrabold touch-manipulation border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-500 hover:text-white hover:border-rose-500"
                    disabled={busyKey != null}
                    onClick={() => {
                      setConfirmText("");
                      setConfirmGroup(g);
                    }}
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                    ) : (
                      <Eraser className="w-4 h-4 me-1.5" />
                    )}
                    {t("reset.resetTable")}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ResetConfirmShell
        open={confirmGroup != null}
        onClose={closeConfirm}
        tone="danger"
        icon={<Eraser className="w-7 h-7" />}
        eyebrow={t("reset.dangerZone")}
        title={t("reset.confirmTitle")}
        body={
          <>
            <p className="text-[16px] font-extrabold text-rose-700 dark:text-rose-300">
              {confirmGroup?.labelAr}
            </p>
            <p className="text-[13px] font-semibold text-muted-foreground leading-relaxed">
              {confirmGroup?.descriptionAr}
            </p>
            <p className="text-[13px] font-bold text-foreground/90">
              {t("reset.confirmOneWarn")}
            </p>
          </>
        }
        meta={
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[12px] font-extrabold tabular-nums">
              <Database className="w-3.5 h-3.5 text-muted-foreground" />
              {t("reset.rowsCount", { n: confirmGroup?.rowCount ?? 0 })}
            </span>
            {confirmGroup?.seedsAdmin ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[12px] font-extrabold text-emerald-700 dark:text-emerald-300">
                <Sparkles className="w-3.5 h-3.5" />
                {t("reset.employeesSeedNoteShort")}
              </span>
            ) : null}
          </div>
        }
        confirmText={confirmText}
        onConfirmText={setConfirmText}
        confirmReady={confirmReady}
        busy={busyKey != null}
        confirmLabel={t("reset.confirmAction")}
        onConfirm={runResetOne}
        cancelLabel={t("common.cancel")}
      />

      <ResetConfirmShell
        open={confirmAllOpen}
        onClose={closeConfirm}
        tone="critical"
        icon={<ShieldAlert className="w-7 h-7" />}
        eyebrow={t("reset.dangerZone")}
        title={t("reset.confirmAllTitle")}
        body={
          <>
            <p className="text-[16px] font-extrabold text-rose-700 dark:text-rose-300">
              {t("reset.confirmAllWarn")}
            </p>
            <p className="text-[13px] font-semibold text-muted-foreground leading-relaxed">
              {t("reset.confirmAllBody")}
            </p>
          </>
        }
        meta={
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[12px] font-extrabold">
              <Database className="w-3.5 h-3.5 text-muted-foreground" />
              {t("reset.groupsCount", { n: groups.length })}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[12px] font-extrabold tabular-nums text-amber-700 dark:text-amber-300">
              <Eraser className="w-3.5 h-3.5" />
              {t("reset.rowsCount", { n: totalRows })}
            </span>
          </div>
        }
        confirmText={confirmText}
        onConfirmText={setConfirmText}
        confirmReady={confirmReady}
        busy={busyKey != null}
        confirmLabel={t("reset.confirmAllAction")}
        onConfirm={runResetAll}
        cancelLabel={t("common.cancel")}
      />

      <Dialog
        isOpen={resultOpen && Boolean(banner)}
        onClose={() => setResultOpen(false)}
        hideHeader
        maxWidth="max-w-sm"
      >
        <div className="text-center space-y-4 py-2">
          <div
            className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${
              banner?.kind === "ok"
                ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                : "bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-500/30"
            }`}
          >
            {banner?.kind === "ok" ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : (
              <AlertTriangle className="w-8 h-8" />
            )}
          </div>
          <div className="space-y-1.5 px-1">
            <h2 className="text-xl font-black">
              {banner?.kind === "ok" ? t("reset.resultOkTitle") : t("reset.resultErrTitle")}
            </h2>
            <p className="text-[14px] font-semibold text-muted-foreground leading-relaxed">
              {banner?.text}
            </p>
          </div>
          <Button
            type="button"
            className="w-full h-12 rounded-full text-[15px] font-extrabold"
            variant={banner?.kind === "ok" ? "default" : "destructive"}
            onClick={() => setResultOpen(false)}
          >
            {t("common.close")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
