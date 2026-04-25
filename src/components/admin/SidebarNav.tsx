"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/menu", label: "Menu", icon: "☕" },
  { href: "/orders", label: "Orders", icon: "🧾" },
  { href: "/reports", label: "Reports", icon: "📈" },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {nav.map((x) => {
        const active = pathname === x.href;
        return (
          <Link
            key={x.href}
            href={x.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <span className="text-base">{x.icon}</span>
            {x.label}
          </Link>
        );
      })}
    </nav>
  );
}