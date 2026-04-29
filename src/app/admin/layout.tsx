"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Coffee, LayoutDashboard, QrCode, Settings, ShoppingBag, Tag, Tags, WalletCards, LogOut } from "lucide-react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useAuth } from "@/app/lib/auth-context";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const router = useRouter();

  // Don't wrap login page with AdminGuard
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  function handleLogout() {
    logout();
    router.push("/admin/login");
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#f4f7f5]">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden w-70 flex-col border-r border-emerald-900/20 bg-gradient-to-b from-[#083a2f] via-[#0b4b3a] to-[#0f5b46] text-[#eaf6f0] lg:flex">
            <div className="p-6">
              <div className="text-xl font-semibold tracking-tight">STARCOFFEE</div>
              <div className="text-xs text-emerald-100/80">Cafe Admin</div>
            </div>

            <nav className="space-y-1 px-3 pb-6">
              <NavItem href="/admin" label="Dashboard" icon={LayoutDashboard} active={pathname === "/admin"} />
              <NavItem href="/admin/orders" label="Orders" icon={ShoppingBag} active={pathname.startsWith("/admin/orders")} />
              <NavItem href="/admin/users" label="Users" icon={Tags} active={pathname.startsWith("/admin/users")} />
              <NavItem href="/admin/pos" label="POS" icon={WalletCards} active={pathname.startsWith("/admin/pos")} />
              <NavItem href="/admin/menu" label="Products" icon={Coffee} active={pathname.startsWith("/admin/menu")} />
              <NavItem href="/admin/reports" label="Reports" icon={BarChart3} active={pathname.startsWith("/admin/reports")} />
              <NavItem href="/admin/reports" label="QR Tables" icon={QrCode} active={false} />
              <NavItem href="/admin/reports" label="Settings" icon={Settings} active={false} />
            </nav>

            <div className="mt-auto space-y-4 p-4">
              <div className="rounded-2xl border border-emerald-100/20 bg-emerald-50/95 p-4 text-[#1d3d33]">
                <div className="text-sm font-semibold">Good morning, {user?.name}!</div>
                <div className="mt-1 text-xs text-[#436459]">Role: <span className="font-medium capitalize">{user?.role}</span></div>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg border border-emerald-100/20 bg-emerald-50/30 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-50/50"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1">
            {/* Topbar */}
            <header className="sticky top-0 z-10 border-b border-emerald-900/10 bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between px-4 py-4 md:px-6">
                <div>
                  <div className="font-semibold text-[#18352d]">Cafe Admin</div>
                  <div className="text-xs text-[#5a746c]">User: {user?.name} ({user?.role})</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Live</span>
                  <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-xs text-[#3f5f55]">USD</span>
                </div>
              </div>
            </header>

            <main className="p-4 md:p-6">{children}</main>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? "bg-emerald-400/30 font-medium text-white"
          : "text-emerald-100/90 hover:bg-emerald-300/15 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}