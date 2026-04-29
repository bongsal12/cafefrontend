"use client";

import { useAuth } from "@/app/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { login, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [loginInput, setLoginInput] = useState("admin");
  const [password, setPassword] = useState("12345678");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/admin");
    }
  }, [isAuthenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(loginInput, password);
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f4f7f5]">
        <div className="text-center">
          <div className="text-lg font-semibold text-[#1f3d34]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f4f7f5]">
      <div className="w-full max-w-md rounded-2xl border border-[#e5efea] bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#1f3d34]">STARCOFFEE</h1>
          <p className="mt-1 text-sm text-[#6f897f]">Admin Login</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1f3d34] mb-2">Name or Email</label>
            <input
              type="text"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              className="w-full rounded-lg border border-[#d7e4de] bg-white px-3 py-2 text-sm text-[#2a4a40] outline-none focus:ring-2 focus:ring-[#2f7c5f]/30"
              placeholder="admin or admin@example.com"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1f3d34] mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#d7e4de] bg-white px-3 py-2 text-sm text-[#2a4a40] outline-none focus:ring-2 focus:ring-[#2f7c5f]/30"
              placeholder="••••••••"
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#2f7c5f] py-2.5 font-medium text-white transition hover:bg-[#245a4a] disabled:opacity-50"
          >
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>

     
      </div>
    </div>
  );
}
