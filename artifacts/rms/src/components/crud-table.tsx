import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Input, Card } from "./ui-elements";
import { Plus, Search, Edit, Trash2, Printer } from "lucide-react";
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
  /** When set, hide edit for rows that return false */
  canEdit?: (item: T) => boolean;
  /** When set, hide delete for rows that return false */
  canDelete?: (item: T) => boolean;
  /** Optional thermal / print action per row */
  onPrint?: (item: T) => void;
  searchKey?: keyof T;
  isLoading?: boolean;
  /** Hide the built-in search box (use toolbar filters instead) */
  hideSearch?: boolean;
  /** Extra header actions (rendered before the main Add button) */
  headerActions?: React.ReactNode;
  /** Extra filter/search row rendered under the header, inside the card */
  toolbar?: React.ReactNode;
}

export function CrudTable<T extends { id: number }>({
  title, titleEn, data, columns, onAdd, onEdit, onDelete, canEdit, canDelete, onPrint, searchKey, isLoading, hideSearch, headerActions, toolbar
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
    <Card className="flex flex-col border border-white/5 overflow-hidden touch-ui">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-xs text-primary font-display tracking-widest uppercase">{titleEn}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {searchKey && !hideSearch && (
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                className="pr-11 h-12 rounded-full bg-secondary/50 border-transparent text-[16px] font-bold"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {headerActions}
          {onAdd && (
            <Button
              onClick={onAdd}
              className="rounded-full min-h-14 h-14 px-6 text-[17px] font-bold flex-shrink-0 touch-manipulation"
            >
              <Plus className="w-6 h-6 me-1.5" /> {t("common.add")}
            </Button>
          )}
        </div>
      </div>

      {toolbar ? (
        <div className="px-4 md:px-6 py-4 border-b border-border/40 bg-secondary/20">
          {toolbar}
        </div>
      ) : null}

      {/* ── MOBILE: Card list (< md) ── */}
      <div className="md:hidden divide-y divide-border/30">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-[16px] font-bold">
            {t("common.noData")}
          </div>
        ) : (
          filteredData.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 flex flex-col gap-3.5 hover:bg-secondary/30 transition-colors touch-manipulation"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {columns.map((col, idx) => (
                  <div key={String(col.key) + idx} className={columns.length === 1 ? "col-span-2" : ""}>
                    <p className="text-[13px] text-muted-foreground font-bold mb-1">{col.header}</p>
                    <div className="text-[16px] font-bold">
                      {col.render ? col.render(item) : String(item[col.key as keyof T] || "—")}
                    </div>
                  </div>
                ))}
              </div>
              {(onEdit || onDelete || onPrint) && (
                <div className="flex gap-3 pt-1">
                  {onPrint && (
                    <Button
                      variant="outline"
                      className="flex-1 min-h-14 h-14 text-[16px] font-bold gap-2 touch-manipulation"
                      onClick={() => onPrint(item)}
                    >
                      <Printer className="w-5 h-5" /> {t("common.print")}
                    </Button>
                  )}
                  {onEdit && (canEdit?.(item) !== false) && (
                    <Button
                      variant="outline"
                      className="flex-1 min-h-14 h-14 text-[16px] font-bold gap-2 touch-manipulation"
                      onClick={() => onEdit(item)}
                    >
                      <Edit className="w-5 h-5" /> {t("common.edit")}
                    </Button>
                  )}
                  {onDelete && (canDelete?.(item) !== false) && (
                    <Button
                      variant="ghost"
                      className="flex-1 min-h-14 h-14 text-[16px] font-bold gap-2 text-destructive hover:bg-destructive/10 touch-manipulation"
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 className="w-5 h-5" /> {t("common.delete")}
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
                <TableHead
                  key={String(col.key) + idx}
                  className="text-primary text-[15px] font-bold py-3"
                >
                  {col.header}
                </TableHead>
              ))}
              {(onEdit || onDelete || onPrint) && (
                <TableHead className="text-end text-primary text-[15px] font-bold py-3">
                  {t("common.actions")}
                </TableHead>
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
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center py-10 text-muted-foreground text-[16px] font-bold"
                >
                  {t("common.noData")}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow key={item.id} className="border-border/20 crud-touch-row">
                  {columns.map((col, idx) => (
                    <TableCell key={String(col.key) + idx} className="text-[15px] font-bold py-3">
                      {col.render ? col.render(item) : String(item[col.key as keyof T] || "")}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete || onPrint) && (
                    <TableCell className="text-end py-3">
                      <div className="flex justify-end gap-2.5">
                        {onPrint && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-14 min-w-14 h-14 w-14 text-muted-foreground hover:text-primary touch-manipulation"
                            title={t("common.print")}
                            onClick={() => onPrint(item)}
                          >
                            <Printer className="w-6 h-6" />
                          </Button>
                        )}
                        {onEdit && (canEdit?.(item) !== false) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-14 min-w-14 h-14 w-14 text-muted-foreground hover:text-primary touch-manipulation"
                            onClick={() => onEdit(item)}
                          >
                            <Edit className="w-6 h-6" />
                          </Button>
                        )}
                        {onDelete && (canDelete?.(item) !== false) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-14 min-w-14 h-14 w-14 text-muted-foreground hover:text-destructive touch-manipulation"
                            onClick={() => onDelete(item)}
                          >
                            <Trash2 className="w-6 h-6" />
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
