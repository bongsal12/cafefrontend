"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventoryApi } from "@/app/lib/inventory";
import type { InventoryItem } from "@/app/types/entities";

export function InventoryItemDialog({
  open,
  onOpenChange,
  onSaved,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (item: InventoryItem) => void;
  item?: InventoryItem | null;
}) {
  const isEdit = !!item;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [unit, setUnit] = useState("unit");
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [lowStockAlert, setLowStockAlert] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setSlug(item?.slug ?? "");
    setImageFile(null);
    setUnit(item?.unit ?? "unit");
    setCurrentStock(Number(item?.current_stock ?? 0));
    setLowStockAlert(Number(item?.low_stock_alert ?? 0));
  }, [open, item]);

  async function save() {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      let res: InventoryItem;

      if (isEdit && item) {
        // Edit: only send fields that updateSettings accepts
        const editPayload = {
          name: name.trim(),
          slug: slug ? slug.trim() : undefined,
          imageFile,
          unit: unit || "unit",
          low_stock_alert: lowStockAlert,
        };
        console.log("Edit payload:", editPayload, "Item ID:", item.id);
        res = await InventoryApi.updateSettings(item.id, editPayload);
        console.log("Edit response:", res);
      } else {
        // Create: send all fields including current_stock
        const createPayload = {
          name: name.trim(),
          slug: slug ? slug.trim() : undefined,
          imageFile,
          current_stock: currentStock,
          unit: unit || "unit",
          low_stock_alert: lowStockAlert,
        };
        console.log("Create payload:", createPayload);
        res = await InventoryApi.create(createPayload);
        console.log("Create response:", res);
      }

      toast.success(isEdit ? "Updated" : "Created");
      onOpenChange(false);
      onSaved(res);
    } catch (e: any) {
      console.error("Save error:", e);
      toast.error(e?.message || (isEdit ? "Update failed" : "Create failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-110">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Image</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            {imageFile ? <div className="text-xs text-muted-foreground">Attached: {imageFile.name}</div> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <Label>{isEdit ? "Current Stock" : "Initial Stock"}</Label>
              <Input type="number" value={String(currentStock)} onChange={(e) => setCurrentStock(Number(e.target.value))} disabled={isEdit} />
            </div>
            <div>
              <Label>Low Stock Alert</Label>
              <Input type="number" value={String(lowStockAlert)} onChange={(e) => setLowStockAlert(Number(e.target.value))} />
            </div>
          </div>

          {isEdit ? (
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              Current stock is adjusted from the stock controls below.
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
