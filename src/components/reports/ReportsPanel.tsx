"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { OrdersApi, type Order } from "@/app/lib/orders";
import { makeEcho } from "@/app/lib/echo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeDollarSign, CalendarDays, ChartColumn, Search, ShoppingBag, Wallet } from "lucide-react";

const IMAGE_BASE = process.env.NEXT_PUBLIC_IMAGEPATH ?? process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? "http://127.0.0.1:8000/storage";

function imgUrl(image?: string | null) {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  const base = IMAGE_BASE.replace(/\/$/, "");
  return `${base}/${image}`;
}

function getItemThumbnail(image?: string | null) {
  const url = imgUrl(image);
  return url || null;
}

export default function ReportsPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [live, setLive] = useState(false);
  const [range, setRange] = useState<"day" | "week" | "month" | "30d" | "custom">("30d");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function toDateInput(ts: number) {
    return new Date(ts).toISOString().slice(0, 10);
  }

  function setRangeDates(nextRange: "day" | "week" | "month" | "30d" | "custom") {
    if (nextRange === "custom") return;

    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);

    if (nextRange === "day") start.setDate(now.getDate());
    if (nextRange === "week") start.setDate(now.getDate() - 6);
    if (nextRange === "month") start.setDate(now.getDate() - 29);
    if (nextRange === "30d") start.setDate(now.getDate() - 29);

    setDateFrom(toDateInput(start.getTime()));
    setDateTo(toDateInput(end.getTime()));
  }

  async function loadOrders() {
    try {
      const data = await OrdersApi.list();
      setOrders(data ?? []);
    } catch {
      // Keep reports visible with last known values if request fails.
    }
  }

  useEffect(() => {
    loadOrders();

    const pollId = window.setInterval(() => {
      loadOrders();
    }, 5000);

    let echo: any;
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => loadOrders(), 350);
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

  useEffect(() => {
    setRangeDates("30d");
  }, []);

  const filteredOrders = useMemo(() => {
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return orders.filter((o) => {
      const ts = new Date(o.created_at).getTime();
      const okFrom = fromTs === null || ts >= fromTs;
      const okTo = toTs === null || ts <= toTs;
      return okFrom && okTo;
    });
  }, [orders, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const normalized = filteredOrders.map((o) => ({
      ...o,
      totalValue: Number(o.total || 0),
      ts: new Date(o.created_at).getTime(),
    }));

    const totalOrders = normalized.length;
    const completed = normalized.filter((o) => ["completed", "paid"].includes(o.status.toLowerCase())).length;
    const pending = normalized.filter((o) => ["pending", "new", "processing"].includes(o.status.toLowerCase())).length;
    const cancelled = normalized.filter((o) => o.status === "cancelled").length;
    const totalRevenue = filteredOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const avgOrder = totalOrders ? totalRevenue / totalOrders : 0;

    const sorted = [...normalized].sort((a, b) => b.ts - a.ts);
    const recent = sorted.slice(0, 80);

    const dayMap = new Map<string, number>();
    for (const o of recent) {
      const d = new Date(o.ts);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      dayMap.set(key, (dayMap.get(key) ?? 0) + o.totalValue);
    }
    const trendPoints = Array.from(dayMap.entries()).slice(-8);

    const itemRevenueMap = new Map<string, number>();
    for (const o of normalized) {
      for (const item of o.items ?? []) {
        const current = itemRevenueMap.get(item.name) ?? 0;
        itemRevenueMap.set(item.name, current + Number(item.price || 0) * Number(item.qty || 0));
      }
    }
    const topItems = Array.from(itemRevenueMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const statusRows = [
      { label: "Completed/Paid", count: completed },
      { label: "Pending", count: pending },
      { label: "Cancelled", count: cancelled },
    ];

    return {
      totalOrders,
      completed,
      pending,
      cancelled,
      totalRevenue,
      avgOrder,
      trendPoints,
      topItems,
      statusRows,
      recent,
    };
  }, [filteredOrders]);

  const donut = useMemo(() => {
    const total = Math.max(stats.totalOrders, 1);
    const completedPct = (stats.completed / total) * 100;
    const pendingPct = (stats.pending / total) * 100;
    const cancelledPct = (stats.cancelled / total) * 100;
    return {
      style: {
        background: `conic-gradient(#1e6b54 0 ${completedPct}%, #9bc9b6 ${completedPct}% ${completedPct + pendingPct}%, #d8e8df ${completedPct + pendingPct}% ${completedPct + pendingPct + cancelledPct}%, #f0f6f3 ${completedPct + pendingPct + cancelledPct}% 100%)`,
      } as CSSProperties,
      completedPct,
      pendingPct,
      cancelledPct,
    };
  }, [stats]);

  const salesRows = useMemo(() => {
    return filteredOrders
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredOrders]);

  return (
    <div className="space-y-4">
      <Card className="border-[#d8e6df] bg-white">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-3xl font-bold text-[#1c3c33]">Reports</CardTitle>
              {/* <p className="mt-1 text-sm text-[#5b766d]">
                Analyze cafe performance with live updates and fast insights.
              </p> */}
            </div>

            {/* <div className="flex w-full items-center gap-2 rounded-xl border border-[#d5e3dd] bg-[#f7fbf9] px-3 py-2 lg:w-80">
              <Search className="h-4 w-4 text-[#6d8a80]" />
              <input
                className="w-full bg-transparent text-sm text-[#2a4a40] outline-none placeholder:text-[#8aa198]"
                placeholder="Search anything..."
              />
            </div> */}
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <RangeBtn
                label="Day"
                active={range === "day"}
                onClick={() => {
                  setRange("day");
                  setRangeDates("day");
                }}
              />
              <RangeBtn
                label="Week"
                active={range === "week"}
                onClick={() => {
                  setRange("week");
                  setRangeDates("week");
                }}
              />
              <RangeBtn
                label="Month"
                active={range === "month"}
                onClick={() => {
                  setRange("month");
                  setRangeDates("month");
                }}
              />
              <RangeBtn
                label="30 Days"
                active={range === "30d"}
                onClick={() => {
                  setRange("30d");
                  setRangeDates("30d");
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <DateBox label="From" value={dateFrom} onChange={(v) => {
                setRange("custom");
                setDateFrom(v);
              }} />
              <DateBox label="To" value={dateTo} onChange={(v) => {
                setRange("custom");
                setDateTo(v);
              }} />
            
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={`$${stats.totalRevenue.toFixed(2)}`}
          hint=""
          icon={<BadgeDollarSign className="h-4 w-4" />}
          points={stats.trendPoints.map((x) => x[1])}
        />
        <MetricCard
          label="Total Orders"
          value={String(stats.totalOrders)}
          hint=""
          icon={<ShoppingBag className="h-4 w-4" />}
          points={stats.trendPoints.map((x) => x[1] * 0.8)}
        />
        <MetricCard
          label="Avg Order Value"
          value={`$${stats.avgOrder.toFixed(2)}`}
          hint=""
          icon={<Wallet className="h-4 w-4" />}
          points={stats.trendPoints.map((x) => x[1] * 0.45)}
        />
        <MetricCard
          label="Completed Orders"
          value={String(stats.completed)}
          hint={`${stats.cancelled} cancelled`}
          icon={<ChartColumn className="h-4 w-4" />}
          points={stats.trendPoints.map((_, i) => i + 4)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1.2fr_1fr]">
        <Card className="border-[#d8e6df] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#1f3d34]">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart points={stats.trendPoints.map((x) => x[1])} labels={stats.trendPoints.map((x) => x[0])} />
          </CardContent>
        </Card>

        <Card className="border-[#d8e6df] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#1f3d34]">Top Items by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.topItems.length === 0 ? (
              <p className="text-sm text-[#6b857b]">No item data yet.</p>
            ) : (
              stats.topItems.map((row, i) => {
                const peak = stats.topItems[0]?.amount || 1;
                const pct = Math.max((row.amount / peak) * 100, 8);
                return (
                  <div key={`${row.name}-${i}`}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate text-[#28473d]">{row.name}</span>
                      <span className="font-medium text-[#1f3d34]">${row.amount.toFixed(2)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#edf5f1]">
                      <div className="h-2 rounded-full bg-[#2f7c5f]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-[#d8e6df] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#1f3d34]">Sales by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto flex w-fit items-center gap-6">
              <div className="relative h-36 w-36 rounded-full" style={donut.style}>
                <div className="absolute inset-4 grid place-items-center rounded-full bg-white text-center">
                  <div>
                    <div className="text-xl font-semibold text-[#1d3b32]">{stats.totalOrders}</div>
                    <div className="text-xs text-[#6f897f]">Total</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <LegendRow color="#1e6b54" label="Completed/Paid" value={`${donut.completedPct.toFixed(0)}%`} />
              <LegendRow color="#9bc9b6" label="Pending" value={`${donut.pendingPct.toFixed(0)}%`} />
              <LegendRow color="#d8e8df" label="Cancelled" value={`${donut.cancelledPct.toFixed(0)}%`} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr]">
        <Card id="order-status-breakdown" className="border-[#d8e6df] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#1f3d34]">Order Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-115 text-sm">
                <thead>
                  <tr className="border-b border-[#e5efea] text-left text-[#6f897f]">
                    <th className="py-2">Status</th>
                    <th className="py-2">Orders</th>
                    <th className="py-2">Share</th>
                    <th className="py-2">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.statusRows.map((row) => {
                    const pct = stats.totalOrders ? ((row.count / stats.totalOrders) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={row.label} className="border-b border-[#eef4f1] text-[#25443a]">
                        <td className="py-2 font-medium">{row.label}</td>
                        <td className="py-2">{row.count}</td>
                        <td className="py-2">{pct}%</td>
                        <td className="py-2 text-emerald-700">+{Math.max(Number(pct) / 3, 0.1).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

     
      </div>

      <Card className="border-[#d8e6df] bg-white">
        <CardHeader>
          <CardTitle className="text-base text-[#1f3d34]">Sales Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-115 text-sm">
              <thead>
                <tr className="border-b border-[#e5efea] text-left text-[#6f897f]">
                  <th className="py-2">Order Ref</th>
                  <th className="py-2">Table</th>
                  <th className="py-2">Payment</th>
                  <th className="py-2">Items</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Created At</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((o) => {
                  const totalValue = Number(o.total || 0);
                  const tableLabel = (o as any).tableLabel ?? (o as any).table_no ?? "-";
                  const payment = o.payment_method ?? o.payment_provider ?? o.payment_status ?? "-";
                  return (
                    <tr key={o.id} className="border-b border-[#eef4f1] text-[#25443a] hover:bg-[#f7fbf9]">
                      <td className="py-2 font-medium">{o.reference}</td>
                      <td className="py-2">{tableLabel}</td>
                      <td className="py-2 text-sm text-[#445e55]">{String(payment)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {(o.items ?? []).slice(0, 3).map((it, i) => (
                              <div
                                key={`${it.name}-${i}`}
                                className="grid h-8 w-8 place-items-center overflow-hidden rounded-md border border-[#e6f0ea] bg-[#f3f7f5] text-[10px] text-[#6f897f]"
                                title={it.name}
                              >
                                {getItemThumbnail(it.image) ? (
                                  <img
                                    src={getItemThumbnail(it.image) ?? undefined}
                                    alt={it.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>No img</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="truncate text-sm text-[#28473d]">
                            {(o.items ?? []).map((it) => it.name).join(", ") || "-"}
                          </div>
                        </div>
                      </td>
                      <td className="py-2">${totalValue.toFixed(2)}</td>
                      <td className="py-2 text-xs text-[#6f897f]">
                        <div>{new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        <div>{new Date(o.created_at).toLocaleDateString()}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RangeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        active
          ? "border-[#2f7c5f] bg-[#eaf5f0] text-[#205644]"
          : "border-[#d7e4de] bg-white text-[#56736a] hover:bg-[#f5faf7]"
      }`}
    >
      {label}
    </button>
  );
}

function DateBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#d7e4de] bg-white px-3 py-1.5">
      <span className="text-xs text-[#7a968c]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm text-[#2a4a40] outline-none"
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  points,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  points: number[];
}) {
  return (
    <Card className="border-[#d8e6df] bg-white">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-[#6d877d]">{label}</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-[#1f3d34]">{value}</div>
            <div className="mt-1 text-xs text-[#6f897f]">{hint}</div>
          </div>
          <div className="rounded-xl border border-[#d7e5de] bg-[#f4faf7] p-2 text-[#2b6e56]">{icon}</div>
        </div>
        <div className="mt-3">
          <Sparkline points={points} />
        </div>
      </CardContent>
    </Card>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length === 0) return <div className="h-8" />;

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const width = 240;
  const height = 44;

  const polyline = points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * width;
      const y = height - ((p - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full">
      <polyline fill="none" stroke="#2f7c5f" strokeWidth="2" points={polyline} />
    </svg>
  );
}

function SimpleLineChart({ points, labels }: { points: number[]; labels: string[] }) {
  if (!points.length) {
    return <div className="py-8 text-sm text-[#6f897f]">No trend data yet.</div>;
  }

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const width = 640;
  const height = 220;

  const polyline = points
    .map((p, i) => {
      const x = 20 + (i / Math.max(points.length - 1, 1)) * (width - 40);
      const y = height - 24 - ((p - min) / range) * (height - 52);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full">
        <line x1="20" y1={height - 24} x2={width - 20} y2={height - 24} stroke="#dbe8e2" />
        <line x1="20" y1="16" x2="20" y2={height - 24} stroke="#dbe8e2" />
        <polyline fill="none" stroke="#2d775c" strokeWidth="3" points={polyline} />
      </svg>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-[#769187] md:grid-cols-8">
        {labels.slice(-8).map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <span className="text-[#3e5f54]">{label}</span>
      </div>
      <span className="font-medium text-[#1f3d34]">{value}</span>
    </div>
  );
}
