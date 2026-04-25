"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ProductType } from "@/app/types/entities";
import { apiDel, apiPost, apiPatch } from "@/app/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function ProductTypesPanel({
  types,
  onChanged,
}: {
  types: ProductType[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductType | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  function openCreate() {
    setEditing(null);
    setName("");
    setSlug("");
    setOpen(true);
  }

  function openEdit(t: ProductType) {
    setEditing(t);
    setName(t.name);
    setSlug(t.slug);
    setOpen(true);
  }

  async function save() {
    try {
      const payload = { name: name.trim(), slug: (slug || slugify(name)).trim() };
      if (!payload.name) return toast.error("Name is required.");

      if (editing) await apiPatch(`/product-types/${editing.id}`, payload);
      else await apiPost(`/product-types`, payload);

      toast.success(editing ? "Product type updated" : "Product type created");
      setOpen(false);
      await onChanged();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this product type?")) return;
    try {
      await apiDel(`/product-types/${id}`);
      toast.success("Product type deleted");
      await onChanged();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Product Types</CardTitle>
        <Button onClick={openCreate}>+ Add Product Type</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {types.length === 0 ? (
          <div className="text-sm text-muted-foreground">No product types yet.</div>
        ) : (
          types.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.slug}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openEdit(t)}>
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => remove(t.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product Type" : "Add Product Type"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee" />
            </div>
            <div className="space-y-2">
              <Label>Slug (optional)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="coffee" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}