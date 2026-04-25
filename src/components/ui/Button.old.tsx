"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60",
        variant === "primary" && "bg-[#4f2206] text-white hover:opacity-95",
        variant === "secondary" && "bg-white border border-black/10 text-[#4f2206] hover:bg-black/5",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className
      )}
    />
  );
}
