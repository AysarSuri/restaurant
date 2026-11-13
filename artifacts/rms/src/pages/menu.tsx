import React, { useState } from "react";
import {
  useGetMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useGetMenuCategories,
  useCreateMenuCategory,
  useUpdateMenuCategory,
  useDeleteMenuCategory,
  type MenuCategory,
  type MenuItem,
} from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Dialog, Input, Button, Select } from "@/components/ui-elements";
import { Check, FolderPlus, Pencil, Plus, Tags, Trash2, X } from "lucide-react";

export default function Menu() {
  const { data: items, isLoading, refetch } = useGetMenuItems();
  const { data: categories, refetch: refetchCategories } = useGetMenuCategories();
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
  const [categoryForm, setCategoryForm] = useState({ nameAr: "", name: "" });
  const [editForm, setEditForm] = useState({ nameAr: "", name: "" });
  const [categoryError, setCategoryError] = useState("");

  const [formData, setFormData] = useState({
    nameAr: "",
    name: "",
    price: 0,
    categoryId: 0,
    isAvailable: true,
  });

  const handleOpen = (item?: MenuItem) => {
    if (item) {
      setEditing(item);
      setFormData({
        nameAr: item.nameAr,
        name: item.name,
        price: item.price,
        categoryId: item.categoryId,
        isAvailable: item.isAvailable,
      });
    } else {
      setEditing(null);
      setFormData({
        nameAr: "",
        name: "",
        price: 0,
        categoryId: categories?.[0]?.id || 0,
        isAvailable: true,
      });
    }
    setIsOpen(true);
  };

  const handleSubmit = () => {
    const data = { ...formData, nameKu: "", description: "", descriptionAr: "" };
    if (editing) {
      update({ id: editing.id, data }, { onSuccess: () => { setIsOpen(false); refetch(); } });
    } else {
      create({ data }, { onSuccess: () => { setIsOpen(false); refetch(); } });
    }
  };

  const openCategoryManager = () => {
    setShowAddCategory(false);
    setEditingCategoryId(null);
    setCategoryForm({ nameAr: "", name: "" });
    setCategoryError("");
    setIsCategoryOpen(true);
  };

  const startEditCategory = (cat: MenuCategory) => {
    setShowAddCategory(false);
    setEditingCategoryId(cat.id);
    setEditForm({ nameAr: cat.nameAr, name: cat.name });
    setCategoryError("");
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditForm({ nameAr: "", name: "" });
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
          sortOrder: (categories?.length ?? 0) + 1,
        },
      },
      {
        onSuccess: async () => {
          await refetchCategories();
          setCategoryForm({ nameAr: "", name: "" });
          setShowAddCategory(false);
        },
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
          sortOrder: cat.sortOrder ?? undefined,
        },
      },
      {
        onSuccess: async () => {
          await refetchCategories();
          await refetch();
          cancelEditCategory();
        },
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
          <div className="pt-4 flex justify-end gap-2">
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
        maxWidth="max-w-lg"
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
                  {categories?.length ?? 0} تصنيف
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setShowAddCategory((v) => !v);
                setEditingCategoryId(null);
                setCategoryForm({ nameAr: "", name: "" });
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
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-amber-500/5 to-transparent p-4 space-y-3">
              <p className="text-sm font-bold text-foreground">تصنيف جديد</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted-foreground">
                    الاسم (عربي) *
                  </label>
                  <Input
                    placeholder="مثال: مشروبات"
                    value={categoryForm.nameAr}
                    onChange={(e) => setCategoryForm((f) => ({ ...f, nameAr: e.target.value }))}
                    className="h-11"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block text-muted-foreground">
                    الاسم (إنجليزي)
                  </label>
                  <Input
                    placeholder="e.g. Drinks"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-11"
                  />
                </div>
              </div>
              {categoryError && !editingCategoryId && (
                <p className="text-xs font-semibold text-destructive">{categoryError}</p>
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  isLoading={isCreatingCategory}
                  onClick={handleCreateCategory}
                >
                  <Plus className="w-4 h-4 me-1" />
                  حفظ التصنيف
                </Button>
              </div>
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
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={editForm.nameAr}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, nameAr: e.target.value }))
                              }
                              placeholder="الاسم العربي"
                              className="h-10"
                              autoFocus
                            />
                            <Input
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, name: e.target.value }))
                              }
                              placeholder="English name"
                              className="h-10"
                            />
                          </div>
                          {categoryError && editingCategoryId === cat.id && (
                            <p className="text-xs font-semibold text-destructive">{categoryError}</p>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9"
                              onClick={cancelEditCategory}
                            >
                              <X className="w-4 h-4 me-1" />
                              إلغاء
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-9"
                              isLoading={isUpdatingCategory}
                              onClick={() => handleSaveEditCategory(cat)}
                            >
                              <Check className="w-4 h-4 me-1" />
                              حفظ
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                            <Tags className="w-4 h-4" />
                          </div>
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
