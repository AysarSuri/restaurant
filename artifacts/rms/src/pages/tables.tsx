import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  useGetTables,
  useUpdateTable,
  useCreateTable,
  type RestaurantTableStatus,
} from "@workspace/api-client-react";
import { Button, Dialog, Select, Input } from "@/components/ui-elements";
import {
  Users,
  MapPin,
  Sparkles,
  Armchair,
  Plus,
} from "lucide-react";
import { DiningTableIcon } from "@/components/dining-table-icon";

const EMPTY_TABLE_FORM = {
  number: "",
  capacity: "4",
  location: "",
};

const STATUS_META: Record<
  string,
  {
    label: string;
    ring: string;
    glow: string;
    chip: string;
    card: string;
    filterActive: string;
    filterIdle: string;
    dot: string;
  }
> = {
  available: {
    label: "متاح",
    ring: "ring-emerald-500/70 border-emerald-500",
    glow: "from-emerald-500/45 via-emerald-400/15 to-transparent",
    chip: "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/40",
    card: "bg-emerald-500/10",
    filterActive: "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/35",
    filterIdle: "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20",
    dot: "bg-emerald-500",
  },
  occupied: {
    label: "مشغول",
    ring: "ring-rose-500/70 border-rose-500",
    glow: "from-rose-500/50 via-rose-400/15 to-transparent",
    chip: "bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/40",
    card: "bg-rose-500/10",
    filterActive: "bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/35",
    filterIdle: "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20",
    dot: "bg-rose-500",
  },
  reserved: {
    label: "محجوز",
    ring: "ring-amber-500/70 border-amber-500",
    glow: "from-amber-500/50 via-amber-400/20 to-transparent",
    chip: "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/40",
    card: "bg-amber-500/10",
    filterActive: "bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-500/35",
    filterIdle: "bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20",
    dot: "bg-amber-500",
  },
  cleaning: {
    label: "تنظيف",
    ring: "ring-sky-500/70 border-sky-500",
    glow: "from-sky-500/50 via-sky-400/15 to-transparent",
    chip: "bg-sky-500 text-white border-sky-600 shadow-sm shadow-sky-500/40",
    card: "bg-sky-500/10",
    filterActive: "bg-sky-500 text-white border-sky-600 shadow-md shadow-sky-500/35",
    filterIdle: "bg-sky-500/10 border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20",
    dot: "bg-sky-500",
  },
};

