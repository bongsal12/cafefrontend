"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Coffee, LayoutDashboard, Package, QrCode, Shield, ShoppingBag, User, WalletCards, LogOut, Percent } from "lucide-react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useAuth } from "@/app/lib/auth-context";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, permission: "orders" },
  { href: "/admin/pos", label: "POS", icon: WalletCards, permission: "pos" },
  { href: "/admin/menu", label: "Products", icon: Coffee, permission: "products" },
  { href: "/admin/inventory", label: "Inventory", icon: Package, permission: "inventory" },
  { href: "/admin/discount", label: "Discounts", icon: Percent, permission: "discounts" },
  { href: "/admin/tables", label: "QR Tables", icon: QrCode, permission: "tables" },
  { href: "/admin/roles", label: "Role Access", icon: Shield, permission: "settings" },
  { href: "/admin/users", label: "Users", icon: User, permission: "users" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports" },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const isLoginPage = pathname === "/admin/login";

  function handleLogout() {
    logout();
    router.push("/admin/login");
  }

  const hasAccess = (permission: string) => {
    if (user?.role === "admin") return true;
    return user?.permissions?.includes(permission) ?? false;
  };

  const routePermission = (() => {
    if (pathname === "/admin") return "dashboard";
    if (pathname.startsWith("/admin/orders")) return "orders";
    if (pathname.startsWith("/admin/pos")) return "pos";
    if (pathname.startsWith("/admin/menu")) return "products";
    if (pathname.startsWith("/admin/users")) return "users";
    if (pathname.startsWith("/admin/inventory")) return "inventory";
    if (pathname.startsWith("/admin/discount")) return "discounts";
    if (pathname.startsWith("/admin/reports")) return "reports";
    if (pathname.startsWith("/admin/tables")) return "tables";
    if (pathname.startsWith("/admin/roles")) return "settings";
    return null;
  })();

  const landingPage = (() => {
    if (user?.role === "admin") return "/admin";
    const firstVisible = NAV_ITEMS.find((item) => hasAccess(item.permission));
    return firstVisible?.href ?? "/admin/login";
  })();

  useEffect(() => {
    if (isLoginPage) {
      setRedirecting(false);
      return;
    }

    if (routePermission && !hasAccess(routePermission)) {
      setRedirecting(true);
      router.replace(landingPage);
      return;
    }

    setRedirecting(false);
  }, [isLoginPage, landingPage, pathname, routePermission, router, user]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (redirecting) {
    return null;
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#f4f7f5]">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden w-70 flex-col border-r border-emerald-900/20 bg-linear-to-b from-[#083a2f] via-[#0b4b3a] to-[#0f5b46] text-[#eaf6f0] lg:flex">
            <div className="p-6">
              <div className="text-xl font-semibold tracking-tight">STARCOFFEE</div>
            </div>

            <nav className="space-y-1 px-3 pb-6 ">
              {NAV_ITEMS.filter((item) => hasAccess(item.permission)).map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)}
                />
              ))}
            </nav>

            <div className="mt-auto pb-40  space-y-4 p-4 ">
            
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg hover:cursor-pointer border border-emerald-100/20 bg-emerald-50/30 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-50/50"
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
                  <div className="font-semibold text-[#18352d] text-2xl">Cafe Admin</div>
                  {/* <div className="text-xs text-[#5a746c]">User: {user?.name} ({user?.role})</div> */}
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
      className={`flex items-center text-[16px] gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
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