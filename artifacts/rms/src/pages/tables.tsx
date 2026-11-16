import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  useGetTables,
  useUpdateTable,
  useCreateTable,
  type RestaurantTableStatus,
  RestaurantTableType as TableTypeEnum,
} from "@workspace/api-client-react";

type RestaurantTableType = (typeof TableTypeEnum)[keyof typeof TableTypeEnum];
import { Button, Dialog, Select, Input } from "@/components/ui-elements";
import {
  Users,
  MapPin,
  Sparkles,
  Armchair,
  Plus,
  DoorOpen,
  UserRound,
} from "lucide-react";
import { DiningTableIcon } from "@/components/dining-table-icon";
import { TABLE_STATUS_META } from "@/lib/table-status";

type EntityType = RestaurantTableType;

const TYPE_META: Record<
  EntityType,
  {
    label: string;
    labelPlural: string;
    addTitle: string;
    numberLabel: string;
    empty: string;
    capacityLabel: string;
    icon: typeof Armchair;
  }
> = {
  table: {
    label: "طاولة",
    labelPlural: "طاولات",
    addTitle: "إضافة طاولة",
    numberLabel: "رقم الطاولة",
    empty: "لا توجد طاولات في هذا التصنيف",
    capacityLabel: "مقاعد",
    icon: Armchair,
  },
  room: {
    label: "غرفة",
    labelPlural: "غرف",
    addTitle: "إضافة غرفة",
    numberLabel: "رقم الغرفة",
    empty: "لا توجد غرف في هذا التصنيف",
    capacityLabel: "سعة",
    icon: DoorOpen,
  },
  person: {
    label: "شخص",
    labelPlural: "أشخاص",
    addTitle: "إضافة شخص",
    numberLabel: "رقم الشخص",
    empty: "لا يوجد أشخاص في هذا التصنيف",
    capacityLabel: "سعة",
    icon: UserRound,
  },
};

const EMPTY_TABLE_FORM = {
  number: "",
  capacity: "4",
  location: "",
  type: TableTypeEnum.table as EntityType,
};

const STATUS_META = TABLE_STATUS_META;

