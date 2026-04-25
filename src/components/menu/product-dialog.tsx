"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Category, Product, ProductType } from "@/app/types/entities";
import { ProductsApi } from "@/app/lib/products";
import { slugify } from "@/app/lib/slug";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CategoryDialog } from "@/components/menu/category-dialog";
import { ProductTypeDialog } from "@/components/menu/product-type-dialog";

type VariantRow = { size: string; price: number };

const sizeOptions = ["regular", "medium", "large"];

export function ProductDialog({
  open,
  onOpenChange,
  editing,
  categories,
  types,
  onRefresh,
  onCategoryCreated,
  onTypeCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Product | null;
  categories: Category[];
  types: ProductType[];
  onRefresh: () => Promise<void>;
  onCategoryCreated: (c: Category) => void;
  onTypeCreated: (t: ProductType) => void;
}) {
  const isEdit = Boolean(editing?.id);

  const [categoryId, setCategoryId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([{ size: "regular", price: 0 }]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);

  const [catOpen, setCatOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editing) {
      setCategoryId(String(editing.category_id));
      setTypeId(String(editing.product_type_id));
      setName(editing.name);
      setSlug(editing.slug);
      setVariants(
        editing.variants?.length
          ? editing.variants.map((v) => ({ size: v.size, price: Number(v.price) }))
          : [{ size: "regular", price: 0 }]
      );
      setImageFile(null);
      return;
    }

    // create
    setCategoryId(categories[0] ? String(categories[0].id) : "");
    setTypeId(types[0] ? String(types[0].id) : "");
    setName("");
    setSlug("");
    setVariants([{ size: "regular", price: 0 }]);
    setImageFile(null);
  }, [open, editing, categories, types]);

  const autoSlug = useMemo(() => (slug ? slugify(slug) : slugify(name)), [slug, name]);

  function addVariant() {
    setVariants((prev) => [...prev, { size: "regular", price: 0 }]);
  }

  function removeVariant(i: number) {
    setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function save() {
    if (!name.trim()) return toast.error("Name is required");
    if (!categoryId) return toast.error("Category is required");
    if (!typeId) return toast.error("Product type is required");

    const sizes = variants.map((v) => v.size.trim());
    if (sizes.some((s) => !s)) return toast.error("Variant size is required");
    if (new Set(sizes).size !== sizes.length) return toast.error("Variant sizes must be unique");

    setSaving(true);
    try {
      const payload = {
        category_id: Number(categoryId),
        product_type_id: Number(typeId),
        name: name.trim(),
        slug: autoSlug,
        variants: variants.map((v) => ({ size: v.size, price: Number(v.price) })),
        imageFile,
      };

      if (isEdit && editing) {
        await ProductsApi.update(editing.id, payload);
        toast.success("Updated");
      } else {
        await ProductsApi.create(payload);
        toast.success("Created");
      }

      onOpenChange(false);
      await onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-130 rounded-3xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category + Type */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Category</Label>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setCatOpen(true)}>
                    + Add
                  </Button>
                </div>

                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Product Type</Label>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setTypeOpen(true)}>
                    + Add
                  </Button>
                </div>

                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Name/Slug */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input className="rounded-2xl" value={name} onChange={(e) => setName(e.target.value)} placeholder="Iced Latte" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input className="rounded-2xl" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="iced-latte" />
                <div className="text-xs text-muted-foreground">Final: {autoSlug}</div>
              </div>
            </div>

            {/* Image */}
            <div className="space-y-2">
              <Label>Image</Label>
              <Input
                className="rounded-2xl"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Variants */}
            <div className="rounded-3xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Variants</div>
                  <div className="text-xs text-muted-foreground">Size + Price</div>
                </div>
                <Button type="button" variant="secondary" onClick={addVariant}>
                  + Add Variant
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {variants.map((v, i) => (
                  <div key={i} className="grid gap-2 rounded-2xl bg-muted/40 p-3 md:grid-cols-5 md:items-end">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Size</Label>
                      <Select value={v.size} onValueChange={(val) => updateVariant(i, { size: val })}>
                        <SelectTrigger className="rounded-2xl">
                          <SelectValue placeholder="Size" />
                        </SelectTrigger>
                        <SelectContent>
                          {sizeOptions.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label>Price</Label>
                      <Input
                        className="rounded-2xl"
                        type="number"
                        step="0.01"
                        value={String(v.price)}
                        onChange={(e) => updateVariant(i, { price: Number(e.target.value) })}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full"
                        onClick={() => removeVariant(i)}
                        disabled={variants.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : isEdit ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nested dialogs */}
      <CategoryDialog
        open={catOpen}
        onOpenChange={setCatOpen}
        onCreated={(c) => {
          onCategoryCreated(c);
          setCategoryId(String(c.id));
        }}
      />

      <ProductTypeDialog
        open={typeOpen}
        onOpenChange={setTypeOpen}
        onCreated={(t) => {
          onTypeCreated(t);
          setTypeId(String(t.id));
        }}
      />
    </>
  );
}