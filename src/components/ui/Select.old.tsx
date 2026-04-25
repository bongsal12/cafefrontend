"use client";

import clsx from "clsx";

export function Select({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string;
  value: string | number;
  onChange: (val: string) => void;
  options: { label: string; value: string | number }[];
  className?: string;
}) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm font-medium text-gray-900">{label}</div> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#99613f]/30",
          className
        )}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
