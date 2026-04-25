"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Category, Product, ProductType, ProductVariant } from "@/app/types/entities";
import { apiDel, apiGet } from "@/app/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProductDialog } from "@/components/menu/ProductsDialog";

const IMAGE_BASE = process.env.NEXT_PUBLIC_IMAGEPATH ?? "http://127.0.0.1:8000/storage";

function imgUrl(image?: string | null) {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `${IMAGE_BASE}/${image}`;
}

export function ProductsPanel({
  categories,
  types,
  onLookupsChanged,
}: {
  categories: Category[];
  types: ProductType[];
  onLookupsChanged: () => Promise<void>;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  async function loadProducts() {
    setLoading(true);
    try {
      const p = await apiGet<any>("/products"); // paginated or array
      setProducts(p.data ?? p ?? []);
    } catch (e: any) {
      toast.error(e.message || "Load products failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
      const matchCat = categoryFilter === "all" || p.category_id === categoryFilter;
      return matchQ && matchCat;
    });
  }, [products, search, categoryFilter]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setDialogOpen(true);
  }

  async function remove(p: Product) {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    try {
      await apiDel(`/products/${p.id}`);
      toast.success("Product deleted");
      await loadProducts();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  }

  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? `#${id}`;
  const typeName = (id: number) => types.find((t) => t.id === id)?.name ?? `#${id}`;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Products</CardTitle>
          <div className="text-sm text-muted-foreground">
            Create products, upload images, set variants (logic unchanged).
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            className="md:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product…"
          />

          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <Button onClick={openCreate}>+ Add Product</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No products found.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-2xl border bg-background p-4">
                <div className="flex gap-3">
                  <div className="h-20 w-20 overflow-hidden rounded-xl border bg-muted">
                    {p.image ? (
                      // use img to avoid next/image private ip problem
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgUrl(p.image)}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.slug}</div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{catName(p.category_id)}</Badge>
                      <Badge variant="outline">{typeName(p.product_type_id)}</Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(p.variants ?? []).map((v: ProductVariant, idx: number) => (
                    <span key={idx} className="rounded-xl bg-muted px-2 py-1 text-xs">
                      {v.size}: ${Number(v.price).toFixed(2)}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => openEdit(p)}>
                    Edit
                  </Button>
                  <Button variant="destructive" onClick={() => remove(p)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        categories={categories}
        types={types}
        onLookupsChanged={onLookupsChanged}
        onSaved={loadProducts}
      />
    </Card>
  );
}