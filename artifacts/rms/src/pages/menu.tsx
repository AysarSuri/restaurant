import React, { useRef, useState } from "react";
import {
  useGetMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useGetMenuCategories,
  useCreateMenuCategory,
  useUpdateMenuCategory,
  useDeleteMenuCategory,
  useGetBranches,
  type MenuCategory,
  type MenuItem,
} from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Dialog, Input, Button, Select } from "@/components/ui-elements";
import {
  Building2,
  Check,
  FolderPlus,
  ImagePlus,
  Pencil,
  Plus,
  Tags,
  Trash2,
  X,
} from "lucide-react";

const CATEGORY_IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";
const CATEGORY_IMAGE_MAX = 4 * 1024 * 1024;

type CategoryFormState = {
  nameAr: string;
  name: string;
  imageUrl: string;
};

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  nameAr: "",
  name: "",
  imageUrl: "",
};

async function readCategoryImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("اختر ملف صورة فقط");
  }
  if (file.size > CATEGORY_IMAGE_MAX) {
    throw new Error("حجم الصورة كبير جداً (الحد 4MB)");
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.readAsDataURL(file);
  });
}

function CategoryImageThumb({
  src,
  alt,
  className = "w-12 h-12",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${className} rounded-xl object-cover border border-border/50 bg-secondary/40 flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${className} rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 border border-border/40`}
    >
      <Tags className="w-5 h-5" />
    </div>
  );
}

export default function Menu() {
  const { data: items, isLoading, refetch } = useGetMenuItems();
  const { data: categories, refetch: refetchCategories } = useGetMenuCategories();
  const { data: branches } = useGetBranches({
    query: { staleTime: 60_000, refetchOnMount: false },
  });
  const { mutate: create } = useCreateMenuItem();
  const { mutate: update } = useUpdateMenuItem();
  const { mutate: remove } = useDeleteMenuItem();
  const { mutate: createCategory, isPending: isCreatingCategory } = useCreateMenuCategory();
  const { mutate: updateCategory, isPending: isUpdatingCategory } = useUpdateMenuCategory();
  const { mutate: deleteCategory, isPending: isDeletingCategory } = useDeleteMenuCategory();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [editForm, setEditForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [categoryError, setCategoryError] = useState("");
  const addImageInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    nameAr: "",
    name: "",
    price: 0,
    categoryId: 0,
    isAvailable: true,
    allBranches: true,
    branchIds: [] as number[],
  });

  const handleOpen = (item?: MenuItem) => {
    setFormError("");
    if (item) {
      setEditing(item);
      setFormData({
        nameAr: item.nameAr,
        name: item.name,
        price: item.price,
        categoryId: item.categoryId,
        isAvailable: item.isAvailable,
        allBranches: item.allBranches !== false || !(item.branchIds?.length),
        branchIds: item.branchIds ?? [],
      });
    } else {
      setEditing(null);
      setFormData({
        nameAr: "",
        name: "",
        price: 0,
        categoryId: categories?.[0]?.id || 0,
        isAvailable: true,
        allBranches: true,
        branchIds: [],
      });
    }
    setIsOpen(true);
  };

  const toggleBranch = (id: number) => {
    setFormData((f) => {
      const exists = f.branchIds.includes(id);
      const branchIds = exists ? f.branchIds.filter((b) => b !== id) : [...f.branchIds, id];
      return { ...f, allBranches: false, branchIds };
    });
    setFormError("");
  };

  const selectAllBranches = () => {
    setFormData((f) => ({ ...f, allBranches: true, branchIds: [] }));
    setFormError("");
  };

  const handleSubmit = () => {
    if (!formData.nameAr.trim() || !formData.name.trim()) {
      setFormError("الاسم العربي والإنجليزي مطلوبان");
      return;
    }
    if (!formData.categoryId) {
      setFormError("اختر التصنيف");
      return;
    }
    if (!formData.allBranches && formData.branchIds.length === 0) {
      setFormError("اختر جميع الفروع أو فرعاً واحداً على الأقل");
      return;
    }
    setFormError("");

    const data = {
      nameAr: formData.nameAr.trim(),
      name: formData.name.trim(),
      price: formData.price,
      categoryId: formData.categoryId,
      isAvailable: formData.isAvailable,
      allBranches: formData.allBranches,
      branchIds: formData.allBranches ? [] : formData.branchIds,
      nameKu: "",
      description: "",
      descriptionAr: "",
    };

    if (editing) {
      update({ id: editing.id, data }, { onSuccess: () => { setIsOpen(false); refetch(); } });
    } else {
      create({ data }, { onSuccess: () => { setIsOpen(false); refetch(); } });
    }
  };

  const openCategoryManager = () => {
    setShowAddCategory(false);
    setEditingCategoryId(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setCategoryError("");
    setIsCategoryOpen(true);
  };

  const startEditCategory = (cat: MenuCategory) => {
    setShowAddCategory(false);
    setEditingCategoryId(cat.id);
    setEditForm({
      nameAr: cat.nameAr,
      name: cat.name,
      imageUrl: cat.imageUrl || "",
    });
    setCategoryError("");
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditForm(EMPTY_CATEGORY_FORM);
  };

  const pickCategoryImage = async (
    file: File | undefined,
    target: "add" | "edit"
  ) => {
    if (!file) return;
    try {
      const dataUrl = await readCategoryImageFile(file);
      if (target === "add") {
        setCategoryForm((f) => ({ ...f, imageUrl: dataUrl }));
      } else {
        setEditForm((f) => ({ ...f, imageUrl: dataUrl }));
      }
      setCategoryError("");
    } catch (err: any) {
      setCategoryError(err?.message || "تعذر رفع الصورة");
    }
  };

  const handleCreateCategory = () => {
    const nameAr = categoryForm.nameAr.trim();
    const name = categoryForm.name.trim() || nameAr;
    if (!nameAr) {
      setCategoryError("الاسم العربي مطلوب");
      return;
    }
    setCategoryError("");
    createCategory(
      {
        data: {
          name,
          nameAr,
          nameKu: "",
          imageUrl: categoryForm.imageUrl || null,
          sortOrder: (categories?.length ?? 0) + 1,
        },
      },
      {
        onSuccess: async () => {
          await refetchCategories();
          setCategoryForm(EMPTY_CATEGORY_FORM);
          setShowAddCategory(false);
        },
        onError: (err: any) =>
          setCategoryError(err?.data?.error || err?.message || "تعذر الحفظ"),
      }
    );
  };

  const handleSaveEditCategory = (cat: MenuCategory) => {
    const nameAr = editForm.nameAr.trim();
    const name = editForm.name.trim() || nameAr;
    if (!nameAr) {
      setCategoryError("الاسم العربي مطلوب");
      return;
    }
    setCategoryError("");
    updateCategory(
      {
        id: cat.id,
        data: {
          name,
          nameAr,
          nameKu: cat.nameKu ?? "",
          icon: cat.icon ?? undefined,
          imageUrl: editForm.imageUrl || null,
          sortOrder: cat.sortOrder ?? undefined,
        },
      },
      {
        onSuccess: async () => {
          await refetchCategories();
          await refetch();
          cancelEditCategory();
        },
        onError: (err: any) =>
          setCategoryError(err?.data?.error || err?.message || "تعذر الحفظ"),
      }
    );
  };

  const handleDeleteCategory = (cat: MenuCategory) => {
    if (!confirm(`حذف التصنيف «${cat.nameAr}»؟`)) return;
    deleteCategory(
      { id: cat.id },
      {
        onSuccess: async () => {
          await refetchCategories();
          await refetch();
          if (editingCategoryId === cat.id) cancelEditCategory();
        },
      }
    );
  };

  const columns = [
    { key: "nameAr", header: "الاسم (عربي)" },
    { key: "name", header: "الاسم (إنجليزي)" },
    {
      key: "price",
      header: "السعر",
      render: (item: MenuItem) => (
        <span className="text-primary font-display font-bold">
          {new Intl.NumberFormat("en-IQ").format(item.price)} د.ع
        </span>
      ),
    },
    {
      key: "categoryId",
      header: "التصنيف",
      render: (item: MenuItem) => categories?.find((c) => c.id === item.categoryId)?.nameAr,
    },
    {
      key: "branchIds",
      header: "الفروع",
      render: (item: MenuItem) => {
        if (item.allBranches !== false || !(item.branchIds?.length)) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary border border-primary/25">
              جميع الفروع
            </span>
          );
        }
        const names = item.branchIds
          .map((id) => branches?.find((b) => b.id === id)?.name)
          .filter(Boolean);
        return (
          <span className="text-xs font-semibold text-foreground">
            {names.length ? names.join(" · ") : `${item.branchIds.length} فرع`}
          </span>
        );
      },
    },
    {
      key: "isAvailable",
      header: "الحالة",
      render: (item: MenuItem) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold ${
            item.isAvailable ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
          }`}
        >
          {item.isAvailable ? "متاح" : "غير متاح"}
        </span>
      ),
    },
  ];

  return (
    <>
      <CrudTable<MenuItem>
        title="إدارة المنيو"
        titleEn="Menu Management"
        data={items}
        columns={columns}
        isLoading={isLoading}
        searchKey="nameAr"
        onAdd={() => handleOpen()}
        onEdit={handleOpen}
        onDelete={(item) => {
          if (confirm("هل أنت متأكد من الحذف؟")) {
            remove({ id: item.id }, { onSuccess: () => refetch() });
          }
        }}
        headerActions={
          <Button
            type="button"
            variant="outline"
            onClick={openCategoryManager}
            className="rounded-full h-9 text-sm flex-shrink-0 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
          >
            <Tags className="w-4 h-4 me-1.5" />
            التصنيفات
          </Button>
        }
      />

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={editing ? "تعديل صنف" : "إضافة صنف"}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">الاسم (عربي)</label>
            <Input
              value={formData.nameAr}
              onChange={(e) => setFormData((f) => ({ ...f, nameAr: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">الاسم (إنجليزي)</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">السعر (د.ع)</label>
            <Input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData((f) => ({ ...f, price: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">التصنيف</label>
            <Select
              value={formData.categoryId}
              onChange={(e) => setFormData((f) => ({ ...f, categoryId: Number(e.target.value) }))}
            >
              <option value={0} disabled>
                اختر تصنيف...
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primary" />
              الفروع <span className="text-destructive">*</span>
            </label>
            <div className="rounded-2xl border border-border/60 bg-secondary/20 p-3 space-y-2.5">
              <button
                type="button"
                onClick={selectAllBranches}
                className={`w-full h-11 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  formData.allBranches
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "border-border bg-background/60 text-foreground hover:border-primary/40"
                }`}
              >
                <Check className={`w-4 h-4 ${formData.allBranches ? "opacity-100" : "opacity-30"}`} />
                جميع الفروع
              </button>

              {(branches?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  لا توجد فروع مسجّلة — سيتم اعتبار الصنف لكل الفروع
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {branches!.map((b) => {
                    const selected = !formData.allBranches && formData.branchIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBranch(b.id)}
                        className={`h-11 px-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center gap-2 text-start ${
                          selected
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background/50 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                            selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="truncate">{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                اختر «جميع الفروع» أو حدد فرعاً واحداً أو أكثر
              </p>
            </div>
          </div>

          {formError && (
            <p className="text-sm font-semibold text-destructive">{formError}</p>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit}>{editing ? "حفظ التعديلات" : "إضافة"}</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isCategoryOpen}
        onClose={() => setIsCategoryOpen(false)}
        title="إدارة التصنيفات"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-amber-500 text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25 flex-shrink-0">
                <FolderPlus className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">قائمة التصنيفات</p>
                <p className="text-[11px] text-muted-foreground">
                  {categories?.length ?? 0} تصنيف — صورة PNG / JPG / WEBP / GIF
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setShowAddCategory((v) => !v);
                setEditingCategoryId(null);
                setCategoryForm(EMPTY_CATEGORY_FORM);
                setCategoryError("");
              }}
              className="rounded-full h-9 flex-shrink-0"
            >
              {showAddCategory ? (
                <>
                  <X className="w-4 h-4 me-1" />
                  إغلاق
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 me-1" />
                  إضافة
                </>
              )}
            </Button>
          </div>

          {showAddCategory && (
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-l from-primary/10 via-amber-500/5 to-transparent p-3 sm:p-4">
              <input
                ref={addImageInputRef}
                type="file"
                accept={CATEGORY_IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  void pickCategoryImage(e.target.files?.[0], "add");
                  e.target.value = "";
                }}
              />
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <button
                  type="button"
                  onClick={() => addImageInputRef.current?.click()}
                  className="relative group w-full lg:w-[7.5rem] h-[4.5rem] lg:h-[3.25rem] rounded-2xl border-2 border-dashed border-primary/35 bg-background/60 hover:border-primary/60 hover:bg-primary/5 transition-colors overflow-hidden flex-shrink-0"
                  title="رفع صورة التصنيف"
                >
                  {categoryForm.imageUrl ? (
                    <img
                      src={categoryForm.imageUrl}
                      alt="معاينة"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-primary">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[10px] font-bold">صورة</span>
                    </span>
                  )}
                </button>

                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold mb-1 block text-muted-foreground">
                      الاسم (عربي) *
                    </label>
                    <Input
                      placeholder="مثال: مشروبات"
                      value={categoryForm.nameAr}
                      onChange={(e) =>
                        setCategoryForm((f) => ({ ...f, nameAr: e.target.value }))
                      }
                      className="h-11"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold mb-1 block text-muted-foreground">
                      الاسم (إنجليزي)
                    </label>
                    <Input
                      placeholder="e.g. Drinks"
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {categoryForm.imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11"
                      onClick={() => setCategoryForm((f) => ({ ...f, imageUrl: "" }))}
                    >
                      إزالة الصورة
                    </Button>
                  )}
                  <Button
                    type="button"
                    className="h-11 px-5"
                    isLoading={isCreatingCategory}
                    onClick={handleCreateCategory}
                  >
                    <Plus className="w-4 h-4 me-1" />
                    حفظ
                  </Button>
                </div>
              </div>
              {categoryError && !editingCategoryId && (
                <p className="text-xs font-semibold text-destructive mt-2">{categoryError}</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border/60 overflow-hidden bg-secondary/20 max-h-[22rem] overflow-y-auto">
            {!categories?.length ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                لا توجد تصنيفات بعد — اضغط إضافة لإنشاء أول تصنيف
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {categories.map((cat) => {
                  const isEditing = editingCategoryId === cat.id;
                  return (
                    <li key={cat.id} className="p-3 sm:p-3.5 hover:bg-secondary/40 transition-colors">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            ref={editImageInputRef}
                            type="file"
                            accept={CATEGORY_IMAGE_ACCEPT}
                            className="hidden"
                            onChange={(e) => {
                              void pickCategoryImage(e.target.files?.[0], "edit");
                              e.target.value = "";
                            }}
                          />
                          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => editImageInputRef.current?.click()}
                              className="relative w-full lg:w-14 h-14 rounded-xl border border-border/60 overflow-hidden flex-shrink-0 bg-background/70"
                              title="تغيير الصورة"
                            >
                              {editForm.imageUrl ? (
                                <img
                                  src={editForm.imageUrl}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                <span className="absolute inset-0 flex items-center justify-center text-primary">
                                  <ImagePlus className="w-5 h-5" />
                                </span>
                              )}
                            </button>
                            <Input
                              value={editForm.nameAr}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, nameAr: e.target.value }))
                              }
                              placeholder="الاسم العربي"
                              className="h-11 flex-1"
                              autoFocus
                            />
                            <Input
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, name: e.target.value }))
                              }
                              placeholder="English name"
                              className="h-11 flex-1"
                            />
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-11"
                                onClick={cancelEditCategory}
                              >
                                <X className="w-4 h-4 me-1" />
                                إلغاء
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-11"
                                isLoading={isUpdatingCategory}
                                onClick={() => handleSaveEditCategory(cat)}
                              >
                                <Check className="w-4 h-4 me-1" />
                                حفظ
                              </Button>
                            </div>
                          </div>
                          {categoryError && editingCategoryId === cat.id && (
                            <p className="text-xs font-semibold text-destructive">{categoryError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <CategoryImageThumb src={cat.imageUrl} alt={cat.nameAr} />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-foreground truncate">{cat.nameAr}</p>
                            {cat.name && (
                              <p className="text-xs text-muted-foreground truncate font-display">
                                {cat.name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-primary"
                              onClick={() => startEditCategory(cat)}
                              aria-label="تعديل التصنيف"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              disabled={isDeletingCategory}
                              onClick={() => handleDeleteCategory(cat)}
                              aria-label="حذف التصنيف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setIsCategoryOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
