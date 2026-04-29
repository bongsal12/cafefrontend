"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Activity, Clock3, DollarSign, Search, ShoppingBag, Wallet } from "lucide-react";
import { OrdersApi, type Order } from "@/app/lib/orders";
import { makeEcho } from "@/app/lib/echo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function isPaidLike(status: string) {
  const s = status.toLowerCase();
  return s === "paid" || s === "completed";
}

function isPendingLike(status: string) {
  const s = status.toLowerCase();
  return s === "pending" || s === "new" || s === "processing";
}

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

function pctChange(current: number, prev: number) {
  if (!prev && !current) return 0;
  if (!prev) return 100;
  return ((current - prev) / prev) * 100;
}

export default function DashboardPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [live, setLive] = useState(false);
  const [search, setSearch] = useState("");

  async function loadOrders() {
    try {
      const data = await OrdersApi.list();
      setOrders(data ?? []);
    } catch {
      // Keep dashboard visible with existing data.
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

  const parsed = useMemo(
    () =>
      orders
        .map((o) => ({
          ...o,
          totalValue: Number(o.total || 0),
          ts: new Date(o.created_at).getTime(),
        }))
        .filter((o) => Number.isFinite(o.ts)),
    [orders]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parsed;
    return parsed.filter((o) => {
      const refHit = o.reference?.toLowerCase().includes(q);
      const statusHit = o.status?.toLowerCase().includes(q);
      const itemHit = (o.items ?? []).some((it) => it.name.toLowerCase().includes(q));
      return refHit || statusHit || itemHit;
    });
  }, [parsed, search]);

  const dashboard = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const totalRevenue = filtered
      .filter((o) => o.status.toLowerCase() !== "cancelled")
      .reduce((sum, o) => sum + o.totalValue, 0);

    const paidOrders = filtered.filter((o) => isPaidLike(o.status)).length;
    const pendingOrders = filtered.filter((o) => isPendingLike(o.status)).length;
    const avgOrder = filtered.length ? totalRevenue / filtered.length : 0;

    const currentStart = now - 7 * dayMs;
    const prevStart = now - 14 * dayMs;

    const current = filtered.filter((o) => o.ts >= currentStart);
    const previous = filtered.filter((o) => o.ts >= prevStart && o.ts < currentStart);

    const currentRevenue = current
      .filter((o) => o.status.toLowerCase() !== "cancelled")
      .reduce((sum, o) => sum + o.totalValue, 0);
    const previousRevenue = previous
      .filter((o) => o.status.toLowerCase() !== "cancelled")
      .reduce((sum, o) => sum + o.totalValue, 0);

    const revenueDelta = pctChange(currentRevenue, previousRevenue);
    const paidDelta = pctChange(
      current.filter((o) => isPaidLike(o.status)).length,
      previous.filter((o) => isPaidLike(o.status)).length
    );
    const pendingDelta = pctChange(
      current.filter((o) => isPendingLike(o.status)).length,
      previous.filter((o) => isPendingLike(o.status)).length
    );
    const avgDelta = pctChange(
      current.length
        ? current
            .filter((o) => o.status.toLowerCase() !== "cancelled")
            .reduce((sum, o) => sum + o.totalValue, 0) / current.length
        : 0,
      previous.length
        ? previous
            .filter((o) => o.status.toLowerCase() !== "cancelled")
            .reduce((sum, o) => sum + o.totalValue, 0) / previous.length
        : 0
    );

    const trendMap = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now - i * dayMs);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      trendMap.set(key, 0);
    }
    for (const o of filtered) {
      if (o.ts < now - 7 * dayMs) continue;
      const d = new Date(o.ts);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      trendMap.set(key, (trendMap.get(key) ?? 0) + o.totalValue);
    }
    const trend = Array.from(trendMap.entries()).map(([label, value]) => ({ label, value }));

    const drinkMap = new Map<string, number>();
    for (const o of filtered) {
      for (const item of o.items ?? []) {
        const amount = Number(item.price || 0) * Number(item.qty || 0);
        drinkMap.set(item.name, (drinkMap.get(item.name) ?? 0) + amount);
      }
    }
    const topDrinks = Array.from(drinkMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const sorted = [...filtered].sort((a, b) => b.ts - a.ts);
    const recentOrders = sorted.slice(0, 5);
    const liveActivity = sorted.slice(0, 5);

    const completedCount = filtered.filter((o) => o.status.toLowerCase() === "completed").length;
    const cancelledCount = filtered.filter((o) => o.status.toLowerCase() === "cancelled").length;
    const paidLikeCount = filtered.filter((o) => isPaidLike(o.status)).length;
    const pendingCount = filtered.filter((o) => isPendingLike(o.status)).length;

    return {
      totalRevenue,
      paidOrders,
      pendingOrders,
      avgOrder,
      revenueDelta,
      paidDelta,
      pendingDelta,
      avgDelta,
      trend,
      topDrinks,
      recentOrders,
      liveActivity,
      completedCount,
      cancelledCount,
      paidLikeCount,
      pendingCount,
    };
  }, [filtered]);

  const donut = useMemo(() => {
    const total = Math.max(filtered.length, 1);
    const paidPct = (dashboard.paidLikeCount / total) * 100;
    const completedPct = (dashboard.completedCount / total) * 100;
    const pendingPct = (dashboard.pendingCount / total) * 100;
    const cancelledPct = (dashboard.cancelledCount / total) * 100;

    return {
      style: {
        background: `conic-gradient(#1d6a52 0 ${paidPct}%, #8ab9a5 ${paidPct}% ${paidPct + completedPct}%, #9bc9b6 ${paidPct + completedPct}% ${paidPct + completedPct + pendingPct}%, #d2e6dc ${paidPct + completedPct + pendingPct}% ${paidPct + completedPct + pendingPct + cancelledPct}%, #f0f6f3 ${paidPct + completedPct + pendingPct + cancelledPct}% 100%)`,
      } as CSSProperties,
      paidPct,
      completedPct,
      pendingPct,
      cancelledPct,
    };
  }, [dashboard, filtered.length]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#173b31]">Dashboard</h1>
          <p className="mt-1 text-sm text-[#5f7a70]">Welcome back. Here is what is happening in your cafe.</p>
        </div>
        <div className="flex w-full items-center gap-2 rounded-xl border border-[#d7e5de] bg-white px-3 py-2 lg:w-78">
          <Search className="h-4 w-4 text-[#6d8a80]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-[#27483e] outline-none placeholder:text-[#8aa198]"
            placeholder="Search orders, status, item..."
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={fmtMoney(dashboard.totalRevenue)}
          delta={dashboard.revenueDelta}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="Paid Orders"
          value={String(dashboard.paidOrders)}
          delta={dashboard.paidDelta}
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <StatCard
          title="Pending Orders"
          value={String(dashboard.pendingOrders)}
          delta={dashboard.pendingDelta}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <StatCard
          title="Avg Order Value"
          value={fmtMoney(dashboard.avgOrder)}
          delta={dashboard.avgDelta}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1.2fr_1fr]">
        <Card className="border-[#d8e6df] bg-white xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base text-[#1f3d34]">Revenue Trend (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              labels={dashboard.trend.map((t) => t.label)}
              points={dashboard.trend.map((t) => t.value)}
            />
          </CardContent>
        </Card>

        <Card className="border-[#d8e6df] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#1f3d34]">Top Selling Drinks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.topDrinks.length === 0 ? (
              <p className="text-sm text-[#6b857b]">No drink data yet.</p>
            ) : (
              dashboard.topDrinks.map((d, i) => {
                const peak = dashboard.topDrinks[0]?.amount || 1;
                const pct = Math.max((d.amount / peak) * 100, 8);
                return (
                  <div key={`${d.name}-${i}`}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate text-[#28473d]">{d.name}</span>
                      <span className="font-medium text-[#1f3d34]">{fmtMoney(d.amount)}</span>
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-[#1f3d34]">Live Activity</CardTitle>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${
                live
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {live ? "Realtime" : "Polling"}
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.liveActivity.length === 0 ? (
              <p className="text-sm text-[#6b857b]">No activity yet.</p>
            ) : (
              dashboard.liveActivity.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-[#e5efea] p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#eef6f2] p-2 text-[#2e7559]">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#22443a]">{o.reference}</div>
                      <div className="text-xs text-[#6e877e] capitalize">{o.status}</div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-[#1f3d34]">{fmtMoney(o.totalValue)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-[#d8e6df] bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-[#1f3d34]">Recent Orders</CardTitle>
            <span className="text-xs text-[#6f897f]">Last 5</span>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-130 text-sm">
                <thead>
                  <tr className="border-b border-[#e5efea] text-left text-[#6f897f]">
                    <th className="py-2">Order Ref</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Total</th>
                    <th className="py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-[#eef4f1] text-[#25443a]">
                      <td className="py-2 font-medium">
                        <span>{o.reference}</span>
                      </td>
                      <td className="py-2">
                        <span className="rounded-full bg-[#eef6f2] px-2 py-0.5 text-xs capitalize text-[#2c6f56]">
                          {o.status}
                        </span>
                      </td>
                      <td className="py-2">{fmtMoney(o.totalValue)}</td>
                      <td className="py-2">{new Date(o.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#d8e6df] bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#1f3d34]">Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto w-fit">
              <div className="relative h-40 w-40 rounded-full" style={donut.style}>
                <div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center">
                  <div>
                    <div className="text-xl font-semibold text-[#1d3b32]">{filtered.length}</div>
                    <div className="text-xs text-[#6f897f]">Orders</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <Legend color="#1d6a52" label="Paid/Completed" value={String(dashboard.paidLikeCount)} />
              <Legend color="#8ab9a5" label="Completed" value={String(dashboard.completedCount)} />
              <Legend color="#9bc9b6" label="Pending" value={String(dashboard.pendingCount)} />
              <Legend color="#d2e6dc" label="Cancelled" value={String(dashboard.cancelledCount)} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  delta,
  icon,
}: {
  title: string;
  value: string;
  delta: number;
  icon: ReactNode;
}) {
  const up = delta >= 0;
  return (
    <Card className="border-[#d8e6df] bg-white">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-[#6d877d]">{title}</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-[#1f3d34]">{value}</div>
            <div className={`mt-1 text-xs ${up ? "text-emerald-700" : "text-amber-700"}`}>
              {up ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs last 7 days
            </div>
          </div>
          <div className="rounded-xl border border-[#d7e5de] bg-[#f4faf7] p-2 text-[#2b6e56]">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LineChart({ labels, points }: { labels: string[]; points: number[] }) {
  if (!points.length) return <div className="py-8 text-sm text-[#6f897f]">No trend data yet.</div>;

  const width = 700;
  const height = 240;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);

  const line = points
    .map((p, i) => {
      const x = 24 + (i / Math.max(points.length - 1, 1)) * (width - 48);
      const y = height - 28 - ((p - min) / range) * (height - 56);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-54 w-full">
        <line x1="24" y1={height - 28} x2={width - 24} y2={height - 28} stroke="#dce9e3" />
        <line x1="24" y1="16" x2="24" y2={height - 28} stroke="#dce9e3" />
        <polyline fill="none" stroke="#2d775c" strokeWidth="3" points={line} />
      </svg>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-[#789287] md:grid-cols-7">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
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
