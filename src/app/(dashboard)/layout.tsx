import type { ReactNode } from "react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6efe8]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside className="rounded-3xl bg-white p-5 shadow-sm border border-black/5">
            <div className="text-xl font-extrabold text-[#4f2206]">Bo Coffee POS</div>
            <div className="mt-1 text-xs text-gray-600">Menu • Orders • Reports</div>

            <nav className="mt-6 space-y-2">
              <NavItem href="/menu" label="Menu" />
              <NavItem href="/pos" label="POS Order" />
              <NavItem href="/reports" label="Reports" />
            </nav>

            <div className="mt-6 rounded-2xl bg-[#f3e7dd] p-4 text-sm text-[#4f2206]">
              Tip: Use POS to create orders, later connect realtime dashboard.
            </div>
          </aside>

          <main className="space-y-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-black/5 bg-white px-4 py-3 font-semibold text-[#4f2206] hover:bg-black/5"
    >
      {label}
    </Link>
  );
}