export default function Tables() {
  const { data: tables, isLoading, refetch } = useGetTables();
  const { mutate: updateTable, isPending } = useUpdateTable();
  const { mutate: createTable, isPending: isCreating } = useCreateTable();
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [status, setStatus] = useState<RestaurantTableStatus>("available");
  const [filter, setFilter] = useState<"all" | RestaurantTableStatus>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_TABLE_FORM);
  const [addError, setAddError] = useState("");

  const counts = useMemo(() => {
    const base = { all: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    for (const t of tables ?? []) {
      base.all += 1;
      if (t.status in base) (base as any)[t.status] += 1;
    }
    return base;
  }, [tables]);

  const filtered = useMemo(() => {
    if (!tables) return [];
    if (filter === "all") return tables;
    return tables.filter((t) => t.status === filter);
  }, [tables, filter]);

  const nextTableNumber = useMemo(() => {
    const nums = (tables ?? [])
      .map((t) => parseInt(String(t.number), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1);
  }, [tables]);

  const openAdd = () => {
    setAddForm({ number: nextTableNumber, capacity: "4", location: "" });
    setAddError("");
    setAddOpen(true);
  };

  const handleCreateTable = () => {
    const number = addForm.number.trim();
    const capacity = Number(addForm.capacity);
    if (!number) {
      setAddError("رقم الطاولة مطلوب");
      return;
    }
    if (!capacity || capacity < 1) {
      setAddError("السعة يجب أن تكون رقمًا أكبر من صفر");
      return;
    }
    if (tables?.some((t) => t.number === number)) {
      setAddError("رقم الطاولة مستخدم مسبقًا");
      return;
    }
    setAddError("");
    createTable(
      {
        data: {
          number,
          capacity,
          location: addForm.location.trim() || undefined,
          status: "available",
        },
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          refetch();
        },
        onError: (err: any) => {
          setAddError(err?.data?.message || err?.message || "تعذر إضافة الطاولة");
        },
      }
    );
  };

  const handleUpdateStatus = () => {
    if (!selectedTable) return;
    updateTable(
      { id: selectedTable.id, data: { status } },
      {
        onSuccess: () => {
          setSelectedTable(null);
          refetch();
        },
      }
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-primary mb-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-[11px] font-display tracking-[0.2em] uppercase">Hall Floor</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">إدارة الطاولات</h2>
          <p className="text-sm text-muted-foreground mt-1">عرض أنيق لحالة الصالة وتحديث سريع لكل طاولة</p>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-3">
          <Button onClick={openAdd} className="rounded-full h-10 gap-1.5 self-start sm:self-auto">
            <Plus className="w-4 h-4" />
            إضافة طاولة
          </Button>
          <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "الكل", counts.all],
              ["available", "متاح", counts.available],
              ["occupied", "مشغول", counts.occupied],
              ["reserved", "محجوز", counts.reserved],
              ["cleaning", "تنظيف", counts.cleaning],
            ] as const
          ).map(([key, label, count]) => {
            const meta = key === "all" ? null : STATUS_META[key];
            const active =
              key === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                : meta!.filterActive;
            const idle =
              key === "all"
                ? "bg-secondary/70 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                : meta!.filterIdle;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-2 h-9 px-3 rounded-full border text-xs font-bold transition-all ${
                  filter === key ? active : idle
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    key === "all" ? "bg-current opacity-70" : meta!.dot
                  } ${filter === key && key !== "all" ? "bg-white" : ""}`}
                />
                {label}
                <span className="font-display opacity-90">{count}</span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-secondary/30 py-20 text-center text-muted-foreground">
          <Armchair className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-bold">لا توجد طاولات في هذا التصنيف</p>
          {filter === "all" && (
            <Button onClick={openAdd} className="rounded-full mt-4">
              <Plus className="w-4 h-4 me-1.5" />
              إضافة طاولة
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5">
          {filtered.map((table, idx) => {
            const meta = STATUS_META[table.status] ?? STATUS_META.available;
            return (
              <motion.button
                key={table.id}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setSelectedTable(table);
                  setStatus(table.status);
                }}
                className={`
                  group relative aspect-[4/5] rounded-[1.75rem] border-2 backdrop-blur-xl
                  overflow-hidden text-center shadow-lg shadow-black/5
                  ${meta.card} ${meta.ring}
                  transition-shadow duration-300 hover:shadow-xl
                `}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${meta.glow}`} />

                <div className="relative z-10 h-full flex flex-col items-center justify-between p-4 sm:p-5">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${meta.chip}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    {meta.label}
                  </div>

                  {/* Dining table icon (wood + gold cloth + chairs) */}
                  <div className="relative w-full max-w-[9.5rem] sm:max-w-[11rem] mx-auto group-hover:scale-105 transition-transform duration-300">
                    <DiningTableIcon
                      number={table.number}
                      className="w-full h-auto drop-shadow-md"
                    />
                  </div>

                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-foreground">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-display">{table.capacity}</span>
                      <span className="text-muted-foreground font-medium">مقاعد</span>
                    </div>
                    {table.location && (
                      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-primary/80" />
                        <span className="truncate max-w-[9rem]">{table.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <Dialog
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="إضافة طاولة"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-amber-500/5 to-transparent p-4 flex items-center gap-3">
            <DiningTableIcon className="w-16 h-auto flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-foreground">طاولة جديدة</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                أدخل الرقم والسعة والموقع (اختياري)
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">رقم الطاولة</label>
            <Input
              value={addForm.number}
              readOnly
              disabled
              dir="ltr"
              className="opacity-80 cursor-not-allowed font-display font-bold"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              يزداد تلقائياً ولا يمكن تعديله
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              السعة (مقاعد) <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={1}
              value={addForm.capacity}
              onChange={(e) => setAddForm((f) => ({ ...f, capacity: e.target.value }))}
              dir="ltr"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">الموقع</label>
            <Input
              value={addForm.location}
              onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="صالة رئيسية / شرفة..."
            />
          </div>

          {addError && <p className="text-sm font-semibold text-destructive">{addError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreateTable} isLoading={isCreating}>
              <Plus className="w-4 h-4 me-1" />
              حفظ الطاولة
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={!!selectedTable}
        onClose={() => setSelectedTable(null)}
        title={`طاولة ${selectedTable?.number ?? ""}`}
      >
        {selectedTable && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4 flex items-center gap-4">
              <DiningTableIcon number={selectedTable.number} className="w-24 h-auto flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-foreground">تحديث حالة الطاولة</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  السعة {selectedTable.capacity} · {selectedTable.location || "بدون موقع"}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">الحالة الجديدة</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value as RestaurantTableStatus)}>
                <option value="available">متاح</option>
                <option value="occupied">مشغول</option>
                <option value="reserved">محجوز</option>
                <option value="cleaning">تنظيف</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["available", "occupied", "reserved", "cleaning"] as const).map((s) => {
                const m = STATUS_META[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`h-10 rounded-xl border-2 text-xs font-bold transition-all ${
                      status === s ? m.chip + " scale-[1.02]" : m.filterIdle
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedTable(null)}>
                إلغاء
              </Button>
              <Button onClick={handleUpdateStatus} isLoading={isPending}>
                حفظ الحالة
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
