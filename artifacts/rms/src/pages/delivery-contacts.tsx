import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDeliveryContacts,
  useUpsertDeliveryContact,
  useUpdateDeliveryContact,
  useDeleteDeliveryContact,
  getGetDeliveryContactsQueryKey,
  type DeliveryContact,
} from "@workspace/api-client-react";
import { Button, Dialog } from "@/components/ui-elements";
import { BranchSwitcher } from "@/components/branch-switcher";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";
import {
  Plus,
  Phone,
  Search,
  AlertTriangle,
  Trash2,
  Save,
  X,
  LocateFixed,
  Copy,
  ExternalLink,
  RefreshCw,
  Check,
  FileSpreadsheet,
} from "lucide-react";

type SheetRow = {
  phone: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  gpsLabel: string;
  note: string;
};

const EMPTY_ROW = (): SheetRow => ({
  phone: "",
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  gpsLabel: "",
  note: "",
});

function parsePastedGps(text: string): { lat?: string; lng?: string; label?: string } {
  const raw = text.trim();
  if (!raw) return {};
  const at = raw.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (at) return { lat: at[1], lng: at[2], label: raw };
  const q = raw.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (q) return { lat: q[1], lng: q[2], label: raw };
  const pair = raw.match(/(-?\d+\.?\d*)\s*[,،]\s*(-?\d+\.?\d*)/);
  if (pair) return { lat: pair[1], lng: pair[2], label: raw };
  return { label: raw };
}

function contactToRow(c: DeliveryContact): SheetRow {
  return {
    phone: c.phone ?? "",
    name: c.name ?? "",
    address: c.address ?? "",
    latitude: c.latitude != null ? String(c.latitude) : "",
    longitude: c.longitude != null ? String(c.longitude) : "",
    gpsLabel: c.gpsLabel ?? "",
    note: c.note ?? "",
  };
}

function SheetInput({
  value,
  onChange,
  placeholder,
  dir,
  className = "",
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      dir={dir}
      className={`w-full h-9 bg-transparent px-2 text-[13px] font-semibold outline-none focus:bg-sky-500/10 focus:ring-1 focus:ring-sky-500/40 rounded-sm ${className}`}
    />
  );
}

