"use client";
import { useState } from "react";
import { ProductsPanel } from "@/components/menu/products-panel";
import { CategoriesPanel } from "@/components/menu/categories-panel";
import { ProductTypesPanel } from "@/components/menu/product-types-panel";

export default function AdminMenuPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = () => setReloadKey((k) => k + 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <CategoriesPanel reloadKey={reloadKey} onNeedReload={triggerReload} />
        <ProductTypesPanel reloadKey={reloadKey} onNeedReload={triggerReload} />
      </div>
      <ProductsPanel reloadKey={reloadKey} onNeedReload={triggerReload} />
    </div>
  );
}