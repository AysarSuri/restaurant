import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDeliveryContacts,
  useUpsertDeliveryContact,
  useUpdateDeliveryContact,
  useDeleteDeliveryContact,
  getGetDeliveryContactsQueryKey,
  type DeliveryContact,
} from "@workspace/api-client-react";
import { Button, Input, Badge, Card, Dialog } from "@/components/ui-elements";
import {
  Plus,
  Phone,
  MapPin,
  Navigation,
  Copy,
  Trash2,
  Edit,
  Search,
  AlertTriangle,
  Check,
  LocateFixed,
  ExternalLink,
} from "lucide-react";

const EMPTY_FORM = {
  phone: "",
  address: "",
  name: "",
  latitude: "",
  longitude: "",
  gpsLabel: "",
  note: "",
};

type FormData = typeof EMPTY_FORM;

function parsePastedGps(text: string): { lat?: string; lng?: string; label?: string } {
  const raw = text.trim();
  if (!raw) return {};
  // Google maps style: @lat,lng or ?q=lat,lng
  const at = raw.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (at) return { lat: at[1], lng: at[2], label: raw };
  const q = raw.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (q) return { lat: q[1], lng: q[2], label: raw };
  const pair = raw.match(/(-?\d+\.?\d*)\s*[,،]\s*(-?\d+\.?\d*)/);
  if (pair) return { lat: pair[1], lng: pair[2], label: raw };
  return { label: raw };
}