export default function DeliveryContactsPage() {
  const { t } = useI18n();
  const { selectedBranchId, branchLabel } = useBranch();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: contacts, isLoading, isFetching, refetch } = useGetDeliveryContacts({
    search: search.trim() || undefined,
    query: {
      queryKey: [...getGetDeliveryContactsQueryKey(), search.trim(), selectedBranchId],
      staleTime: 800,
    },
  });
  const { mutate: upsert, isPending: upserting } = useUpsertDeliveryContact();
  const { mutate: update, isPending: updating } = useUpdateDeliveryContact();
  const { mutate: remove, isPending: deleting } = useDeleteDeliveryContact();

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<SheetRow>(EMPTY_ROW());
  const [error, setError] = useState("");
  const [gpsMsg, setGpsMsg] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryContact | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);

  const list = contacts ?? [];
  const withGps = useMemo(
    () => list.filter((c) => c.latitude != null && c.longitude != null).length,
    [list]
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetDeliveryContactsQueryKey() });
  };

  const startEdit = (row: DeliveryContact) => {
    setEditingId(row.id);
    setDraft(contactToRow(row));
    setError("");
    setGpsMsg("");
  };

  const startNew = () => {
    setEditingId("new");
    setDraft(EMPTY_ROW());
    setError("");
    setGpsMsg("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(EMPTY_ROW());
    setError("");
    setGpsMsg("");
  };

  useEffect(() => {
    cancelEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  const patchDraft = (patch: Partial<SheetRow>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const captureCurrentLocation = () => {
    setGpsMsg("");
    if (!navigator.geolocation) {
      setGpsMsg("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(7);
        const lng = pos.coords.longitude.toFixed(7);
        patchDraft({
          latitude: lat,
          longitude: lng,
          gpsLabel: draft.gpsLabel || `https://maps.google.com/?q=${lat},${lng}`,
        });
        setGpsMsg("تم التقاط الموقع");
        setGpsBusy(false);
      },
      (err) => {
        setGpsMsg(err.message || "تعذر الحصول على الموقع");
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const pasteGpsFromClipboard = async () => {
    setGpsMsg("");
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parsePastedGps(text);
      if (!parsed.lat && !parsed.lng && !parsed.label) {
        setGpsMsg("لا إحداثيات في الحافظة");
        return;
      }
      patchDraft({
        latitude: parsed.lat ?? draft.latitude,
        longitude: parsed.lng ?? draft.longitude,
        gpsLabel: parsed.label ?? draft.gpsLabel,
      });
      setGpsMsg("تم اللصق من الحافظة");
    } catch {
      setGpsMsg("تعذر قراءة الحافظة");
    }
  };

  const buildPayload = () => {
    const phone = draft.phone.trim();
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      setError("أدخل رقم هاتف صالح");
      return null;
    }
    return {
      phone,
      address: draft.address.trim(),
      name: draft.name.trim() || undefined,
      latitude: draft.latitude.trim() ? Number(draft.latitude) : null,
      longitude: draft.longitude.trim() ? Number(draft.longitude) : null,
      gpsLabel: draft.gpsLabel.trim() || undefined,
      note: draft.note.trim() || undefined,
      branchId: selectedBranchId === "all" ? undefined : selectedBranchId,
    };
  };

  const saveDraft = () => {
    setError("");
    const payload = buildPayload();
    if (!payload) return;

    if (editingId === "new") {
      upsert(
        { data: payload },
        {
          onSuccess: (row) => {
            cancelEdit();
            invalidate();
            setFlashId(row.id);
            window.setTimeout(() => setFlashId(null), 1600);
          },
          onError: (err: any) =>
            setError(err?.data?.message || err?.message || "تعذر الحفظ"),
        }
      );
      return;
    }

    if (typeof editingId === "number") {
      update(
        { id: editingId, data: payload },
        {
          onSuccess: (row) => {
            cancelEdit();
            invalidate();
            setFlashId(row.id);
            window.setTimeout(() => setFlashId(null), 1600);
          },
          onError: (err: any) =>
            setError(err?.data?.message || err?.message || "تعذر الحفظ"),
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    remove(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          if (editingId === deleteTarget.id) cancelEdit();
          setDeleteTarget(null);
          invalidate();
        },
      }
    );
  };

  const saving = upserting || updating;
  const colCount = 9;

  const renderEditCells = (onEnterSave: boolean) => (
    <>
      <td className="sheet-cell min-w-[8.5rem]">
        <SheetInput
          value={draft.phone}
          onChange={(v) => patchDraft({ phone: v })}
          placeholder="07XXXXXXXXX"
          dir="ltr"
          onKeyDown={(e) => {
            if (onEnterSave && e.key === "Enter") saveDraft();
          }}
        />
      </td>
      <td className="sheet-cell min-w-[7rem]">
        <SheetInput
          value={draft.name}
          onChange={(v) => patchDraft({ name: v })}
          placeholder="الاسم"
        />
      </td>
      <td className="sheet-cell min-w-[12rem]">
        <SheetInput
          value={draft.address}
          onChange={(v) => patchDraft({ address: v })}
          placeholder="العنوان"
        />
      </td>
      <td className="sheet-cell min-w-[6.5rem]">
        <SheetInput
          value={draft.latitude}
          onChange={(v) => patchDraft({ latitude: v })}
          placeholder="Lat"
          dir="ltr"
        />
      </td>
      <td className="sheet-cell min-w-[6.5rem]">
        <SheetInput
          value={draft.longitude}
          onChange={(v) => patchDraft({ longitude: v })}
          placeholder="Lng"
          dir="ltr"
        />
      </td>
      <td className="sheet-cell min-w-[10rem]">
        <div className="flex items-center gap-1">
          <SheetInput
            value={draft.gpsLabel}
            onChange={(v) => {
              const parsed = parsePastedGps(v);
              patchDraft({
                gpsLabel: v,
                latitude: parsed.lat ?? draft.latitude,
                longitude: parsed.lng ?? draft.longitude,
              });
            }}
            placeholder="رابط / GPS"
            dir="ltr"
            className="flex-1"
          />
          <button
            type="button"
            title="الموقع الحالي"
            className="shrink-0 p-1.5 rounded-md hover:bg-sky-500/15 text-sky-700 dark:text-sky-300"
            onClick={captureCurrentLocation}
            disabled={gpsBusy}
          >
            <LocateFixed className={`w-3.5 h-3.5 ${gpsBusy ? "animate-pulse" : ""}`} />
          </button>
          <button
            type="button"
            title="لصق"
            className="shrink-0 p-1.5 rounded-md hover:bg-sky-500/15 text-sky-700 dark:text-sky-300"
            onClick={() => void pasteGpsFromClipboard()}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="sheet-cell min-w-[8rem]">
        <SheetInput
          value={draft.note}
          onChange={(v) => patchDraft({ note: v })}
          placeholder="ملاحظة"
        />
      </td>
      <td className="sheet-cell w-[7.5rem]">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-extrabold hover:bg-emerald-500 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            حفظ
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 hover:bg-secondary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </>
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-3 sm:p-5 md:p-6 gap-4">
      <style>{`
        .sheet-wrap {
          --sheet-line: color-mix(in oklab, var(--border) 85%, transparent);
          --sheet-head: color-mix(in oklab, #0f172a 92%, #0369a1);
        }
        .sheet-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 980px;
        }
        .sheet-table th,
        .sheet-table td.sheet-cell,
        .sheet-table td.sheet-read {
          border: 1px solid var(--sheet-line);
          vertical-align: middle;
        }
        .sheet-table th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--sheet-head);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          text-align: center;
          padding: 10px 8px;
          white-space: nowrap;
        }
        .sheet-table td.sheet-read {
          padding: 8px 10px;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
          background: color-mix(in oklab, var(--card) 92%, transparent);
        }
        .sheet-table tbody tr:nth-child(even) td.sheet-read {
          background: color-mix(in oklab, var(--secondary) 55%, var(--card));
        }
        .sheet-table tbody tr.sheet-edit td.sheet-cell {
          background: color-mix(in oklab, #0ea5e9 8%, var(--card));
        }
        .sheet-table tbody tr.sheet-flash td.sheet-read {
          animation: sheetFlash 1.4s ease;
        }
        @keyframes sheetFlash {
          0% { background: color-mix(in oklab, #10b981 28%, var(--card)); }
          100% { background: transparent; }
        }
      `}</style>

      <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-[11px] font-extrabold text-sky-800 dark:text-sky-200 mb-2">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Delivery Sheet
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {t("delivery.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 font-semibold">
            جدول احترافي كالورقة الحسابية · {branchLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BranchSwitcher />
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-4 font-bold gap-2"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full px-5 font-extrabold gap-2 shadow-md shadow-sky-500/20 bg-sky-600 hover:bg-sky-500"
            onClick={startNew}
            disabled={editingId === "new"}
          >
            <Plus className="w-4 h-4" />
            صف جديد
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
        <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
          <p className="text-[11px] font-bold text-muted-foreground">الأرقام</p>
          <p className="text-xl font-extrabold tabular-nums mt-0.5">{list.length}</p>
        </div>
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3">
          <p className="text-[11px] font-bold text-sky-800/80 dark:text-sky-200/80">مع GPS</p>
          <p className="text-xl font-extrabold tabular-nums mt-0.5 text-sky-700 dark:text-sky-300">
            {withGps}
          </p>
        </div>
        <div className="col-span-2 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("delivery.search")}
            className="w-full h-full min-h-[3.25rem] rounded-2xl border border-border/60 bg-card/80 pr-10 pl-4 text-sm font-semibold outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/15"
          />
        </div>
      </div>

      {(error || gpsMsg) && editingId != null ? (
        <div
          className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 ${
            error
              ? "border border-destructive/30 bg-destructive/10 text-destructive"
              : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {error ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {error || gpsMsg}
        </div>
      ) : null}

      <div className="sheet-wrap flex-1 min-h-0 rounded-2xl border border-border/70 bg-card/90 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          {isLoading && !contacts ? (
            <div className="py-20 text-center text-muted-foreground font-semibold">
              <RefreshCw className="w-7 h-7 mx-auto mb-3 animate-spin opacity-60" />
              جاري التحميل...
            </div>
          ) : (
            <table className="sheet-table">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> الهاتف
                    </span>
                  </th>
                  <th>الاسم</th>
                  <th>العنوان</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>GPS / رابط</th>
                  <th>ملاحظة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && editingId !== "new" ? (
                  <tr>
                    <td
                      colSpan={colCount}
                      className="sheet-read py-16 text-muted-foreground font-semibold"
                    >
                      <Phone className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      لا توجد أرقام بعد — اضغط «صف جديد» أو أنشئ طلباً من نقطة البيع
                    </td>
                  </tr>
                ) : null}

                {list.map((row, idx) => {
                  const isEdit = editingId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`${isEdit ? "sheet-edit" : ""} ${
                        flashId === row.id ? "sheet-flash" : ""
                      }`}
                    >
                      <td className="sheet-read tabular-nums text-muted-foreground font-bold w-12">
                        {idx + 1}
                      </td>
                      {isEdit ? (
                        renderEditCells(true)
                      ) : (
                        <>
                          <td className="sheet-read font-extrabold font-display" dir="ltr">
                            {row.phone}
                          </td>
                          <td className="sheet-read">{row.name?.trim() || "—"}</td>
                          <td className="sheet-read text-start">
                            {row.address?.trim() || (
                              <span className="text-muted-foreground">بدون عنوان</span>
                            )}
                          </td>
                          <td className="sheet-read tabular-nums" dir="ltr">
                            {row.latitude ?? "—"}
                          </td>
                          <td className="sheet-read tabular-nums" dir="ltr">
                            {row.longitude ?? "—"}
                          </td>
                          <td className="sheet-read">
                            {row.gpsLabel ? (
                              <a
                                href={
                                  row.gpsLabel.startsWith("http") ? row.gpsLabel : undefined
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 hover:underline max-w-[14rem]"
                                dir="ltr"
                                title={row.gpsLabel}
                              >
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate text-[12px] font-bold">
                                  {row.gpsLabel}
                                </span>
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-xs font-bold">—</span>
                            )}
                          </td>
                          <td className="sheet-read text-muted-foreground">
                            {row.note?.trim() || "—"}
                          </td>
                          <td className="sheet-read">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                disabled={editingId != null && editingId !== row.id}
                                className="h-8 px-2.5 rounded-lg border border-border/60 text-[11px] font-extrabold hover:bg-sky-500/10 hover:border-sky-500/40 disabled:opacity-40"
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}

                {editingId === "new" ? (
                  <tr className="sheet-edit">
                    <td className="sheet-read tabular-nums text-sky-700 dark:text-sky-300 font-extrabold">
                      +
                    </td>
                    {renderEditCells(true)}
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
        <div className="shrink-0 border-t border-border/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-secondary/30 text-[11px] font-bold text-muted-foreground">
          <span>صفوف: {list.length} · مزدوج النقر غير مطلوب — استخدم تعديل / صف جديد</span>
          <span className="tabular-nums" dir="ltr">
            Enter = حفظ الصف النشط
          </span>
        </div>
      </div>

      <Dialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="حذف الرقم"
        maxWidth="max-w-md"
      >
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <p className="font-bold">حذف «{deleteTarget?.phone}»؟</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              isLoading={deleting}
              onClick={handleDelete}
            >
              حذف
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
