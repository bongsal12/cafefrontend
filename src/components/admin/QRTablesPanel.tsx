"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { TablesApi, type DiningTableUpsert } from "@/app/lib/tables";
import type { DiningTable } from "@/app/types/entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function QRTablesPanel() {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [search, setSearch] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DiningTableUpsert>({ name: "", slug: "", is_active: true });
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const loadTables = async () => {
    setLoading(true);
    try {
      setTables(await TablesApi.list());
    } catch (e: any) {
      toast.error(e.message || "Load tables failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [tables, search]);

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", slug: "", is_active: true });
  }

  function startEdit(table: DiningTable) {
    setEditingId(table.id);
    setForm({ name: table.name, slug: table.slug, is_active: table.is_active });
    window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    toast.message(`Editing ${table.name}`);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId) {
        await TablesApi.update(editingId, form);
        toast.success("Table updated");
      } else {
        await TablesApi.create(form);
        toast.success("Table created");
      }
      resetForm();
      await loadTables();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    }
  }

  function tableUrl(slug: string) {
    const origin = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    return `${origin}/?table_no=${encodeURIComponent(slug)}`;
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("QR link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>QR Tables</CardTitle>
          <CardDescription>Create tables and generate QR codes that open the customer menu with the table number.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitForm} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                ref={nameInputRef}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Table 1"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug / QR value</label>
              <Input
                value={form.slug || ""}
                onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                placeholder="table-1"
              />
            </div>
            <label className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active !== false}
                onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))}
              />
              Active
            </label>
            <div className="flex gap-2">
              <Button type="submit">{editingId ? "Update" : "Create"}</Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>

          <div className="mt-4 flex items-center gap-2">
            <Input className="max-w-md" placeholder="Search tables..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No tables yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((table) => {
            const url = tableUrl(table.slug);
            return (
              <Card key={table.id} className="rounded-3xl">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{table.name}</CardTitle>
                      <CardDescription>{table.slug}</CardDescription>
                    </div>
                    <Badge variant={table.is_active ? "secondary" : "destructive"}>
                      {table.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white p-4">
                    <QRCodeCanvas value={url} size={180} includeMargin />
                    <div className="w-full break-all text-center text-xs text-muted-foreground">{url}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                        {/* <Button type="button" variant="outline" onClick={() => copyLink(url)}>
                      Copy Link
                    </Button> */}
                        <Button type="button" variant="secondary" onClick={() => startEdit(table)}>
                      Edit
                    </Button>
                    <Button
                          type="button"
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm(`Delete ${table.name}?`)) return;
                        try {
                          await TablesApi.remove(table.id);
                          toast.success("Deleted");
                          await loadTables();
                        } catch (e: any) {
                          toast.error(e.message || "Delete failed");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
