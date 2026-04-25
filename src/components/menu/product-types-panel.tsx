"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDel } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ProductType = { id: number; name: string; slug: string };

export function ProductTypesPanel({ reloadKey, onNeedReload }: { reloadKey: number; onNeedReload: () => void }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProductType[]>([]);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet<any>("/product-types");
      setItems(res.data ?? res);
    } catch (e: any) {
      toast.error(e.message || "Load product types failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => x.name.toLowerCase().includes(s) || x.slug.toLowerCase().includes(s));
  }, [items, q]);

  async function create() {
    try {
      if (!name.trim()) return toast.error("Name is required");
      const payload = { name: name.trim(), slug: (slug || name).trim().toLowerCase().replace(/\s+/g, "-") };
      await apiPost("/product-types", payload);
      toast.success("Product type created");
      setOpen(false);
      setName("");
      setSlug("");
      onNeedReload();
    } catch (e: any) {
      toast.error(e.message || "Create failed");
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this product type?")) return;
    try {
      await apiDel(`/product-types/${id}`);
      toast.success("Product type deleted");
      onNeedReload();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-background p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-bold">Product Types</div>
          <div className="text-sm text-muted-foreground">Coffee / Tea / Frappe / Other…</div>
        </div>

        <div className="flex gap-2">
          <Input className="w-65" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>+ Add Type</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Product Type</DialogTitle>
              </DialogHeader>

              <div className="grid gap-3">
                <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Slug (optional)" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-2xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3}>Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={3}>No types.</TableCell></TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" onClick={() => remove(c.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}