import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Input, Card } from "./ui-elements";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface CrudTableProps<T> {
  title: string;
  titleEn: string;
  data: T[] | undefined;
  columns: Column<T>[];
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  searchKey?: keyof T;
  isLoading?: boolean;
  /** Extra header actions (rendered before the main Add button) */
  headerActions?: React.ReactNode;
}

export function CrudTable<T extends { id: number }>({
  title, titleEn, data, columns, onAdd, onEdit, onDelete, searchKey, isLoading, headerActions
}: CrudTableProps<T>) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const filteredData = React.useMemo(() => {
    if (!data) return [];
    if (!search || !searchKey) return data;
    return data.filter((item) => {
      const val = item[searchKey];
      return String(val).toLowerCase().includes(search.toLowerCase());
    });
  }, [data, search, searchKey]);

  return (
    <Card className="flex flex-col border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-xs text-primary font-display tracking-widest uppercase">{titleEn}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {searchKey && (
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                className="pr-10 h-9 rounded-full bg-secondary/50 border-transparent text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {headerActions}
          {onAdd && (
            <Button onClick={onAdd} className="rounded-full h-9 text-sm flex-shrink-0">
              <Plus className="w-4 h-4 me-1.5" /> {t("common.add")}
            </Button>
          )}
        </div>
      </div>

      {/* ── MOBILE: Card list (< md) ── */}
      <div className="md:hidden divide-y divide-border/30">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{t("common.noData")}</div>
        ) : (
          filteredData.map((item) => (
            <div key={item.id} className="p-4 flex flex-col gap-2 hover:bg-secondary/30 transition-colors">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {columns.map((col, idx) => (
                  <div key={String(col.key) + idx} className={columns.length === 1 ? "col-span-2" : ""}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{col.header}</p>
                    <div className="text-sm font-medium">
                      {col.render ? col.render(item) : String(item[col.key as keyof T] || "—")}
                    </div>
                  </div>
                ))}
              </div>
              {(onEdit || onDelete) && (
                <div className="flex gap-2 pt-1">
                  {onEdit && (
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => onEdit(item)}>
                      <Edit className="w-3.5 h-3.5" /> {t("common.edit")}
                    </Button>
                  )}
                  {onDelete && (
                    <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => onDelete(item)}>
                      <Trash2 className="w-3.5 h-3.5" /> {t("common.delete")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── DESKTOP: Table (≥ md) ── */}
      <div className="hidden md:block overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              {columns.map((col, idx) => (
                <TableHead key={String(col.key) + idx} className="text-primary font-bold">
                  {col.header}
                </TableHead>
              ))}
              {(onEdit || onDelete) && (
                <TableHead className="text-end text-primary font-bold">{t("common.actions")}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-10">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-10 text-muted-foreground">
                  {t("common.noData")}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow key={item.id} className="border-border/20 group">
                  {columns.map((col, idx) => (
                    <TableCell key={String(col.key) + idx} className="font-medium">
                      {col.render ? col.render(item) : String(item[col.key as keyof T] || "")}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => onEdit(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(item)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
