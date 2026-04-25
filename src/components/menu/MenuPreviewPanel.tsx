"use client";

import { useEffect, useState } from "react";
import { api } from "@/app/lib/api";
import type { MenuResponse, MenuItem } from "@/app/types/menu";
import { isIcedItem } from "@/app/types/menu";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast.old";

export function MenuPreviewPanel() {
  const [data, setData] = useState<MenuResponse | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<MenuResponse>("/menu");
      setData(res);
    } catch (e: any) {
      setToast({ type: "error", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Menu Preview</h2>
            <p className="text-sm text-gray-600">This renders exactly from GET /api/menu</p>
          </div>
          <Button variant="secondary" onClick={load}>Refresh</Button>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading...</div>
        ) : !data ? (
          <div className="mt-4 text-sm text-gray-600">No data.</div>
        ) : (
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 p-4">
              <div className="text-sm text-gray-600">
                Currency: <span className="font-semibold text-gray-900">{data.currency}</span> • Last Updated:{" "}
                <span className="font-semibold text-gray-900">{data.lastUpdated}</span>
              </div>

              <div className="mt-4 space-y-5">
                {Object.entries(data.menu).map(([cat, types]) => (
                  <div key={cat} className="rounded-2xl bg-gray-50 p-4">
                    <div className="text-lg font-bold capitalize">{cat}</div>

                    <div className="mt-3 grid gap-4">
                      {Object.entries(types).map(([typeSlug, products]) => (
                        <div key={typeSlug} className="rounded-xl bg-white p-3">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold capitalize">{typeSlug}</div>
                            <div className="text-xs text-gray-600">{Object.keys(products).length} items</div>
                          </div>

                          <div className="mt-2 space-y-2">
                            {Object.entries(products).map(([prodSlug, item]) => (
                              <MenuRow key={prodSlug} slug={prodSlug} item={item} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-4">
              <div className="mb-2 text-sm font-semibold text-gray-900">Raw JSON</div>
              <pre className="max-h-140 overflow-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-100">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuRow({ slug, item }: { slug: string; item: MenuItem }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-gray-50 p-3">
      <div>
        <div className="font-semibold">{slug.replaceAll("_", " ")}</div>
        {isIcedItem(item) ? (
          <div className="mt-1 space-y-1 text-sm text-gray-600">
            {Object.entries(item.sizes).map(([size, v]) => (
              <div key={size} className="flex gap-2">
                <span className="w-16 capitalize">{size}</span>
                <span>${v.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-sm text-gray-600 capitalize">{item.size}</div>
        )}
      </div>

      <div className="rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">
        {isIcedItem(item)
          ? `from $${Math.min(...Object.values(item.sizes).map((x) => x.price)).toFixed(2)}`
          : `$${item.price.toFixed(2)}`}
      </div>
    </div>
  );
}
