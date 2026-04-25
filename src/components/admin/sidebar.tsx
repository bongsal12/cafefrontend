"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Coffee, ShoppingBag, BarChart3 } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/menu", label: "Menu", icon: Coffee },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-70 border-r bg-background">
      <div className="p-5">
        <div className="font-bold text-lg">Bo Coffee</div>
        <div className="text-xs text-muted-foreground">Cafe Admin</div>
      </div>

      <div className="px-3 pb-6">
        {items.map((it) => {
          const active = pathname === it.href;
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted",
                active && "bg-foreground text-background hover:bg-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto p-4 text-xs text-muted-foreground">
        System <span className="ml-2 rounded-full bg-green-100 px-2 py-1 text-green-700">Online</span>
      </div>
    </aside>
  );
}