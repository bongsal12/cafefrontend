"use client";

import { AuthProvider } from "@/app/lib/auth-context";
import type { ReactNode } from "react";

export function ClientWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