export default function DeliveryContactsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: contacts, isLoading } = useGetDeliveryContacts({ search: search.trim() || undefined });
  const { mutate: upsert, isPending: upserting } = useUpsertDeliveryContact();
  const { mutate: update, isPending: updating } = useUpdateDeliveryContact();
  const { mutate: remove, isPending: deleting } = useDeleteDeliveryContact();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DeliveryContact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryContact | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsMsg, setGpsMsg] = useState("");

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setGpsMsg("");
    setFormOpen(true);
  };

  const openEdit = (row: DeliveryContact) => {
    setEditTarget(row);
    setForm({
      phone: row.phone,
      address: row.address ?? "",
      name: row.name ?? "",
      latitude: row.latitude != null ? String(row.latitude) : "",
      longitude: row.longitude != null ? String(row.longitude) : "",
      gpsLabel: row.gpsLabel ?? "",
      note: row.note ?? "",
    });
    setError("");
    setGpsMsg("");
    setFormOpen(true);
  };

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
        setForm((p) => ({
          ...p,
          latitude: lat,
          longitude: lng,
          gpsLabel: p.gpsLabel || `https://maps.google.com/?q=${lat},${lng}`,
        }));
        setGpsMsg("تم التقاط الموقع الحالي");
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
        setGpsMsg("لم يتم العثور على إحداثيات في الحافظة");
        return;
      }
      setForm((p) => ({
        ...p,
        latitude: parsed.lat ?? p.latitude,
        longitude: parsed.lng ?? p.longitude,
        gpsLabel: parsed.label ?? p.gpsLabel,
      }));
      setGpsMsg("تم لصق الموقع من الحافظة");
    } catch {
      setGpsMsg("تعذر قراءة الحافظة — الصق يدوياً في حقل الرابط");
    }
  };

  const handleSubmit = () => {
    setError("");
    const phone = form.phone.trim();
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      setError("أدخل رقم هاتف صالح");
      return;
    }
    const payload = {
      phone,
      address: form.address.trim(),
      name: form.name.trim() || undefined,
      latitude: form.latitude.trim() ? Number(form.latitude) : null,
      longitude: form.longitude.trim() ? Number(form.longitude) : null,
      gpsLabel: form.gpsLabel.trim() || undefined,
      note: form.note.trim() || undefined,
    };

    if (editTarget) {
      update(
        { id: editTarget.id, data: payload },
        {
          onSuccess: () => {
            setFormOpen(false);
            queryClient.invalidateQueries({ queryKey: getGetDeliveryContactsQueryKey() });
          },
          onError: (err: any) => setError(err?.data?.message || err?.message || "تعذر الحفظ"),
        }
      );
    } else {
      upsert(
        { data: payload },
        {
          onSuccess: () => {
            setFormOpen(false);
            queryClient.invalidateQueries({ queryKey: getGetDeliveryContactsQueryKey() });
          },
          onError: (err: any) => setError(err?.data?.message || err?.message || "تعذر الحفظ"),
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
          setDeleteTarget(null);
          queryClient.invalidateQueries({ queryKey: getGetDeliveryContactsQueryKey() });
        },
      }
    );
  };

  const list = contacts ?? [];
  const withGps = useMemo(() => list.filter((c) => c.latitude != null && c.longitude != null).length, [list]);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 xl:p-8 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-2">
            <Phone className="w-3.5 h-3.5" />
            Delivery Numbers
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">أرقام التوصيل</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            تخزين أرقام الهاتف وعناوين التوصيل وموقع GPS. تُحدَّث أيضاً تلقائياً من نقطة البيع.
          </p>
        </div>
        <Button className="gap-2 self-start" onClick={openAdd}>
          <Plus className="w-4 h-4" /> إضافة رقم
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
        <Card className="p-4 border border-border/60">
          <p className="text-xs text-muted-foreground">إجمالي الأرقام</p>
          <p className="text-xl font-extrabold font-display">{list.length}</p>
        </Card>
        <Card className="p-4 border border-border/60">
          <p className="text-xs text-muted-foreground">مع موقع GPS</p>
          <p className="text-xl font-extrabold font-display text-primary">{withGps}</p>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالهاتف أو العنوان..."
          className="pr-10"
        />
      </div>

      {isLoading && !contacts ? (
        <p className="text-center text-muted-foreground py-12">جاري التحميل...</p>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center border border-dashed border-border/70">
          <Phone className="w-10 h-10 mx-auto text-primary mb-3 opacity-80" />
          <p className="font-bold">لا توجد أرقام بعد</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">أضف رقماً أو أنشئ طلب توصيل من نقطة البيع.</p>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> إضافة رقم
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((row) => (
            <Card key={row.id} className="p-4 border border-border/60 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold font-display text-lg truncate" dir="ltr">
                    {row.phone}
                  </p>
                  {row.name ? <p className="text-xs text-muted-foreground">{row.name}</p> : null}
                </div>
                {row.latitude != null && row.longitude != null ? (
                  <Badge variant="success">GPS</Badge>
                ) : (
                  <Badge variant="secondary">بدون GPS</Badge>
                )}
              </div>
              <p className="text-sm flex gap-1.5">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{row.address || "بدون عنوان"}</span>
              </p>
              {row.gpsLabel ? (
                <a
                  href={row.gpsLabel.startsWith("http") ? row.gpsLabel : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary inline-flex items-center gap-1 truncate max-w-full"
                  dir="ltr"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="truncate">{row.gpsLabel}</span>
                </a>
              ) : null}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(row)}>
                  <Edit className="w-3.5 h-3.5" /> تعديل
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(row)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? "تعديل رقم توصيل" : "إضافة رقم توصيل"}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">رقم الهاتف *</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="07XXXXXXXXX"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">عنوان التوصيل</label>
            <Input
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="المنطقة / الشارع / أقرب نقطة"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">الاسم (اختياري)</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="اسم الزبون"
            />
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              <p className="font-extrabold text-sm">GPS Location</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                isLoading={gpsBusy}
                onClick={captureCurrentLocation}
              >
                <LocateFixed className="w-4 h-4" /> Current Location
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={pasteGpsFromClipboard}>
                <Copy className="w-4 h-4" /> لصق من الحافظة
              </Button>
            </div>
            {gpsMsg ? (
              <p className="text-xs text-primary flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> {gpsMsg}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Latitude</label>
                <Input
                  value={form.latitude}
                  onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                  placeholder="36.1911"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Longitude</label>
                <Input
                  value={form.longitude}
                  onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                  placeholder="44.0092"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">رابط الخريطة / نص GPS</label>
              <Input
                value={form.gpsLabel}
                onChange={(e) => {
                  const v = e.target.value;
                  const parsed = parsePastedGps(v);
                  setForm((p) => ({
                    ...p,
                    gpsLabel: v,
                    latitude: parsed.lat ?? p.latitude,
                    longitude: parsed.lng ?? p.longitude,
                  }));
                }}
                placeholder="الصق رابط Google Maps أو إحداثيات"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">ملاحظة</label>
            <Input
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="اختياري"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              {error}
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
              إلغاء
            </Button>
            <Button className="flex-1" isLoading={upserting || updating} onClick={handleSubmit}>
              حفظ
            </Button>
          </div>
        </div>
      </Dialog>

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
            <Button variant="destructive" className="flex-1" isLoading={deleting} onClick={handleDelete}>
              حذف
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
