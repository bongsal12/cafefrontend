"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Category, Product, ProductType } from "@/app/types/entities";
import { apiPost, apiPatch } from "@/app/lib/api";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

type VariantInput = { size: string; price: number };

export function ProductDialog({
  open,
  onOpenChange,
  editing,
  categories,
  types,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Product | null;
  categories: Category[];
  types: ProductType[];
  onLookupsChanged: () => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState<number>(0);
  const [typeId, setTypeId] = useState<number>(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [variants, setVariants] = useState<VariantInput[]>([{ size: "regular", price: 0 }]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!categoryId || !typeId) return false;
    if (!variants.length) return false;
    if (variants.some((v) => !v.size.trim())) return false;
    if (new Set(variants.map((v) => v.size.trim())).size !== variants.length) return false;
    if (variants.some((v) => isNaN(v.price) || v.price < 0)) return false;
    return true;
  }, [name, categoryId, typeId, variants]);

  useEffect(() => {
    if (!open) return;

    if (editing) {
      setCategoryId(editing.category_id);
      setTypeId(editing.product_type_id);
      setName(editing.name);
      setSlug(editing.slug);
      setVariants(
        (editing.variants ?? []).length
          ? editing.variants.map((v) => ({ size: v.size, price: Number(v.price) }))
          : [{ size: "regular", price: 0 }]
      );
      setImageFile(null);
      return;
    }

    // create mode defaults
    setCategoryId(categories[0]?.id ?? 0);
    setTypeId(types[0]?.id ?? 0);
    setName("");
    setSlug("");
    setVariants([{ size: "regular", price: 0 }]);
    setImageFile(null);
  }, [open, editing, categories, types]);

  function addVariant() {
    setVariants((p) => [...p, { size: "", price: 0 }]);
  }
  function updateVariant(i: number, patch: Partial<VariantInput>) {
    setVariants((p) => p.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function removeVariant(i: number) {
    setVariants((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)));
  }

  async function save() {
    if (!canSave) return toast.error("Please fill all fields correctly.");
    setSaving(true);

    try {
      // Use FormData for image + variants JSON
      const fd = new FormData();
      fd.append("category_id", String(categoryId));
      fd.append("product_type_id", String(typeId));
      fd.append("name", name.trim());
      fd.append("slug", (slug || slugify(name)).trim());
      fd.append("variants", JSON.stringify(variants.map((v) => ({ size: v.size.trim(), price: Number(v.price) }))));

      if (imageFile) fd.append("image", imageFile);

      if (editing) {
        fd.append("_method", "PATCH");
        await apiPost(`/products/${editing.id}`, fd);
      } else {
        await apiPost(`/products`, fd);
      }

      toast.success(editing ? "Product updated" : "Product created");
      onOpenChange(false);
      await onSaved();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-180">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Product Type</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={typeId}
              onChange={(e) => setTypeId(Number(e.target.value))}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Iced Latte" />
          </div>

          <div className="space-y-2">
            <Label>Slug (optional)</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="iced-latte" />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label>Image</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Variants</div>
              <div className="text-xs text-muted-foreground">Sizes must be unique.</div>
            </div>
            <Button variant="secondary" onClick={addVariant}>
              + Add Variant
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Input value={v.size} onChange={(e) => updateVariant(i, { size: e.target.value })} placeholder="regular" />
                </div>

                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={String(v.price)}
                    onChange={(e) => updateVariant(i, { price: Number(e.target.value) })}
                    placeholder="2.50"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={variants.length === 1}
                    onClick={() => removeVariant(i)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave || saving} onClick={save}>
            {saving ? "Saving…" : editing ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}