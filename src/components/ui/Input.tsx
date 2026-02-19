"use client";

import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

export function Input({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm font-medium text-gray-900">{label}</div> : null}
      <input
        {...props}
        className={clsx(
          "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#99613f]/30",
          className
        )}
      />
    </label>
  );
}
