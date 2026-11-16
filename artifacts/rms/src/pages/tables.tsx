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
import { ModernCombobox, type ComboboxOption } from "@/components/modern-combobox";
import {
  Users,
  MapPin,
  Sparkles,
  Armchair,
  Plus,
  UserRound,
  ChevronLeft,
  DoorOpen,
  Search,
} from "lucide-react";
import { DiningTableIcon } from "@/components/dining-table-icon";
import { RoomIcon } from "@/components/room-icon";
import { TABLE_STATUS_META } from "@/lib/table-status";

type EntityType = RestaurantTableType;

const TYPE_TABS: {
  key: EntityType;
  label: string;
  icon: typeof Armchair;
}[] = [
  { key: "table", label: "طاولة", icon: Armchair },
  { key: "room", label: "غرفة", icon: DoorOpen },
  { key: "person", label: "أشخاص", icon: UserRound },
];

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
    icon: Armchair,
  },
  person: {
    label: "شخص",
    labelPlural: "أشخاص",
    addTitle: "إضافة شخص",
    numberLabel: "اسم الشخص",
    empty: "لا يوجد أشخاص في هذا التصنيف",
    capacityLabel: "سعة",
    icon: UserRound,
  },
};

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const EMPTY_TABLE_FORM = {
  number: "",
  capacity: "4",
  location: "",
  type: TableTypeEnum.table as EntityType,
};

const STATUS_META = TABLE_STATUS_META;

/** Persons: موجود = available, مو موجود = occupied (default) */
const PERSON_STATUS_META = {
  available: {
    label: "موجود",
    chip: "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/40",
    filterActive: "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/35",
    filterIdle:
      "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20",
    dot: "bg-emerald-500",
  },
  occupied: {
    label: "مو موجود",
    chip: "bg-slate-500 text-white border-slate-600 shadow-sm shadow-slate-500/40",
    filterActive: "bg-slate-500 text-white border-slate-600 shadow-md shadow-slate-500/35",
    filterIdle:
      "bg-slate-500/10 border-slate-500/40 text-slate-700 dark:text-slate-300 hover:bg-slate-500/20",
    dot: "bg-slate-500",
  },
} as const;

