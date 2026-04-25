"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProductsApi } from "@/app/lib/products";
import { CategoriesApi } from "@/app/lib/categories";
import { ProductTypesApi } from "@/app/lib/product-types";
import type { Category, Product, ProductType } from "@/app/types/entities";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { ProductDialog } from "@/components/menu/product-dialog";

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

  // Handle Laravel-style "/storage/..." paths without duplicating "/storage".
  if (normalized.startsWith("storage/") && base.endsWith("/storage")) {
    return `${origin}/${normalized}`;
  }

  return `${base}/${normalized}`;
}

type ProductsPanelProps = {
  reloadKey?: number;
  onNeedReload?: () => void;
};

export function ProductsPanel({ reloadKey = 0 }: ProductsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, t] = await Promise.all([
        ProductsApi.list(),
        CategoriesApi.list(),
        ProductTypesApi.list(),
      ]);
      setProducts(p);
      setCategories(c);
      setTypes(t);
    } catch (e: any) {
      toast.error(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll, reloadKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [products, search]);

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Products</CardTitle>
            <CardDescription>Create / edit products with variants.</CardDescription>
          </div>

          <div className="flex w-full gap-2 md:w-auto">
            <Input
              className="w-full md:w-80"
              placeholder="Search product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              + Add Product
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
              No products
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <div key={p.id} className="rounded-3xl border bg-background p-4">
                  <div className="flex gap-3">
                    <div className="h-20 w-20 overflow-hidden rounded-2xl border bg-muted">
                      {p.image ? (
                        // use <img> to avoid Next/Image private IP issues
                        <img
                          src={imgUrl(p.image)}
                          alt={p.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>

                    <div className="flex-1">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.slug}</div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          Category: {categories.find((c) => c.id === p.category_id)?.name ?? p.category_id}
                        </Badge>
                        <Badge variant="outline">
                          Type: {types.find((t) => t.id === p.product_type_id)?.name ?? p.product_type_id}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(p.variants ?? []).map((v, idx) => (
                      <span key={idx} className="rounded-2xl border px-3 py-2 text-sm">
                        <div className="font-medium">{v.size}</div>
                        <div className="text-muted-foreground">${Number(v.price).toFixed(2)}</div>
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm(`Delete "${p.name}"?`)) return;
                        try {
                          await ProductsApi.remove(p.id);
                          toast.success("Deleted");
                          await loadAll();
                        } catch (e: any) {
                          toast.error(e.message || "Delete failed");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        categories={categories}
        types={types}
        onRefresh={loadAll}
        onCategoryCreated={(c) => setCategories((prev) => [c, ...prev])}
        onTypeCreated={(t) => setTypes((prev) => [t, ...prev])}
      />
    </div>
  );
}