"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PromotionsApi } from "@/app/lib/promotions";
import { apiGet } from "@/app/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ScopeType = "product" | "category";
type PromoStatus = "active" | "scheduled" | "expired";

type PromoRow = {
  id: number;
  name: string;
  scope_type: ScopeType;
  scopeType?: ScopeType;
  scope_id?: number | null;
  product_id?: number | null;
  category_id?: number | null;
  percent: number;
  start_at?: string | null;
  end_at?: string | null;
  active: boolean;
  status: PromoStatus;
  scope_label?: string;
  product?: { id: number; name: string; image?: string | null } | null;
  category?: { id: number; name: string } | null;
};

type FormState = {
  name: string;
  scopeType: ScopeType;
  scopeId: number | null;
  percent: number;
  startAt: string;
  endAt: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  scopeType: "product",
  scopeId: null,
  percent: 10,
  startAt: "",
  endAt: "",
  active: true,
};

function statusTone(status: PromoStatus) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "scheduled") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function toDateOnly(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseApiErrorMessage(err: unknown) {
  const raw = String((err as any)?.message ?? err ?? "Save failed");
  try {
    const json = JSON.parse(raw);
    if (json?.message && json?.errors) {
      const firstKey = Object.keys(json.errors)[0];
      const first = firstKey ? json.errors[firstKey]?.[0] : null;
      return first || json.message;
    }
    if (json?.message) return json.message;
  } catch {
    // message isn't json, keep raw
  }
  return raw;
}

function resolveScopeLabel(promo: PromoRow, products: any[], categories: any[]) {
  if (promo.scope_label) return promo.scope_label;
  const scope = promo.scope_type ?? promo.scopeType ?? "product";
  if (scope === "category") {
    return categories.find((c) => c.id === (promo.category_id ?? promo.scope_id))?.name ?? `Category #${promo.category_id ?? promo.scope_id}`;
  }
  return products.find((p) => p.id === (promo.product_id ?? promo.scope_id))?.name ?? `Product #${promo.product_id ?? promo.scope_id}`;
}

export default function DiscountsPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PromoStatus>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function load() {
    setLoading(true);
    // Fetch promotions, products, categories separately so a single failure
    // doesn't prevent other dropdowns from populating.
    try {
      const promosResp = await PromotionsApi.list().catch((err) => {
        console.error("Promotions load error", err);
        toast.error("Failed to load promotions");
        return [] as any[];
      });
      setPromos((promosResp ?? []).map((p: any) => ({
        ...p,
        scopeType: p.scope_type ?? (p.category_id ? "category" : "product"),
      })));
    } catch (err) {
      console.error("Unexpected promotions error", err);
    }

    try {
      const pr = await apiGet<any>("/products").catch((err) => {
        console.error("Products load error", err);
        toast.error("Failed to load products");
        return null;
      });
      setProducts((pr?.data ?? pr) ?? []);
    } catch (err) {
      console.error("Unexpected products error", err);
    }

    try {
      const cr = await apiGet<any>("/categories").catch((err) => {
        console.error("Categories load error", err);
        toast.error("Failed to load categories");
        return null;
      });
      setCategories((cr?.data ?? cr) ?? []);
    } catch (err) {
      console.error("Unexpected categories error", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const pid = searchParams.get("product_id");
    if (!pid) return;

    const id = Number(pid);
    if (!Number.isFinite(id)) return;

    setForm((prev) => ({ ...prev, scopeType: "product", scopeId: id }));
  }, [searchParams]);

  const filteredPromos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return promos.filter((promo) => {
      const label = resolveScopeLabel(promo, products, categories).toLowerCase();
      const nameHit = promo.name.toLowerCase().includes(q);
      const scopeHit = label.includes(q);
      const statusHit = statusFilter === "all" || promo.status === statusFilter;
      return statusHit && (!q || nameHit || scopeHit);
    });
  }, [promos, products, categories, search, statusFilter]);

  const stats = useMemo(() => ({
    total: promos.length,
    active: promos.filter((p) => p.status === "active").length,
    scheduled: promos.filter((p) => p.status === "scheduled").length,
    expired: promos.filter((p) => p.status === "expired").length,
  }), [promos]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function editPromo(promo: PromoRow) {
    const scope = promo.scope_type ?? promo.scopeType ?? "product";
    setEditingId(promo.id);
    setForm({
      name: promo.name,
      scopeType: scope,
      scopeId: scope === "category" ? (promo.category_id ?? promo.scope_id ?? null) : (promo.product_id ?? promo.scope_id ?? null),
      percent: promo.percent,
      startAt: toDateOnly(promo.start_at),
      endAt: toDateOnly(promo.end_at),
      active: promo.active,
    });
  }

  async function savePromo() {
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.scopeId) return toast.error(`Select a ${form.scopeType}`);
    if (form.percent <= 0 || form.percent > 100) return toast.error("Percent must be 1-100");

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        scope_type: form.scopeType,
        product_id: form.scopeType === "product" ? form.scopeId : undefined,
        category_id: form.scopeType === "category" ? form.scopeId : undefined,
        percent: form.percent,
        start_at: form.startAt || null,
        end_at: form.endAt || null,
        active: form.active,
      };

      if (editingId) {
        await PromotionsApi.update(editingId, payload);
        toast.success("Promotion updated");
      } else {
        await PromotionsApi.create(payload);
        toast.success("Promotion created");
      }

      resetForm();
      await load();
    } catch (e: any) {
      toast.error(parseApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function removePromo(id: number) {
    if (!confirm("Delete this promotion?")) return;
    try {
      await PromotionsApi.remove(id);
      toast.success("Promotion deleted");
      if (editingId === id) resetForm();
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  const selectedLabel = useMemo(() => {
    if (!form.scopeId) return "";
    if (form.scopeType === "category") {
      return categories.find((c) => c.id === form.scopeId)?.name ?? `Category #${form.scopeId}`;
    }
    return products.find((p) => p.id === form.scopeId)?.name ?? `Product #${form.scopeId}`;
  }, [form.scopeType, form.scopeId, products, categories]);

  const IMAGE_BASE = process.env.NEXT_PUBLIC_IMAGEPATH ?? "http://127.0.0.1:8000/storage";
  function imgUrl(image?: string | null) {
    if (!image) return "";
    if (image.startsWith("http://") || image.startsWith("https://")) return image;
    return `${IMAGE_BASE}/${image}`;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Discounts</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-semibold text-emerald-700">{stats.active}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Scheduled</div><div className="text-2xl font-semibold text-amber-700">{stats.scheduled}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Expired</div><div className="text-2xl font-semibold text-rose-700">{stats.expired}</div></CardContent></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Promotion" : "Create Promotion"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Dis 10%" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Scope</Label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.scopeType}
                  onChange={(e) => setForm((p) => ({ ...p, scopeType: e.target.value as ScopeType, scopeId: null }))}
                >
                  <option value="product">Single Product</option>
                  <option value="category">Category</option>
                </select>
              </div>
              <div>
                <Label>{form.scopeType === "product" ? "Product" : "Category"}</Label>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={form.scopeId ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, scopeId: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">Select {form.scopeType}</option>
                  {(form.scopeType === "product" ? products : categories).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedLabel ? (
              <div className="text-xs text-muted-foreground">Selected: {selectedLabel}</div>
            ) : null}
            {form.scopeId ? (
              <div className="mt-2 rounded-md border p-2 bg-white">
                {form.scopeType === "product" ? (
                  (() => {
                    const prod = products.find((p) => p.id === form.scopeId);
                    if (!prod) return <div className="text-xs text-muted-foreground">Product not found</div>;
                    return (
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 overflow-hidden rounded-md bg-muted border">
                          {prod.image ? (
                            <img src={imgUrl(prod.image)} alt={prod.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">No image</div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{prod.name}</div>
                          <div className="text-xs text-muted-foreground">Variants:</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {(prod.variants ?? []).map((v: any, idx: number) => (
                              <div key={idx} className="rounded-lg bg-muted px-2 py-1 text-xs">{v.size}: ${Number(v.price).toFixed(2)}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  (() => {
                    const cat = categories.find((c) => c.id === form.scopeId);
                    if (!cat) return <div className="text-xs text-muted-foreground">Category not found</div>;
                    const count = products.filter((p) => p.category_id === cat.id).length;
                    return (
                      <div>
                        <div className="font-medium">{cat.name}</div>
                        <div className="text-xs text-muted-foreground">{count} product(s) in this category</div>
                      </div>
                    );
                  })()
                )}
              </div>
            ) : null}

            <div>
              <Label>Discount %</Label>
              <Input type="number" min={1} max={100} value={String(form.percent)} onChange={(e) => setForm((p) => ({ ...p, percent: Number(e.target.value) }))} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Start at</Label>
                <Input type="date" value={form.startAt} onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))} />
              </div>
              <div>
                <Label>End at</Label>
                <Input type="date" value={form.endAt} onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input id="promoActive" type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="promoActive" className="text-sm">Active</label>
            </div>

            <div className="flex gap-2">
              <Button onClick={savePromo} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
              <Button type="button" variant="secondary" onClick={resetForm}>Clear</Button>
              <Button type="button" variant="outline" onClick={load}>Refresh</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <Input className="md:w-80" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search discount or product/category..." />
              <select className="h-10 rounded-md border px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <CardTitle>Existing Promotions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading promotions...</div>
            ) : filteredPromos.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No promotions found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-180 text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Name</th>
                      <th className="py-2">Scope</th>
                      <th className="py-2">Discount</th>
                      <th className="py-2">Valid Period</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPromos.map((promo) => (
                      <tr key={promo.id} className="border-b align-top">
                        <td className="py-3">
                          <div className="flex items-start gap-2">
                            {promo.scope_type === "product" && promo.product?.image ? (
                              <img src={imgUrl(promo.product.image)} alt={promo.product.name} className="h-8 w-8 rounded-md border object-cover" />
                            ) : null}
                            <div>
                              <div className="font-medium">{promo.name}</div>
                              <div className="text-xs text-muted-foreground">{promo.scope_type}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">{resolveScopeLabel(promo, products, categories)}</td>
                        <td className="py-3">{promo.percent}%</td>
                        <td className="py-3 text-xs text-muted-foreground">
                          <div>{promo.start_at ? new Date(promo.start_at).toLocaleString() : "No start"}</div>
                          <div>{promo.end_at ? new Date(promo.end_at).toLocaleString() : "No end"}</div>
                        </td>
                        <td className="py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusTone(promo.status)}`}>{promo.status}</span>
                        </td>
                        <td className="py-3">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => editPromo(promo)}>Edit</Button>
                            <Button size="sm" variant="destructive" onClick={() => removePromo(promo.id)}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