const personPresence = (status: string): "available" | "occupied" =>
  status === "available" ? "available" : "occupied";

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
  const [searchId, setSearchId] = useState("");

  const typeMeta = TYPE_META[entityType];
  const TypeIcon = typeMeta.icon;

  const searchPlaceholder =
    entityType === "person"
      ? "ابحث باسم الشخص..."
      : entityType === "room"
        ? "ابحث برقم الغرفة..."
        : "ابحث برقم الطاولة...";

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

  const searchOptions = useMemo<ComboboxOption[]>(() => {
    const allLabel =
      entityType === "person" ? "كل الأشخاص" : entityType === "room" ? "كل الغرف" : "كل الطاولات";
    const Icon = TYPE_TABS.find((t) => t.key === entityType)?.icon ?? Search;
    const items = [...typedTables].sort((a, b) =>
      String(a.number).localeCompare(String(b.number), "ar", { sensitivity: "base" })
    );
    return [
      { value: "", label: allLabel, subtitle: `${typedTables.length} عنصر`, icon: Icon },
      ...items.map((t) => {
        const statusLabel = STATUS_META[t.status]?.label ?? t.status;
        const location = t.location?.trim();
        const personLabel =
          entityType === "person"
            ? PERSON_STATUS_META[personPresence(t.status)].label
            : statusLabel;
        const shownStatus = entityType === "person" ? personLabel : statusLabel;
        return {
          value: String(t.id),
          label: String(t.number),
          subtitle: location ? `${shownStatus} · ${location}` : shownStatus,
          icon: Icon,
        };
      }),
    ];
  }, [typedTables, entityType]);

  const searchedTables = useMemo(() => {
    if (!searchId) return typedTables;
    return typedTables.filter((t) => String(t.id) === searchId);
  }, [typedTables, searchId]);

  const counts = useMemo(() => {
    const base = { all: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0 };
    for (const t of searchedTables) {
      base.all += 1;
      if (entityType === "person") {
        if (personPresence(t.status) === "available") base.available += 1;
        else base.occupied += 1;
      } else if (t.status in base) {
        (base as any)[t.status] += 1;
      }
    }
    return base;
  }, [searchedTables, entityType]);

  const filtered = useMemo(() => {
    let list = searchedTables;
    if (filter !== "all") {
      if (entityType === "person") {
        list = searchedTables.filter((t) => personPresence(t.status) === filter);
      } else {
        list = searchedTables.filter((t) => t.status === filter);
      }
    }
    if (entityType !== "person") return list;
    return [...list].sort((a, b) =>
      String(a.number).localeCompare(String(b.number), "ar", { sensitivity: "base" })
    );
  }, [searchedTables, filter, entityType]);

  const personInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0]}${parts[1][0]}`;
  };

  const nextNumberForType = (type: EntityType) => {
    const nums = (tables ?? [])
      .filter((t) => (t.type ?? "table") === type)
      .map((t) => parseInt(String(t.number), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1);
  };

  const openAdd = () => {
    const isPerson = entityType === "person";
    setAddForm({
      number: isPerson ? "" : nextNumberForType(entityType),
      capacity: isPerson ? "1" : "4",
      location: "",
      type: entityType,
    });
    setAddError("");
    setAddOpen(true);
  };

  const handleTypeChangeInForm = (type: EntityType) => {
    const isPerson = type === "person";
    setAddForm((f) => ({
      ...f,
      type,
      number: isPerson ? "" : nextNumberForType(type),
      capacity: isPerson ? "1" : f.capacity || "4",
    }));
    setAddError("");
  };

  const handleCreateTable = () => {
    const type = addForm.type;
    const labels = TYPE_META[type];
    const isPerson = type === "person";
    const number = isPerson
      ? addForm.number.trim().replace(/\s+/g, " ")
      : addForm.number.trim();
    const capacity = Number(addForm.capacity);
    if (!number) {
      setAddError(isPerson ? "اسم الشخص مطلوب" : `${labels.numberLabel} مطلوب`);
      return;
    }
    if (!capacity || capacity < 1) {
      setAddError("السعة يجب أن تكون رقمًا أكبر من صفر");
      return;
    }
    const duplicate = tables?.some((t) => {
      if ((t.type ?? "table") !== type) return false;
      if (isPerson) return normalizeName(String(t.number)) === normalizeName(number);
      return t.number === number;
    });
    if (duplicate) {
      setAddError(isPerson ? "اسم الشخص مستخدم مسبقًا" : `${labels.numberLabel} مستخدم مسبقًا`);
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
          status: isPerson ? "occupied" : "available",
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
          setAddError(
            err?.data?.error ||
              err?.data?.message ||
              err?.message ||
              `تعذر إضافة ${labels.label}`
          );
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

      <div className="rounded-2xl border border-border/70 bg-secondary/40 p-2 sm:p-2.5 shadow-sm space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <div className="flex flex-1 min-w-0 p-1 rounded-xl bg-background/70 border border-border/50 gap-1">
            {TYPE_TABS.map(({ key, label, icon: Icon }) => {
              const active = entityType === key;
              const count = typeCounts[key];
              return (
                <button
                  key={key}
                  type="button"
                onClick={() => {
                  setEntityType(key);
                  setFilter("all");
                  setSearchId("");
                  setSelectedTable(null);
                }}
                  className={`flex-1 inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-2.5 sm:px-4 rounded-lg text-sm sm:text-base font-extrabold transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-l from-primary to-amber-500 text-primary-foreground shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? "opacity-100" : "opacity-70"}`} />
                  <span>{label}</span>
                  <span
                    className={`min-w-6 h-6 px-1.5 rounded-full inline-flex items-center justify-center text-[11px] font-display font-bold ${
                      active
                        ? "bg-white/25 text-primary-foreground"
                        : "bg-secondary text-muted-foreground border border-border/60"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 lg:w-[min(100%,28rem)] lg:flex-shrink-0">
            <ModernCombobox
              className="flex-1 min-w-0"
              value={searchId}
              onChange={(value) => {
                setSearchId(value);
                setFilter("all");
                if (value) {
                  const found = typedTables.find((t) => String(t.id) === value);
                  if (found) {
                    setSelectedTable(found);
                    setStatus(
                      entityType === "person"
                        ? personPresence(found.status)
                        : found.status
                    );
                  }
                }
              }}
              options={searchOptions}
              searchable
              searchPlaceholder={searchPlaceholder}
              placeholder={searchPlaceholder}
              label={undefined}
              icon={Search}
              emptyText="لا توجد نتائج"
            />
            <Button
              onClick={openAdd}
              className="rounded-xl h-12 px-5 gap-2 text-sm font-extrabold shadow-md shadow-primary/20 flex-shrink-0"
            >
              <Plus className="w-5 h-5" />
              {typeMeta.addTitle}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(entityType === "person"
          ? ([
              ["all", "الكل", counts.all],
              ["available", "موجود", counts.available],
              ["occupied", "مو موجود", counts.occupied],
            ] as const)
          : ([
              ["all", "الكل", counts.all],
              ["available", "متاح", counts.available],
              ["occupied", "مشغول", counts.occupied],
              ["reserved", "محجوز", counts.reserved],
              ["cleaning", "تنظيف", counts.cleaning],
            ] as const)
        ).map(([key, label, count]) => {
          const meta =
            key === "all"
              ? null
              : entityType === "person"
                ? PERSON_STATUS_META[key as "available" | "occupied"]
                : STATUS_META[key];
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
          {entityType === "room" ? (
            <RoomIcon className="w-24 h-auto mx-auto mb-3 opacity-60" />
          ) : (
            <TypeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          )}
          <p className="font-bold">{typeMeta.empty}</p>
          {filter === "all" && (
            <Button onClick={openAdd} className="rounded-full mt-4">
              <Plus className="w-4 h-4 me-1.5" />
              {typeMeta.addTitle}
            </Button>
          )}
        </div>
      ) : entityType === "person" ? (
        <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden shadow-sm">
          <div className="hidden sm:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_90px_110px_40px] gap-3 px-5 py-3 border-b border-border/60 bg-secondary/40 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            <span>الاسم</span>
            <span>الموقع</span>
            <span className="text-center">السعة</span>
            <span className="text-center">الحالة</span>
            <span />
          </div>
          <div className="divide-y divide-border/50">
            {filtered.map((person, idx) => {
              const presence = personPresence(person.status);
              const meta = PERSON_STATUS_META[presence];
              const name = String(person.number);
              return (
                <motion.button
                  key={person.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                  onClick={() => {
                    setSelectedTable(person);
                    setStatus(presence);
                  }}
                  className="w-full text-start px-4 sm:px-5 py-3.5 sm:py-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_90px_110px_40px] gap-2 sm:gap-3 items-center hover:bg-primary/5 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/90 to-amber-500 text-primary-foreground flex items-center justify-center text-sm font-extrabold shadow-md shadow-primary/20 flex-shrink-0">
                      {personInitials(name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {person.location || "بدون موقع"}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                    <span className="truncate">{person.location || "بدون موقع"}</span>
                  </div>

                  <div className="hidden sm:flex items-center justify-center gap-1 text-sm font-bold text-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="font-display">{person.capacity}</span>
                  </div>

                  <div className="flex sm:justify-center items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${meta.chip}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {meta.label}
                    </span>
                    <span className="sm:hidden text-xs text-muted-foreground font-bold">
                      سعة {person.capacity}
                    </span>
                  </div>

                  <div className="hidden sm:flex justify-end">
                    <ChevronLeft className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.button>
              );
            })}
          </div>
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
                      <RoomIcon
                        number={table.number}
                        className="w-full h-auto drop-shadow-md"
                      />
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
            ) : addForm.type === "room" ? (
              <RoomIcon className="w-20 h-auto flex-shrink-0" />
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
                {addForm.type === "person"
                  ? "أدخل اسم الشخص والسعة والموقع (اختياري)"
                  : "اختر النوع ثم أدخل الرقم والسعة والموقع (اختياري)"}
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
              {TYPE_META[addForm.type].numberLabel}{" "}
              <span className="text-destructive">*</span>
            </label>
            {addForm.type === "person" ? (
              <>
                <Input
                  value={addForm.number}
                  onChange={(e) => setAddForm((f) => ({ ...f, number: e.target.value }))}
                  placeholder="احمد محمد"
                  className="placeholder:text-muted-foreground/25"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  لا يُسمح بأسماء مكررة
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
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
              autoFocus={addForm.type !== "person"}
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
              ) : (selectedTable.type ?? "table") === "room" ? (
                <RoomIcon number={selectedTable.number} className="w-28 h-auto flex-shrink-0" />
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
              {(selectedTable.type ?? "table") === "person" ? (
                <Select
                  value={personPresence(status)}
                  onChange={(e) => setStatus(e.target.value as RestaurantTableStatus)}
                >
                  <option value="available">موجود</option>
                  <option value="occupied">مو موجود</option>
                </Select>
              ) : (
                <Select value={status} onChange={(e) => setStatus(e.target.value as RestaurantTableStatus)}>
                  <option value="available">متاح</option>
                  <option value="occupied">مشغول</option>
                  <option value="reserved">محجوز</option>
                  <option value="cleaning">تنظيف</option>
                </Select>
              )}
            </div>

            <div
              className={`grid gap-2 ${
                (selectedTable.type ?? "table") === "person"
                  ? "grid-cols-2"
                  : "grid-cols-2 sm:grid-cols-4"
              }`}
            >
              {((selectedTable.type ?? "table") === "person"
                ? (["available", "occupied"] as const)
                : (["available", "occupied", "reserved", "cleaning"] as const)
              ).map((s) => {
                const m =
                  (selectedTable.type ?? "table") === "person"
                    ? PERSON_STATUS_META[s]
                    : STATUS_META[s];
                const active =
                  (selectedTable.type ?? "table") === "person"
                    ? personPresence(status) === s
                    : status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`h-10 rounded-xl border-2 text-xs font-bold transition-all ${
                      active ? m.chip + " scale-[1.02]" : m.filterIdle
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
