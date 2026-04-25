"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Category } from "@/app/types/entities";
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

export function CategoriesPanel({
  categories,
  onChanged,
}: {
  categories: Category[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  function openCreate() {
    setEditing(null);
    setName("");
    setSlug("");
    setOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setSlug(c.slug);
    setOpen(true);
  }

  async function save() {
    try {
      const payload = { name: name.trim(), slug: (slug || slugify(name)).trim() };
      if (!payload.name) return toast.error("Name is required.");

      if (editing) await apiPatch(`/categories/${editing.id}`, payload);
      else await apiPost(`/categories`, payload);

      toast.success(editing ? "Category updated" : "Category created");
      setOpen(false);
      await onChanged();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this category?")) return;
    try {
      await apiDel(`/categories/${id}`);
      toast.success("Category deleted");
      await onChanged();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Categories</CardTitle>
        <Button onClick={openCreate}>+ Add Category</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.length === 0 ? (
          <div className="text-sm text-muted-foreground">No categories yet.</div>
        ) : (
          categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border bg-background p-3"
            >
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.slug}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openEdit(c)}>
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => remove(c.id)}>
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
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
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