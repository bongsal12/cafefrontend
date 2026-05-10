"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { InventoryApi } from "@/app/lib/inventory";
import type { InventoryItem, InventoryMovement } from "@/app/types/entities";
import { InventoryItemDialog } from "@/components/inventory/inventory-item-dialog";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MoveType = "in" | "out";

const IMAGE_BASE =
  process.env.NEXT_PUBLIC_IMAGE_BASE_URL ??
  process.env.NEXT_PUBLIC_IMAGEPATH ??
  "http://127.0.0.1:8000/storage";

function imgUrl(image?: string | null) {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;

  const base = IMAGE_BASE.replace(/\/$/, "");
  const origin = base.replace(/\/storage$/, "");
  const normalized = image.replace(/^\/+/, "");

  if (normalized.startsWith("storage/") && base.endsWith("/storage")) {
    return `${origin}/${normalized}`;
  }

  return `${base}/${normalized}`;
}

function fmtQty(n: number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function fmtTime(v?: string) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export function InventoryPanel() {
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedItem = useMemo(
    () => items.find((x) => x.id === selectedId) ?? null,
    [items, selectedId]
  );

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [unit, setUnit] = useState("unit");
  const [lowStockAlert, setLowStockAlert] = useState(0);

  const [moveType, setMoveType] = useState<MoveType>("in");
  const [moveQty, setMoveQty] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await InventoryApi.list({ search, lowOnly });
      setItems(data);

      if (!selectedId && data[0]) {
        setSelectedId(data[0].id);
      } else if (selectedId && !data.some((x) => x.id === selectedId)) {
        setSelectedId(data[0]?.id ?? null);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  async function loadMovements(productId: number) {
    setHistoryLoading(true);
    try {
      const rows = await InventoryApi.movements(productId, 50);
      setMovements(rows);
    } catch (e: any) {
      toast.error(e.message || "Failed to load movement history");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowOnly]);

  useEffect(() => {
    if (!selectedItem) return;
    setUnit(selectedItem.unit || "unit");
    setLowStockAlert(Number(selectedItem.low_stock_alert || 0));
    loadMovements(selectedItem.id);
  }, [selectedItem?.id]);

  async function updateSettings() {
    if (!selectedItem) return;
    if (!unit.trim()) return toast.error("Unit is required");
    if (lowStockAlert < 0) return toast.error("Low stock alert must be >= 0");

    setSubmitting(true);
    try {
      await InventoryApi.updateSettings(selectedItem.id, {
        unit: unit.trim(),
        low_stock_alert: Number(lowStockAlert),
      });
      toast.success("Inventory settings updated");
      await loadItems();
    } catch (e: any) {
      toast.error(e.message || "Update settings failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMovement() {
    if (!selectedItem) return;
    if (moveQty <= 0) return toast.error("Quantity must be greater than 0");

    setSubmitting(true);
    try {
      await InventoryApi.moveStock({
        inventory_item_id: selectedItem.id,
        type: moveType,
        quantity: Number(moveQty),
        note: note.trim() || undefined,
      });

      toast.success(moveType === "in" ? "Stock in recorded" : "Stock out recorded");
      setMoveQty(0);
      setNote("");
      await loadItems();
      await loadMovements(selectedItem.id);
    } catch (e: any) {
      toast.error(e.message || "Stock movement failed");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(item: InventoryItem) {
    setEditingItem(item);
    setEditOpen(true);
  }

  async function deleteItem(item: InventoryItem) {
    const ok = window.confirm(`Delete ${item.name}? This cannot be undone.`);
    if (!ok) return;

    setSubmitting(true);
    try {
      await InventoryApi.remove(item.id);
      toast.success("Inventory item deleted");
      if (selectedId === item.id) {
        setSelectedId(null);
      }
      await loadItems();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-muted-foreground">Total Items</div>
          <div className="text-2xl font-semibold">{items.length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-muted-foreground">In Stock</div>
          <div className="text-2xl font-semibold">{items.filter((i) => i.current_stock > 0).length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-muted-foreground">Low Stock</div>
          <div className="text-2xl font-semibold">{items.filter((i) => i.is_low_stock).length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-muted-foreground">Total Stock</div>
          <div className="text-2xl font-semibold">{items.reduce((s, it) => s + (it.current_stock||0), 0)}</div>
        </div>
      </div>
      <Card className="rounded-3xl">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Inventory</CardTitle>
            
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Input
              className="md:w-80"
              placeholder="Search item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadItems();
              }}
            />
            <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((v) => !v)}>
              Low Stock
            </Button>
            <Button variant="default" onClick={() => setAddOpen(true)}>
              + Add Item
            </Button>
            <Button variant="secondary" onClick={loadItems}>
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading inventory...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Low Stock Alert</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      {it.image ? (
                        <img
                          src={imgUrl(it.image)}
                          alt={it.name}
                          className="h-10 w-10 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
                          No img
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{it.slug}</div>
                    </TableCell>
                    <TableCell>{fmtQty(it.current_stock)}</TableCell>
                    <TableCell>{it.unit}</TableCell>
                    <TableCell>{fmtQty(it.low_stock_alert)}</TableCell>
                    <TableCell>
                      {it.is_low_stock ? (
                        <Badge variant="destructive">Low</Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Action
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedId(it.id)}>
                            {selectedId === it.id ? "Selected" : "Select"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(it)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => deleteItem(it)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedItem && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Stock Controls</CardTitle>
              <CardDescription>{selectedItem.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {selectedItem.image ? (
                  <img
                    src={imgUrl(selectedItem.image)}
                    alt={selectedItem.name}
                    className="h-16 w-16 rounded-xl border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">
                    No image
                  </div>
                )}
                <div>
                  <div className="font-medium">{selectedItem.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedItem.slug}</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Current Stock</Label>
                  <Input disabled value={fmtQty(selectedItem.current_stock)} />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="cup / bottle / g / ml" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Low Stock Alert</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={String(lowStockAlert)}
                    onChange={(e) => setLowStockAlert(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-end">
                  <Button className="w-full" variant="secondary" disabled={submitting} onClick={updateSettings}>
                    Save Alert + Unit
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Movement</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={moveType}
                    onChange={(e) => setMoveType(e.target.value as MoveType)}
                  >
                    <option value="in">Stock In</option>
                    <option value="out">Stock Out</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    value={String(moveQty)}
                    onChange={(e) => setMoveQty(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier receipt, spoilage..." />
                </div>
              </div>

              <div className="flex justify-end">
                <Button disabled={submitting} onClick={submitMovement}>
                  {moveType === "in" ? "Stock In" : "Stock Out"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>History Of Movements</CardTitle>
              <CardDescription>Latest 50 logs</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-sm text-muted-foreground">Loading movement history...</div>
              ) : movements.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No movement history yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge variant={m.type === "out" ? "destructive" : "secondary"}>{m.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {fmtQty(m.quantity)} {m.unit}
                        </TableCell>
                        <TableCell>{fmtQty(m.before_stock)}</TableCell>
                        <TableCell>{fmtQty(m.after_stock)}</TableCell>
                        <TableCell className="max-w-55 truncate">{m.note || "-"}</TableCell>
                        <TableCell>{m.created_by_name || "System"}</TableCell>
                        <TableCell>{fmtTime(m.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <InventoryItemDialog
        open={addOpen}
        onOpenChange={(v) => setAddOpen(v)}
        onSaved={async (item) => {
          setAddOpen(false);
          await loadItems();
          setSelectedId(item?.id ?? null);
        }}
      />
      <InventoryItemDialog
        open={editOpen}
        item={editingItem}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditingItem(null);
        }}
        onSaved={async (item) => {
          setEditOpen(false);
          setEditingItem(null);
          await loadItems();
          setSelectedId(item?.id ?? selectedId);
        }}
      />
    </div>
  );
}
