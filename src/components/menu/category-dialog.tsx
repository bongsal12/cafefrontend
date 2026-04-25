"use client";

import { useState } from "react";
import { toast } from "sonner";
import { slugify } from "@/app/lib/slug";
import { CategoriesApi } from "@/app/lib/categories";
import type { Category } from "@/app/types/entities";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (c: Category) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      const created = await CategoriesApi.create({ name: name.trim(), slug: slugify(name) });
      toast.success("Category added");
      onCreated(created);
      setName("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-105 rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input className="rounded-2xl" value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}