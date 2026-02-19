"use client";

import { useEffect } from "react";

export function Toast({
  type,
  message,
  onClose,
}: {
  type: "success" | "error" | "info";
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const bg =
    type === "success" ? "bg-green-600" : type === "error" ? "bg-red-600" : "bg-gray-800";

  return (
    <div className={`${bg} fixed right-4 top-4 z-50 max-w-md rounded-xl px-4 py-3 text-sm text-white shadow-lg`}>
      {message}
    </div>
  );
}
