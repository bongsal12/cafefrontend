"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, CheckCircle2, Search, ShieldX, ShoppingBag, Wifi } from "lucide-react";
import { toast } from "sonner";
import { OrdersApi, type Order } from "@/app/lib/orders";
import { makeEcho } from "@/app/lib/echo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type UiOrder = Order & {
  totalValue: number;
  ts: number;
  paymentMethod: "Bakong" | "Cash";
  tableLabel: string;
};

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return "bg-emerald-100 text-emerald-700";
  if (s === "cancelled") return "bg-red-100 text-red-700";
  if (s === "pending" || s === "processing" || s === "new") return "bg-amber-100 text-amber-700";
  if (s === "paid") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function percentChange(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
}

export default function OrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "completed" | "pending" | "cancelled">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  async function loadOrders(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    try {
      const data = await OrdersApi.list();
      setOrders(data ?? []);
    } catch (e: any) {
      toast.error(e.message || "Load orders failed");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  async function updateStatus(orderId: number, status: "completed" | "cancelled") {
    try {
      await OrdersApi.updateStatus(orderId, status);
      toast.success(`Order marked as ${status}`);
      await loadOrders({ silent: true });
    } catch (e: any) {
      toast.error(e.message || "Update status failed");
    }
  }

  useEffect(() => {
    loadOrders();

    const pollId = window.setInterval(() => {
      loadOrders({ silent: true });
    }, 15000);

    let echo: any;
    let refreshTimer: number | undefined;

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => loadOrders({ silent: true }), 350);
    };

    try {
      if (process.env.NEXT_PUBLIC_REVERB_APP_KEY) {
        echo = makeEcho();
        setLive(true);

        ["orders", "dashboard", "admin.orders"].forEach((channelName) => {
          const channel: any = echo.channel(channelName);

          [
            "OrderCreated",
            "OrderUpdated",
            "OrderStatusUpdated",
            "order.created",
            "order.updated",
            "order.status.updated",
          ].forEach((eventName) => {
            channel.listen(`.${eventName}`, scheduleRefresh);
            channel.listen(eventName, scheduleRefresh);
          });

          if (typeof channel.listenToAll === "function") {
            channel.listenToAll(() => scheduleRefresh());
          }
        });
      }
    } catch {
      setLive(false);
    }

    return () => {
      window.clearInterval(pollId);
      window.clearTimeout(refreshTimer);
      if (echo) {
        ["orders", "dashboard", "admin.orders"].forEach((channelName) => {
          echo.leaveChannel(channelName);
        });
        echo.disconnect();
      }
    };
  }, []);

  const parsed = useMemo<UiOrder[]>(() => {
    return orders
      .map((o) => {
        const ts = new Date(o.created_at).getTime();
        const idNum = Number(o.id || 0);
        const paymentMethod: "Bakong" | "Cash" = idNum % 2 === 0 ? "Bakong" : "Cash";
        return {
          ...o,
          totalValue: Number(o.total || 0),
          ts,
          paymentMethod,
          tableLabel: `Table ${String((idNum % 9) + 1).padStart(2, "0")}`,
        };
      })
      .filter((o) => Number.isFinite(o.ts));
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return parsed.filter((o) => {
      const dateOk = (fromTs === null || o.ts >= fromTs) && (toTs === null || o.ts <= toTs);
      if (!dateOk) return false;

      const statusOk = statusFilter === "all" || o.status.toLowerCase() === statusFilter;
      if (!statusOk) return false;
      if (!q) return true;

      const hitRef = o.reference.toLowerCase().includes(q);
      const hitStatus = o.status.toLowerCase().includes(q);
      const hitPayment = o.paymentMethod.toLowerCase().includes(q);
      const hitItem = (o.items ?? []).some((it) => it.name.toLowerCase().includes(q));
      return hitRef || hitStatus || hitPayment || hitItem;
    });
  }, [parsed, search, statusFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalOrders = filtered.length;
    const paidOrders = filtered.filter((o) => {
      const s = o.status.toLowerCase();
      return s === "paid" || s === "completed";
    }).length;
    const completed = filtered.filter((o) => o.status.toLowerCase() === "completed").length;
    const cancelled = filtered.filter((o) => o.status.toLowerCase() === "cancelled").length;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const currentStart = now - 7 * dayMs;
    const prevStart = now - 14 * dayMs;

    const current = filtered.filter((o) => o.ts >= currentStart);
    const previous = filtered.filter((o) => o.ts >= prevStart && o.ts < currentStart);

    return {
      totalOrders,
      paidOrders,
      completed,
      cancelled,
      totalDelta: percentChange(current.length, previous.length),
      paidDelta: percentChange(
        current.filter((o) => ["paid", "completed"].includes(o.status.toLowerCase())).length,
        previous.filter((o) => ["paid", "completed"].includes(o.status.toLowerCase())).length
      ),
      completedDelta: percentChange(
        current.filter((o) => o.status.toLowerCase() === "completed").length,
        previous.filter((o) => o.status.toLowerCase() === "completed").length
      ),
      cancelledDelta: percentChange(
        current.filter((o) => o.status.toLowerCase() === "cancelled").length,
        previous.filter((o) => o.status.toLowerCase() === "cancelled").length
      ),
    };
  }, [filtered]);

  const perPage = 8;
  const totalPages = Math.max(Math.ceil(filtered.length / perPage), 1);
  const safePage = Math.min(page, totalPages);

  const pagedOrders = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, safePage]);

  const selectedOrder = useMemo(() => {
    const found = filtered.find((o) => o.id === selectedOrderId);
    if (found) return found;
    return filtered[0] ?? null;
  }, [filtered, selectedOrderId]);

  const activity = useMemo(() => {
    return [...parsed].sort((a, b) => b.ts - a.ts).slice(0, 7);
  }, [parsed]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  useEffect(() => {
    if (selectedOrderId && !filtered.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(filtered[0]?.id ?? null);
    }
    if (!selectedOrderId && filtered[0]?.id) {
      setSelectedOrderId(filtered[0].id);
    }
  }, [filtered, selectedOrderId]);

  function relTime(ts: number) {
    const minutes = Math.max(Math.floor((Date.now() - ts) / 60000), 0);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)} hr ago`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#173b31]">Orders</h1>
          <p className="mt-1 text-sm text-[#5f7a70]">Manage and process customer orders in real time.</p>
        </div>
        <div className="flex w-full items-center gap-2 rounded-xl border border-[#d7e5de] bg-white px-3 py-2 lg:w-78">
          <Search className="h-4 w-4 text-[#6d8a80]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-transparent text-sm text-[#27483e] outline-none placeholder:text-[#8aa198]"
            placeholder="Search anything..."
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Total Orders" value={String(stats.totalOrders)} delta={stats.totalDelta} icon={<ShoppingBag className="h-4 w-4" />} />
        <KpiCard title="Paid Orders" value={String(stats.paidOrders)} delta={stats.paidDelta} icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCard title="Completed" value={String(stats.completed)} delta={stats.completedDelta} icon={<CheckCircle2 className="h-4 w-4" />} />
        <KpiCard title="Cancelled" value={String(stats.cancelled)} delta={stats.cancelledDelta} icon={<ShieldX className="h-4 w-4" />} />
        <KpiCard title="Realtime" value={live ? "Live" : "Polling"} delta={0} icon={<Wifi className="h-4 w-4" />} neutral />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.65fr_0.9fr]">
        <Card className="border-[#d8e6df] bg-white">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#d7e4de] bg-white px-2.5 py-1.5 text-xs text-[#5a756c]">
                <CalendarDays className="h-4 w-4" />
                Date range
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-[#d7e4de] bg-white px-3 py-1.5 text-sm text-[#2a4a40]"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-[#d7e4de] bg-white px-3 py-1.5 text-sm text-[#2a4a40]"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                  }}
                  className="rounded-lg border border-[#d7e4de] px-3 py-1.5 text-sm text-[#5a756c]"
                >
                  Clear dates
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  statusFilter === "all" ? "border-[#2f7c5f] bg-[#eaf5f0] text-[#205644]" : "border-[#d7e4de] text-[#56736a]"
                }`}
              >
                All Statuses
              </button>
              {(["pending", "paid", "completed", "cancelled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
                    statusFilter === s ? "border-[#2f7c5f] bg-[#eaf5f0] text-[#205644]" : "border-[#d7e4de] text-[#56736a]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-sm text-[#6b857b]">Loading orders...</div>
            ) : pagedOrders.length === 0 ? (
              <div className="py-10 text-sm text-[#6b857b]">No orders found for this filter.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-[#e5efea] text-left text-[#6f897f]">
                        <th className="py-2">Order Ref</th>
                        <th className="py-2">Table</th>
                        <th className="py-2">Payment</th>
                        <th className="py-2">Items</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Total</th>
                        <th className="py-2">Created At</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedOrders.map((o) => (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedOrderId(o.id)}
                          className={`cursor-pointer border-b border-[#eef4f1] text-[#25443a] transition hover:bg-[#f7fbf9] ${
                            selectedOrder?.id === o.id ? "bg-[#f1f8f4]" : ""
                          }`}
                        >
                          <td className="py-2 font-medium">{o.reference}</td>
                          <td className="py-2">{o.tableLabel}</td>
                          <td className="py-2">{o.paymentMethod}</td>
                          <td className="py-2">
                            <div className="text-xs">
                              {(o.items ?? []).length} item{(o.items ?? []).length > 1 ? "s" : ""}
                            </div>
                            <div className="max-w-[220px] truncate text-xs text-[#6f897f]">
                              {(o.items ?? []).map((it) => it.name).join(", ") || "-"}
                            </div>
                          </td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusTone(o.status)}`}>{o.status}</span>
                          </td>
                          <td className="py-2">{fmtMoney(o.totalValue)}</td>
                          <td className="py-2 text-xs text-[#6f897f]">
                            <div>{new Date(o.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            <div>{new Date(o.ts).toLocaleDateString()}</div>
                          </td>
                          <td className="py-2">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={o.status.toLowerCase() === "completed"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus(o.id, "completed");
                                }}
                              >
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={o.status.toLowerCase() === "cancelled"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus(o.id, "cancelled");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-[#6f897f]">
                  <span>
                    Showing {(safePage - 1) * perPage + 1} to {Math.min(safePage * perPage, filtered.length)} of {filtered.length} orders
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded border border-[#d9e7e0] px-2 py-1 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span>{safePage} / {totalPages}</span>
                    <button
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded border border-[#d9e7e0] px-2 py-1 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-[#d8e6df] bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base text-[#1f3d34]">New realtime order</CardTitle>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  live
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {live ? "Live" : "Polling"}
              </span>
            </CardHeader>
            <CardContent>
              {!selectedOrder ? (
                <p className="text-sm text-[#6b857b]">No selected order.</p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#e5efea] p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-[#22443a]">{selectedOrder.reference}</div>
                        <div className="text-xs text-[#6e877e]">
                          {selectedOrder.tableLabel} • {selectedOrder.paymentMethod}
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusTone(selectedOrder.status)}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(selectedOrder.items ?? []).map((item, idx) => {
                      const amount = Number(item.price || 0) * Number(item.qty || 0);
                      return (
                        <div key={`${item.name}-${idx}`} className="flex items-start justify-between border-b border-[#edf4f0] pb-2 text-sm">
                          <div>
                            <div className="font-medium text-[#2a493f]">
                              {item.qty}x {item.name}
                            </div>
                            <div className="text-xs text-[#6f897f]">{item.size} • {item.sugar}</div>
                          </div>
                          <div className="font-medium text-[#1f3d34]">{fmtMoney(amount)}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#e5efea] pt-2 text-sm font-semibold text-[#1f3d34]">
                    <span>Order Total</span>
                    <span>{fmtMoney(selectedOrder.totalValue)}</span>
                  </div>

                  <div className="space-y-2 pt-1">
                    <Button
                      className="w-full"
                      disabled={selectedOrder.status.toLowerCase() === "completed"}
                      onClick={() => updateStatus(selectedOrder.id, "completed")}
                    >
                      Mark as Completed
                    </Button>
                    <Button
                      className="w-full"
                      variant="destructive"
                      disabled={selectedOrder.status.toLowerCase() === "cancelled"}
                      onClick={() => updateStatus(selectedOrder.id, "cancelled")}
                    >
                      Cancel Order
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#d8e6df] bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base text-[#1f3d34]">Realtime activity</CardTitle>
              <span className="text-xs text-[#6f897f]">View all</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.length === 0 ? (
                <p className="text-sm text-[#6b857b]">No activity yet.</p>
              ) : (
                activity.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-xl border border-[#e5efea] p-3">
                    <div>
                      <div className="text-sm font-medium text-[#22443a]">{o.paymentMethod} Payment</div>
                      <div className="text-xs text-[#6e877e]">
                        {o.tableLabel} • {fmtMoney(o.totalValue)}
                      </div>
                    </div>
                    <div className="text-xs text-[#6f897f]">{relTime(o.ts)}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  delta,
  icon,
  neutral,
}: {
  title: string;
  value: string;
  delta: number;
  icon: ReactNode;
  neutral?: boolean;
}) {
  const up = delta >= 0;
  return (
    <Card className="border-[#d8e6df] bg-white">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-[#6d877d]">{title}</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-[#1f3d34]">{value}</div>
            {neutral ? (
              <div className="mt-1 text-xs text-[#6f897f]">orders updating...</div>
            ) : (
              <div className={`mt-1 text-xs ${up ? "text-emerald-700" : "text-amber-700"}`}>
                {up ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs last 7 days
              </div>
            )}
          </div>
          <div className="rounded-xl border border-[#d7e5de] bg-[#f4faf7] p-2 text-[#2b6e56]">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