export default function Tables() {
  const { data: tables, isLoading, refetch } = useGetTables();
  const { mutate: updateTable, isPending } = useUpdateTable();
  const { mutate: createTable, isPending: isCreating } = useCreateTable();
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [status, setStatus] = useState<RestaurantTableStatus>("available");
  const [entityType, setEntityType] = useState<EntityType>("table");
  const [filter, setFilter] = useState<"all" | RestaurantTableStatus>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_TABLE_FORM);
  const [addError, setAddError] = useState("");

  const typeMeta = TYPE_META[entityType];
  const TypeIcon = typeMeta.icon;

  const typedTables = useMemo(() => {
    return (tables ?? []).filter((t) => (t.type ?? "table") === entityType);
  }, [tables, entityType]);

  const typeCounts = useMemo(() => {
    const base = { table: 0, room: 0, person: 0 };
    for (const t of tables ?? []) {
      const key = (t.type ?? "table") as EntityType;
      if (key in base) base[key] += 1;
    }
    return base;
  }, [tables]);

  const counts = useMemo(() => {
    const base = { all: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    for (const t of typedTables) {
      base.all += 1;
      if (t.status in base) (base as any)[t.status] += 1;
    }
    return base;
  }, [typedTables]);

  const filtered = useMemo(() => {
    if (filter === "all") return typedTables;
    return typedTables.filter((t) => t.status === filter);
  }, [typedTables, filter]);

  const nextNumberForType = (type: EntityType) => {
    const nums = (tables ?? [])
      .filter((t) => (t.type ?? "table") === type)
      .map((t) => parseInt(String(t.number), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1);
  };

  const openAdd = () => {
    setAddForm({
      number: nextNumberForType(entityType),
      capacity: "4",
      location: "",
      type: entityType,
    });
    setAddError("");
    setAddOpen(true);
  };

  const handleTypeChangeInForm = (type: EntityType) => {
    setAddForm((f) => ({
      ...f,
      type,
      number: nextNumberForType(type),
    }));
  };

  const handleCreateTable = () => {
    const number = addForm.number.trim();
    const capacity = Number(addForm.capacity);
    const type = addForm.type;
    const labels = TYPE_META[type];
    if (!number) {
      setAddError(`${labels.numberLabel} مطلوب`);
      return;
    }
    if (!capacity || capacity < 1) {
      setAddError("السعة يجب أن تكون رقمًا أكبر من صفر");
      return;
    }
    if (tables?.some((t) => (t.type ?? "table") === type && t.number === number)) {
      setAddError(`${labels.numberLabel} مستخدم مسبقًا`);
      return;
    }
    setAddError("");
    createTable(
      {
        data: {
          number,
          capacity,
          type,
          location: addForm.location.trim() || undefined,
          status: "available",
        },
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          setEntityType(type);
          setFilter("all");
          refetch();
        },
        onError: (err: any) => {
          setAddError(err?.data?.message || err?.message || `تعذر إضافة ${labels.label}`);
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

  const selectedTypeMeta = TYPE_META[(selectedTable?.type ?? "table") as EntityType];
  const SelectedTypeIcon = selectedTypeMeta.icon;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-primary mb-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-[11px] font-display tracking-[0.2em] uppercase">Hall Floor</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">إدارة الطاولات</h2>
          <p className="text-sm text-muted-foreground mt-1">
            ثلاث صفحات: طاولات وغرف وأشخاص مع تحديث سريع للحالة
          </p>
        </div>

        <Button onClick={openAdd} className="rounded-full h-10 gap-1.5 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          {typeMeta.addTitle}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 p-1 rounded-2xl bg-secondary/50 border border-border/60 w-fit">
        {(
          [
            ["table", "طاولة", typeCounts.table],
            ["room", "غرفة", typeCounts.room],
            ["person", "أشخاص", typeCounts.person],
          ] as const
        ).map(([key, label, count]) => {
          const active = entityType === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setEntityType(key);
                setFilter("all");
              }}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-bold transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/70"
              }`}
            >
              {label}
              <span className={`font-display text-xs ${active ? "opacity-90" : "opacity-70"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

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

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-secondary/30 py-20 text-center text-muted-foreground">
          <TypeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-bold">{typeMeta.empty}</p>
          {filter === "all" && (
            <Button onClick={openAdd} className="rounded-full mt-4">
              <Plus className="w-4 h-4 me-1.5" />
              {typeMeta.addTitle}
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

                  <div className="relative w-full max-w-[9.5rem] sm:max-w-[11rem] mx-auto group-hover:scale-105 transition-transform duration-300">
                    {entityType === "table" ? (
                      <DiningTableIcon
                        number={table.number}
                        className="w-full h-auto drop-shadow-md"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <TypeIcon className="w-14 h-14 text-primary drop-shadow-md" />
                        <span className="font-display text-2xl font-extrabold text-foreground">
                          {table.number}
                        </span>
                        <span className="text-xs text-muted-foreground font-bold">
                          {typeMeta.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-foreground">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-display">{table.capacity}</span>
                      <span className="text-muted-foreground font-medium">
                        {typeMeta.capacityLabel}
                      </span>
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
        title={TYPE_META[addForm.type].addTitle}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-amber-500/5 to-transparent p-4 flex items-center gap-3">
            {addForm.type === "table" ? (
              <DiningTableIcon className="w-16 h-auto flex-shrink-0" />
            ) : (
              (() => {
                const Icon = TYPE_META[addForm.type].icon;
                return <Icon className="w-12 h-12 text-primary flex-shrink-0" />;
              })()
            )}
            <div className="min-w-0">
              <p className="font-bold text-foreground">
                {addForm.type === "person"
                  ? "شخص جديد"
                  : addForm.type === "room"
                    ? "غرفة جديدة"
                    : "طاولة جديدة"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                اختر النوع ثم أدخل الرقم والسعة والموقع (اختياري)
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              النوع <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["table", "طاولة"],
                  ["room", "غرفة"],
                  ["person", "شخص"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTypeChangeInForm(key)}
                  className={`h-11 rounded-xl border-2 text-sm font-bold transition-all ${
                    addForm.type === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              {TYPE_META[addForm.type].numberLabel}
            </label>
            <Input
              value={addForm.number}
              readOnly
              disabled
              dir="ltr"
              className="opacity-80 cursor-not-allowed font-display font-bold"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              يزداد تلقائياً حسب النوع ولا يمكن تعديله
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              السعة ({TYPE_META[addForm.type].capacityLabel}){" "}
              <span className="text-destructive">*</span>
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
              حفظ {TYPE_META[addForm.type].label}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={!!selectedTable}
        onClose={() => setSelectedTable(null)}
        title={`${selectedTypeMeta.label} ${selectedTable?.number ?? ""}`}
      >
        {selectedTable && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4 flex items-center gap-4">
              {(selectedTable.type ?? "table") === "table" ? (
                <DiningTableIcon number={selectedTable.number} className="w-24 h-auto flex-shrink-0" />
              ) : (
                <SelectedTypeIcon className="w-14 h-14 text-primary flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-bold text-foreground">تحديث حالة {selectedTypeMeta.label}</p>
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
