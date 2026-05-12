"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { InventoryApi } from "@/app/lib/inventory";
import type { InventoryItem, InventoryMovement, Product, Recipe, StockCountSession } from "@/app/types/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const IMAGE_BASE =
  process.env.NEXT_PUBLIC_IMAGE_BASE_URL ??
  process.env.NEXT_PUBLIC_IMAGEPATH ??
  "http://127.0.0.1:8000/storage";

const INGREDIENT_CATEGORIES = ["Dairy", "Coffee", "Sweetener", "Tea", "Other", "Packaging", "Syrup"];
const WASTE_REASONS = [
  "Spilled",
  "Expired",
  "Damaged",
  "Wrong Recipe",
  "Customer Complaint / Remake",
  "Staff Drink / Training",
  "Free Drink",
  "Unknown / Missing",
];

const DEFAULT_RECIPE_SUGAR_LEVELS = ["No sweet", "Less", "Normal", "More"];

function imageUrl(image?: string | null) {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;

  const base = IMAGE_BASE.replace(/\/$/, "");
  const origin = base.replace(/\/storage$/, "");
  const normalized = image.replace(/^\/+/, "");

  if (normalized.startsWith("storage/") && base.endsWith("/storage")) {
    return `${origin}/${normalized}`;
  }

  return `${base}/${normalized}`;
}

function fmtQty(n: number) {
  return Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function fmtMoney(n: number) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function fmtUnitMoney(n: number) {
  const fixed = Number(n ?? 0).toFixed(4);
  const trimmed = fixed.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  return `$${trimmed}`;
}

function parseWasteMeta(note?: string | null): { reason: string; note: string } {
  const raw = String(note ?? "").trim();
  if (!raw) return { reason: "-", note: "-" };

  const matched = raw.match(/^Reason:\s*(.*?)\s*(?:\|\s*Note:\s*(.*))?$/i);
  if (!matched) return { reason: raw, note: "-" };

  return {
    reason: matched[1]?.trim() || "-",
    note: matched[2]?.trim() || "-",
  };
}

function statusBadge(item: Pick<InventoryItem, "current_stock" | "low_stock_alert" | "is_active">) {
  if (!item.is_active) return <Badge variant="secondary">Inactive</Badge>;
  if (item.current_stock <= 0) return <Badge variant="destructive">Out</Badge>;
  if (item.current_stock <= item.low_stock_alert) return <Badge variant="outline">Low</Badge>;
  return <Badge variant="secondary">OK</Badge>;
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type IngredientForm = {
  name: string;
  category: string;
  unit: string;
  current_stock: string;
  low_stock_alert: string;
  cost_per_unit: string;
  is_active: boolean;
  imageFile?: File | null;
};

type RecipeRowForm = {
  inventory_item_id: number;
  quantity_used: string;
  sweetness_levels: Array<{ level: string; quantity: string }>;
};

export function InventoryModulePanel() {
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientCategory, setIngredientCategory] = useState("All");
  const [ingredientUnit, setIngredientUnit] = useState("All");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<InventoryItem | null>(null);
  const [ingredientForm, setIngredientForm] = useState<IngredientForm>({
    name: "",
    category: "Other",
    unit: "unit",
    current_stock: "0",
    low_stock_alert: "0",
    cost_per_unit: "0",
    is_active: true,
  });
  const [savingIngredient, setSavingIngredient] = useState(false);

  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseInvoice, setPurchaseInvoice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(getTodayString());
  const [purchaseNote, setPurchaseNote] = useState("");
  const [purchaseRows, setPurchaseRows] = useState([{ inventory_item_id: 0, quantity: "", unit_cost: "" }]);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [stockInRecords, setStockInRecords] = useState<InventoryMovement[]>([]);
  const [stockInFromDate, setStockInFromDate] = useState(getTodayString());
  const [stockInToDate, setStockInToDate] = useState(getTodayString());
  const [stockInLoading, setStockInLoading] = useState(false);

  const [wasteIngredientId, setWasteIngredientId] = useState<number>(0);
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReasonsList, setWasteReasonsList] = useState<string[]>([...WASTE_REASONS]);
  const [wasteReason, setWasteReason] = useState(WASTE_REASONS[0]);
  const [wasteNote, setWasteNote] = useState("");
  const [wasteDate, setWasteDate] = useState(getTodayString());
  const [savingWaste, setSavingWaste] = useState(false);
  const [wasteRecords, setWasteRecords] = useState<InventoryMovement[]>([]);
  const [wasteFromDate, setWasteFromDate] = useState(getTodayString());
  const [wasteToDate, setWasteToDate] = useState(getTodayString());
  const [wasteLoading, setWasteLoading] = useState(false);
  const [reasonsModalOpen, setReasonsModalOpen] = useState(false);
  const [newReason, setNewReason] = useState("");
  const [editingReasonIndex, setEditingReasonIndex] = useState<number | null>(null);
  const [movementRecords, setMovementRecords] = useState<InventoryMovement[]>([]);
  const [movementFromDate, setMovementFromDate] = useState(getTodayString());
  const [movementToDate, setMovementToDate] = useState(getTodayString());
  const [movementLoading, setMovementLoading] = useState(false);

  const [recipeProductId, setRecipeProductId] = useState<number>(0);
  const [recipeSize, setRecipeSize] = useState("Regular");
  const [recipeDescription, setRecipeDescription] = useState("");
  const [recipeSellingPrice, setRecipeSellingPrice] = useState("");
  const [recipeActive, setRecipeActive] = useState(true);
  const [recipeRows, setRecipeRows] = useState<RecipeRowForm[]>([
    { inventory_item_id: 0, quantity_used: "", sweetness_levels: [] },
  ]);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);

  const [countDate, setCountDate] = useState(getTodayString());
  const [countBranch, setCountBranch] = useState("Main Branch");
  const [countNote, setCountNote] = useState("");
  const [countRows, setCountRows] = useState([{ inventory_item_id: 0, actual_count: "", reason: "Counting correction" }]);
  const [savingCount, setSavingCount] = useState(false);

  const categories = useMemo(() => ["All", ...Array.from(new Set(ingredients.map((i) => i.category || "Other")))], [ingredients]);
  const units = useMemo(() => ["All", ...Array.from(new Set(ingredients.map((i) => i.unit || "unit")))], [ingredients]);

  const filteredIngredients = useMemo(() => {
    const q = ingredientSearch.trim().toLowerCase();
    return ingredients.filter((i) => {
      const matchesSearch = !q || i.name.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q);
      const matchesCategory = ingredientCategory === "All" || i.category === ingredientCategory;
      const matchesUnit = ingredientUnit === "All" || i.unit === ingredientUnit;
      return matchesSearch && matchesCategory && matchesUnit;
    });
  }, [ingredientSearch, ingredientCategory, ingredientUnit, ingredients]);

  const selectedRecipeProduct = useMemo(
    () => products.find((p) => p.id === recipeProductId) ?? null,
    [products, recipeProductId],
  );

  const selectedRecipeVariant = useMemo(
    () => selectedRecipeProduct?.variants?.find((v) => v.size === recipeSize) ?? selectedRecipeProduct?.variants?.[0] ?? null,
    [selectedRecipeProduct, recipeSize],
  );

  const recipeSizeOptions = selectedRecipeProduct?.variants ?? [];

  async function loadAll() {
    setLoading(true);
    try {
      const [items, recipeRowsData, dashboardData, productResp, wasteRows, stockInRows, movementRows] = await Promise.all([
        InventoryApi.list(),
        InventoryApi.recipes().catch(() => []),
        InventoryApi.dashboard().catch(() => null),
        fetchProducts(),
        InventoryApi.wasteRecords({ limit: 500 }).catch(() => []),
        InventoryApi.stockInRecords({ limit: 500 }).catch(() => []),
        InventoryApi.movementRecords({ limit: 500 }).catch(() => []),
      ]);
      setIngredients(items);
      setMovements(dashboardData?.recent_movements ?? []);
      setRecipes(recipeRowsData);
      setDashboard(dashboardData);
      setProducts(productResp);
      setWasteRecords(wasteRows);
      setStockInRecords(stockInRows);
      setMovementRecords(movementRows);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load inventory module");
    } finally {
      setLoading(false);
    }
  }

  async function loadWasteRecords() {
    setWasteLoading(true);
    try {
      const rows = await InventoryApi.wasteRecords({
        from: wasteFromDate || undefined,
        to: wasteToDate || undefined,
        limit: 500,
      });
      setWasteRecords(rows);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load waste records");
    } finally {
      setWasteLoading(false);
    }
  }

  async function loadStockInRecords() {
    setStockInLoading(true);
    try {
      const rows = await InventoryApi.stockInRecords({
        from: stockInFromDate || undefined,
        to: stockInToDate || undefined,
        limit: 500,
      });
      setStockInRecords(rows);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load stock-in records");
    } finally {
      setStockInLoading(false);
    }
  }

  async function loadMovementRecords() {
    setMovementLoading(true);
    try {
      const rows = await InventoryApi.movementRecords({
        from: movementFromDate || undefined,
        to: movementToDate || undefined,
        limit: 500,
      });
      setMovementRecords(rows);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load movement records");
    } finally {
      setMovementLoading(false);
    }
  }

  async function fetchProducts(): Promise<Product[]> {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api"}/products?is_active=true`, {
        credentials: "include",
      });
      const json = await res.json();
      return (json.data ?? json ?? []) as Product[];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadWasteRecords();
  }, [wasteFromDate, wasteToDate]);

  useEffect(() => {
    loadStockInRecords();
  }, [stockInFromDate, stockInToDate]);

  useEffect(() => {
    loadMovementRecords();
  }, [movementFromDate, movementToDate]);

  useEffect(() => {
    if (!selectedRecipeProduct) {
      if (recipeProductId !== 0) setRecipeSize("Regular");
      return;
    }

    const firstSize = selectedRecipeProduct.variants?.[0]?.size;
    if (firstSize && !selectedRecipeProduct.variants.some((v) => v.size === recipeSize)) {
      setRecipeSize(firstSize);
      if (recipeSellingPrice === "" && Number(selectedRecipeProduct.variants?.[0]?.price ?? 0) > 0) {
        setRecipeSellingPrice(String(selectedRecipeProduct.variants[0].price));
      }
    }
  }, [recipeProductId, selectedRecipeProduct, recipeSize, recipeSellingPrice]);

  function openIngredientSheet(item?: InventoryItem) {
    if (item) {
      setEditingIngredient(item);
      setIngredientForm({
        name: item.name,
        category: item.category || "Other",
        unit: item.unit,
        current_stock: String(item.current_stock),
        low_stock_alert: String(item.low_stock_alert),
        cost_per_unit: Number(item.cost_per_unit ?? 0)
          .toFixed(4)
          .replace(/(\.\d*?[1-9])0+$/, "$1")
          .replace(/\.0+$/, ""),
        is_active: item.is_active,
      });
    } else {
      setEditingIngredient(null);
      setIngredientForm({
        name: "",
        category: "Other",
        unit: "unit",
        current_stock: "0",
        low_stock_alert: "0",
        cost_per_unit: "0.0000",
        is_active: true,
      });
    }
    setSheetOpen(true);
  }

  async function saveIngredient() {
    if (!ingredientForm.name.trim()) return toast.error("Ingredient name is required");
    if (!ingredientForm.unit.trim()) return toast.error("Unit is required");

    setSavingIngredient(true);
    try {
      const payload = {
        name: ingredientForm.name.trim(),
        category: ingredientForm.category,
        unit: ingredientForm.unit.trim(),
        low_stock_alert: Number(ingredientForm.low_stock_alert),
        cost_per_unit: Number(ingredientForm.cost_per_unit),
        is_active: ingredientForm.is_active,
        imageFile: ingredientForm.imageFile ?? undefined,
      };

      if (editingIngredient) {
        await InventoryApi.updateSettings(editingIngredient.id, payload);
        toast.success("Ingredient updated");
      } else {
        await InventoryApi.create({
          ...payload,
          current_stock: Number(ingredientForm.current_stock),
        });
        toast.success("Ingredient created");
      }

      setSheetOpen(false);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save ingredient");
    } finally {
      setSavingIngredient(false);
    }
  }

  function updatePurchaseRow(index: number, key: keyof (typeof purchaseRows)[number], value: string | number) {
    setPurchaseRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function updateRecipeRow(index: number, key: "inventory_item_id" | "quantity_used", value: string | number) {
    setRecipeRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        if (key === "inventory_item_id") {
          const nextId = Number(value);
          const selected = ingredients.find((ing) => ing.id === nextId);
          const category = (selected?.category ?? "").toLowerCase();
          const name = (selected?.name ?? "").toLowerCase();
          const isSugarIngredient = category === "sweetener" || name.includes("sugar");
          const levels = isSugarIngredient ? DEFAULT_RECIPE_SUGAR_LEVELS : [];

          return {
            ...row,
            inventory_item_id: nextId,
            sweetness_levels: levels.map((level) => ({
              level,
              quantity: row.sweetness_levels.find((s) => s.level === level)?.quantity ?? "",
            })),
          };
        }

        return {
          ...row,
          quantity_used: String(value),
        };
      }),
    );
  }

  function updateRecipeSweetnessRow(index: number, levelIndex: number, value: string) {
    setRecipeRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        return {
          ...row,
          sweetness_levels: row.sweetness_levels.map((level, j) => (j === levelIndex ? { ...level, quantity: value } : level)),
        };
      }),
    );
  }

  function updateCountRow(index: number, key: keyof (typeof countRows)[number], value: string | number) {
    setCountRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  async function savePurchase() {
    const items = purchaseRows.filter((r) => Number(r.inventory_item_id) > 0 && Number(r.quantity) > 0 && Number(r.unit_cost) >= 0);
    if (!items.length) return toast.error("Add at least one purchase item");

    const supplierValue = purchaseSupplier.trim() || "Walk-in Supplier";
    const invoiceValue = purchaseInvoice.trim() || `AUTO-${Date.now()}`;

    setSavingPurchase(true);
    try {
      await InventoryApi.stockIn({
        supplier: supplierValue,
        invoice_no: invoiceValue,
        purchase_date: purchaseDate,
        note: purchaseNote.trim() || undefined,
        items: items.map((r) => ({
          inventory_item_id: Number(r.inventory_item_id),
          quantity: Number(r.quantity),
          unit_cost: Number(r.unit_cost),
        })),
      });
      toast.success("Stock in saved");
      setPurchaseSupplier("");
      setPurchaseInvoice("");
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setPurchaseNote("");
      setPurchaseRows([{ inventory_item_id: 0, quantity: "", unit_cost: "" }]);
      await loadAll();
    } catch (e: any) {
      let msg = e?.message || "Failed to save stock in";
      try {
        const parsed = JSON.parse(String(msg));
        if (parsed?.errors) {
          msg = Object.values(parsed.errors).flat().join(" | ");
        } else if (parsed?.message) {
          msg = parsed.message;
        }
      } catch {
        // keep raw message
      }
      toast.error(msg);
    } finally {
      setSavingPurchase(false);
    }
  }

  function addOrUpdateReason() {
    if (!newReason.trim()) {
      toast.error("Reason cannot be empty");
      return;
    }

    if (editingReasonIndex !== null) {
      // Update existing reason
      const updated = [...wasteReasonsList];
      updated[editingReasonIndex] = newReason.trim();
      setWasteReasonsList(updated);
      toast.success("Reason updated");
      setEditingReasonIndex(null);
    } else {
      // Add new reason
      if (wasteReasonsList.includes(newReason.trim())) {
        toast.error("This reason already exists");
        return;
      }
      setWasteReasonsList([...wasteReasonsList, newReason.trim()]);
      toast.success("Reason added");
    }

    setNewReason("");
  }

  function deleteReason(index: number) {
    const reasonToDelete = wasteReasonsList[index];
    const updated = wasteReasonsList.filter((_, i) => i !== index);
    setWasteReasonsList(updated);

    // If deleted reason was selected, switch to first available
    if (wasteReason === reasonToDelete && updated.length > 0) {
      setWasteReason(updated[0]);
    }

    toast.success("Reason deleted");
  }

  function editReason(index: number) {
    setNewReason(wasteReasonsList[index]);
    setEditingReasonIndex(index);
  }

  async function saveWaste() {
    if (!wasteIngredientId) return toast.error("Ingredient is required");
    if (Number(wasteQty) <= 0) return toast.error("Quantity must be greater than zero");

    setSavingWaste(true);
    try {
      await InventoryApi.waste({
        inventory_item_id: wasteIngredientId,
        quantity: Number(wasteQty),
        reason: wasteReason,
        date: wasteDate,
        note: wasteNote.trim() || undefined,
      });
      toast.success("Waste saved");
      setWasteQty("");
      setWasteNote("");
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save waste");
    } finally {
      setSavingWaste(false);
    }
  }

  function openRecipeForm(recipe?: Recipe) {
    if (recipe) {
      setEditingRecipeId(recipe.id);
      setRecipeProductId(recipe.product_id);
      setRecipeSize(recipe.size);
      setRecipeDescription(recipe.description || "");
      setRecipeSellingPrice(String(recipe.selling_price));
      setRecipeActive(recipe.status === "Active");
      setRecipeRows(
        recipe.items.map((item) => ({
          inventory_item_id: item.inventory_item_id,
          quantity_used: String(item.quantity_used),
          sweetness_levels: [],
        })),
      );
    } else {
      setEditingRecipeId(null);
      setRecipeProductId(0);
      setRecipeSize("Regular");
      setRecipeDescription("");
      setRecipeSellingPrice("");
      setRecipeActive(true);
      setRecipeRows([{ inventory_item_id: 0, quantity_used: "", sweetness_levels: [] }]);
    }
  }

  async function deleteRecipe(recipeId: number) {
    if (!confirm("Delete this recipe?")) return;
    try {
      await InventoryApi.deleteRecipe(recipeId);
      toast.success("Recipe deleted");
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete recipe");
    }
  }

  async function saveRecipe() {
    if (!recipeProductId) return toast.error("Menu item is required");
    if (!recipeSize.trim()) return toast.error("Size is required");
    if (Number(recipeSellingPrice) < 0) return toast.error("Selling price is required");

    const items = recipeRows.filter((r) => Number(r.inventory_item_id) > 0 && Number(r.quantity_used) > 0);
    if (!items.length) return toast.error("Add recipe ingredients");

    const sweetness = recipeRows.flatMap((row) =>
      row.sweetness_levels
        .filter((s) => s.level.trim() && Number(s.quantity) >= 0)
        .map((s) => ({
          level: s.level.trim(),
          inventory_item_id: Number(row.inventory_item_id) || null,
          quantity: Number(s.quantity),
        })),
    ).filter((s) => s.level && s.inventory_item_id);

    setSavingRecipe(true);
    try {
      if (editingRecipeId) {
        await InventoryApi.updateRecipe(editingRecipeId, {
          size: recipeSize.trim(),
          description: recipeDescription.trim() || undefined,
          selling_price: Number(recipeSellingPrice),
          is_active: recipeActive,
          items: items.map((r) => ({
            inventory_item_id: Number(r.inventory_item_id),
            quantity_used: Number(r.quantity_used),
            unit: ingredients.find((i) => i.id === Number(r.inventory_item_id))?.unit || "ml",
          })),
          sweetness_options: sweetness,
        });
        toast.success("Recipe updated");
      } else {
        await InventoryApi.saveRecipe({
          product_id: recipeProductId,
          size: recipeSize.trim(),
          description: recipeDescription.trim() || undefined,
          selling_price: Number(recipeSellingPrice),
          is_active: recipeActive,
          items: items.map((r) => ({
            inventory_item_id: Number(r.inventory_item_id),
            quantity_used: Number(r.quantity_used),
            unit: ingredients.find((i) => i.id === Number(r.inventory_item_id))?.unit || "ml",
          })),
          sweetness_options: sweetness,
        });
        toast.success("Recipe saved");
      }
      openRecipeForm();
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save recipe");
    } finally {
      setSavingRecipe(false);
    }
  }

  async function saveCount() {
    const items = countRows.filter((r) => Number(r.inventory_item_id) > 0 && Number(r.actual_count) >= 0);
    if (!items.length) return toast.error("Add counted items");

    setSavingCount(true);
    try {
      await InventoryApi.stockCount({
        count_date: countDate,
        branch: countBranch.trim() || undefined,
        note: countNote.trim() || undefined,
        status: "submitted",
        apply: true,
        items: items.map((r) => ({
          inventory_item_id: Number(r.inventory_item_id),
          actual_count: Number(r.actual_count),
          reason: r.reason,
        })),
      });
      toast.success("Stock count submitted");
      setCountRows([{ inventory_item_id: 0, actual_count: "", reason: "Counting correction" }]);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save stock count");
    } finally {
      setSavingCount(false);
    }
  }

  const summary = dashboard?.summary ?? {
    total_ingredients: ingredients.length,
    low_stock: ingredients.filter((i) => i.current_stock <= i.low_stock_alert).length,
    out_of_stock: ingredients.filter((i) => i.current_stock <= 0).length,
    today_waste_cost: 0,
    unavailable_menus: 0,
  };

  const recentWaste = wasteRecords;
  const dashboardLow: InventoryItem[] = dashboard?.low_stock_items ?? ingredients.filter((i) => i.current_stock <= i.low_stock_alert).slice(0, 5);
  const unavailableMenus = dashboard?.unavailable_menu_items ?? [];
  const topUsed = dashboard?.top_used_ingredients ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#173b31]">Inventory</h1>
        
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4 ">
        <TabsList className="flex flex-wrap  justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="dashboard" className="text-md">Dashboard</TabsTrigger>
          <TabsTrigger value="ingredients" className="text-md">Ingredients</TabsTrigger>
          <TabsTrigger value="stock-in" className="text-md">Stock In</TabsTrigger>
          <TabsTrigger value="waste" className="text-md">Waste</TabsTrigger>
          <TabsTrigger value="recipes" className="text-md">Recipes</TabsTrigger>
          {/* <TabsTrigger value="stock-count" className="text-md">Stock Count</TabsTrigger> */}
          <TabsTrigger value="movements" className="text-md">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard title="Total Ingredients" value={String(summary.total_ingredients)} subtitle="" />
            <SummaryCard title="Low Stock" value={String(summary.low_stock)} subtitle="" />
            <SummaryCard title="Out of Stock" value={String(summary.out_of_stock)} subtitle="" />
            <SummaryCard title="Today Waste Cost" value={fmtMoney(summary.today_waste_cost)} subtitle="" />
            <SummaryCard title="Unavailable Menus" value={String(summary.unavailable_menus)} subtitle="" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="rounded-3xl lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Low Stock Ingredients</CardTitle>
                  
                </div>
                <Button variant="outline" onClick={() => setTab("ingredients")}>View all ingredients</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Low Alert</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardLow.slice(0, 6).map((item: InventoryItem) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.category}</div>
                        </TableCell>
                        <TableCell>{fmtQty(item.current_stock)} {item.unit}</TableCell>
                        <TableCell>{fmtQty(item.low_stock_alert)} {item.unit}</TableCell>
                        <TableCell>{statusBadge(item)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Recent Stock Movements</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.slice(0, 5).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{ingredients.find((i) => i.id === m.inventory_item_id)?.name ?? "-"}</TableCell>
                        <TableCell><Badge variant={m.type === "waste" || m.type === "sale_usage" ? "destructive" : "secondary"}>{m.type}</Badge></TableCell>
                        <TableCell>{fmtQty(m.quantity)} {m.unit}</TableCell>
                        <TableCell>{fmtQty(m.after_stock)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Top Used Ingredients Today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topUsed.length ? topUsed.map((row: any) => (
                  <div key={row.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{row.name}</span>
                      <span className="font-medium">{fmtQty(row.quantity)} {row.unit}</span>
                    </div>
                    <div className="h-2 rounded-full bg-emerald-100">
                      <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, row.quantity * 4)}%` }} />
                    </div>
                  </div>
                )) : <div className="text-sm text-muted-foreground">No usage data yet.</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ingredients" className="space-y-6">
          <Card className="rounded-3xl">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Ingredients</CardTitle>
                
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input placeholder="Search ingredients..." value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)} className="md:w-64" />
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={ingredientCategory} onChange={(e) => setIngredientCategory(e.target.value)}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={ingredientUnit} onChange={(e) => setIngredientUnit(e.target.value)}>
                  {units.map((u) => <option key={u}>{u}</option>)}
                </select>
                <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openIngredientSheet()}>+ Add Ingredient</Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-2xl">
                    <DialogHeader className="border-b bg-[#f7fbf9] px-6 py-5">
                      <DialogTitle className="text-xl font-semibold text-[#173b31]">{editingIngredient ? "Edit Ingredient" : "Add Ingredient"}</DialogTitle>
                      
                    </DialogHeader>
                    <div className="max-h-[calc(92vh-170px)] overflow-y-auto overflow-x-hidden px-6 py-5">
                      <div className="space-y-5">
                      <Field label="Ingredient Name">
                        <Input value={ingredientForm.name} onChange={(e) => setIngredientForm((p) => ({ ...p, name: e.target.value }))} />
                      </Field>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Category">
                          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={ingredientForm.category} onChange={(e) => setIngredientForm((p) => ({ ...p, category: e.target.value }))}>
                            {INGREDIENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </Field>
                        <Field label="Unit"><Input value={ingredientForm.unit} onChange={(e) => setIngredientForm((p) => ({ ...p, unit: e.target.value }))} /></Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Cost Per Unit"><Input type="number" step="0.0001" value={ingredientForm.cost_per_unit} onChange={(e) => setIngredientForm((p) => ({ ...p, cost_per_unit: e.target.value }))} /></Field>
                        <Field label="Low Stock Alert"><Input type="number" step="0.001" value={ingredientForm.low_stock_alert} onChange={(e) => setIngredientForm((p) => ({ ...p, low_stock_alert: e.target.value }))} /></Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Initial Stock">
                          <Input
                            type="number"
                            step="0.001"
                            disabled={Boolean(editingIngredient)}
                            value={ingredientForm.current_stock}
                            onChange={(e) => setIngredientForm((p) => ({ ...p, current_stock: e.target.value }))}
                          />
                          {editingIngredient ? <div className="text-xs text-muted-foreground">Use Stock In, Waste, or Stock Count to change current stock.</div> : null}
                        </Field>
                        <Field label="Status">
                          <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                            <input type="checkbox" checked={ingredientForm.is_active} onChange={(e) => setIngredientForm((p) => ({ ...p, is_active: e.target.checked }))} />
                            Active
                          </label>
                        </Field>
                      </div>

                      <Field label="Image URL / File">
                        <Input type="file" accept="image/*" onChange={(e) => setIngredientForm((p) => ({ ...p, imageFile: e.target.files?.[0] ?? null }))} />
                      </Field>

                      </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t bg-muted/30 px-6 py-4">
                        <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                        <Button onClick={saveIngredient} disabled={savingIngredient}>{savingIngredient ? "Saving..." : "Save"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Low Stock Alert</TableHead>
                    <TableHead>Cost / Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIngredients.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.image ? <img src={imageUrl(item.image)} alt={item.name} className="h-10 w-10 rounded-lg border object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-xs">No img</div>}
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.slug}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{fmtQty(item.current_stock)}</TableCell>
                      <TableCell>{fmtQty(item.low_stock_alert)}</TableCell>
                      <TableCell>{fmtUnitMoney(item.cost_per_unit)}</TableCell>
                      <TableCell>{statusBadge(item)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openIngredientSheet(item)}>Edit</Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              const ok = window.confirm(`Delete ${item.name}? This cannot be undone.`);
                              if (!ok) return;
                              try {
                                await InventoryApi.remove(item.id);
                                toast.success("Ingredient deleted");
                                await loadAll();
                              } catch (e: any) {
                                toast.error(e?.message || "Failed to delete ingredient");
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock-in" className="space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Stock In</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Supplier"><Input value={purchaseSupplier} onChange={(e) => setPurchaseSupplier(e.target.value)} /></Field>
                <Field label="Purchase Date"><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></Field>
                <Field label="Note"><Input value={purchaseNote} onChange={(e) => setPurchaseNote(e.target.value)} /></Field>
              </div>

              <div className="space-y-3">
                {purchaseRows.map((row, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-4">
                    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={row.inventory_item_id} onChange={(e) => updatePurchaseRow(index, "inventory_item_id", Number(e.target.value))}>
                      <option value={0}>Select ingredient</option>
                      {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <Input placeholder="Quantity" type="number" step="0.001" value={row.quantity} onChange={(e) => updatePurchaseRow(index, "quantity", e.target.value)} />
                    <Input placeholder="Unit cost" type="number" step="0.0001" value={row.unit_cost} onChange={(e) => updatePurchaseRow(index, "unit_cost", e.target.value)} />
                    <Button variant="outline" onClick={() => setPurchaseRows((p) => [...p, { inventory_item_id: 0, quantity: "", unit_cost: "" }])}>+ Add Item</Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={savePurchase} disabled={savingPurchase}>{savingPurchase ? "Saving..." : "Save Stock In"}</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Stock In History</CardTitle>
             
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <Field label="From">
                  <Input type="date" value={stockInFromDate} onChange={(e) => setStockInFromDate(e.target.value)} />
                </Field>
                <Field label="To">
                  <Input type="date" value={stockInToDate} onChange={(e) => setStockInToDate(e.target.value)} />
                </Field>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                        const today = new Date().toISOString().slice(0, 10);
                        setStockInFromDate(today);
                        setStockInToDate(today);
                    }}
                  >
                    Clear Filter
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockInRecords.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.created_at ? new Date(m.created_at).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>{m.ingredient_name ?? ingredients.find((i) => i.id === m.inventory_item_id)?.name ?? "-"}</TableCell>
                      <TableCell>{fmtQty(m.quantity)} {m.unit}</TableCell>
                      <TableCell>{m.note ?? "-"}</TableCell>
                      <TableCell>{fmtQty(m.before_stock)}</TableCell>
                      <TableCell>{fmtQty(m.after_stock)}</TableCell>
                    </TableRow>
                  ))}
                  {stockInRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        {stockInLoading ? "Loading stock-in records..." : "No stock-in records for selected date range"}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waste" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="rounded-3xl xl:col-span-1">
              <CardHeader>
                <CardTitle>Record Waste</CardTitle>
                
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Ingredient">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={wasteIngredientId} onChange={(e) => setWasteIngredientId(Number(e.target.value))}>
                    <option value={0}>Select ingredient</option>
                    {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Quantity"><Input type="number" step="0.001" value={wasteQty} onChange={(e) => setWasteQty(e.target.value)} /></Field>
                  <Field label="Date"><Input type="date" value={wasteDate} onChange={(e) => setWasteDate(e.target.value)} /></Field>
                </div>
                <Field label="Reason">
                  <div className="flex gap-2">
                    <select className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" value={wasteReason} onChange={(e) => setWasteReason(e.target.value)}>
                      {wasteReasonsList.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <Button variant="outline" size="sm" onClick={() => {
                      setReasonsModalOpen(true);
                      setNewReason("");
                      setEditingReasonIndex(null);
                    }}>
                      Manage
                    </Button>
                  </div>
                </Field>
                <Field label="Note"><Input value={wasteNote} onChange={(e) => setWasteNote(e.target.value)} /></Field>
                <Button className="w-full" onClick={saveWaste} disabled={savingWaste}>{savingWaste ? "Saving..." : "Save Waste"}</Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl xl:col-span-2">
              <CardHeader>
                <CardTitle>Waste History</CardTitle>
                
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <Field label="From">
                    <Input type="date" value={wasteFromDate} onChange={(e) => setWasteFromDate(e.target.value)} />
                  </Field>
                  <Field label="To">
                    <Input type="date" value={wasteToDate} onChange={(e) => setWasteToDate(e.target.value)} />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const today = new Date().toISOString().slice(0, 10);
                        setWasteFromDate(today);
                        setWasteToDate(today);
                      }}
                    >
                      Clear Filter
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Before</TableHead>
                      <TableHead>After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentWaste.map((m) => (
                      <TableRow key={m.id}>
                        {(() => {
                          const meta = parseWasteMeta(m.note);
                          return (
                            <>
                        <TableCell>{(m as any).ingredient_name ?? ingredients.find((i) => i.id === m.inventory_item_id)?.name ?? "-"}</TableCell>
                        <TableCell>{fmtQty(m.quantity)} {m.unit}</TableCell>
                        <TableCell>{meta.reason}</TableCell>
                        <TableCell>{meta.note}</TableCell>
                        <TableCell>{fmtQty(m.before_stock)}</TableCell>
                        <TableCell>{fmtQty(m.after_stock)}</TableCell>
                            </>
                          );
                        })()}
                      </TableRow>
                    ))}
                    {recentWaste.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          {wasteLoading ? "Loading waste records..." : "No waste records for selected date range"}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Dialog open={reasonsModalOpen} onOpenChange={setReasonsModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Manage Waste Reasons</DialogTitle>
                <DialogDescription>Add, edit, or delete waste reasons</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder={editingReasonIndex !== null ? "Edit reason..." : "New reason..."}
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") addOrUpdateReason();
                    }}
                  />
                  <Button onClick={addOrUpdateReason}>
                    {editingReasonIndex !== null ? "Update" : "Add"}
                  </Button>
                  {editingReasonIndex !== null && (
                    <Button variant="outline" onClick={() => {
                      setNewReason("");
                      setEditingReasonIndex(null);
                    }}>
                      Cancel
                    </Button>
                  )}
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {wasteReasonsList.map((reason, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md border p-3 bg-background"
                    >
                      <span className="text-sm">{reason}</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => editReason(index)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteReason(index)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="recipes" className="space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Recipes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Menu Item">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={recipeProductId} onChange={(e) => setRecipeProductId(Number(e.target.value))} disabled={!!editingRecipeId}>
                    <option value={0}>Select menu item</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Size">
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={recipeSize}
                    onChange={(e) => {
                      const nextSize = e.target.value;
                      setRecipeSize(nextSize);
                      const nextVariant = selectedRecipeProduct?.variants?.find((v) => v.size === nextSize);
                      if (nextVariant && Number(nextVariant.price ?? 0) > 0) {
                        setRecipeSellingPrice(String(nextVariant.price));
                      }
                    }}
                    disabled={!selectedRecipeProduct?.variants?.length}
                  >
                    <option value="">Select size</option>
                    {recipeSizeOptions.map((variant) => (
                      <option key={variant.id ?? variant.size} value={variant.size}>
                        {variant.size}
                      </option>
                    ))}
                  </select>
                  {!selectedRecipeProduct?.variants?.length ? (
                    <div className="text-xs text-muted-foreground"></div>
                  ) : null}
                </Field>
                <Field label="Selling Price"><Input type="number" step="0.01" value={recipeSellingPrice} onChange={(e) => setRecipeSellingPrice(e.target.value)} /></Field>
                <Field label="Description"><Input value={recipeDescription} onChange={(e) => setRecipeDescription(e.target.value)} /></Field>
              </div>

              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recipeActive} onChange={(e) => setRecipeActive(e.target.checked)} /> Active recipe</label>

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">Base Ingredients</h3>
                {recipeRows.map((row, index) => (
                  <div key={index} className="space-y-3 rounded-2xl border p-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={row.inventory_item_id} onChange={(e) => updateRecipeRow(index, "inventory_item_id", Number(e.target.value))}>
                        <option value={0}>Select ingredient</option>
                        {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      <Input placeholder="Quantity used" type="number" step="0.001" value={row.quantity_used} onChange={(e) => updateRecipeRow(index, "quantity_used", e.target.value)} />
                      <Button variant="outline" onClick={() => setRecipeRows((p) => [...p, { inventory_item_id: 0, quantity_used: "", sweetness_levels: [] }])}>+ Add Ingredient</Button>
                      {recipeRows.length > 1 ? (
                        <Button variant="destructive" onClick={() => setRecipeRows((p) => p.filter((_, i) => i !== index))}>Remove</Button>
                      ) : null}
                    </div>

                    {row.sweetness_levels.length > 0 ? (
                      <div className="rounded-2xl border bg-muted/30 p-3">
                        <div className="mb-3 text-sm font-medium">Sugar levels from database</div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {row.sweetness_levels.map((level, levelIndex) => (
                            <Field key={`${index}-${level.level}-${levelIndex}`} label={level.level}>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Quantity"
                                value={level.quantity}
                                onChange={(e) => updateRecipeSweetnessRow(index, levelIndex, e.target.value)}
                              />
                            </Field>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 ">
                {editingRecipeId && <Button variant="outline" onClick={() => openRecipeForm()}>Cancel</Button>}
                <Button onClick={saveRecipe} disabled={savingRecipe}>{savingRecipe ? "Saving..." : editingRecipeId ? "Update Recipe" : "Save Recipe"}</Button>
              </div>

              <Separator />

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Menu Item</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Selling Price</TableHead>
                        <TableHead>Total Cost</TableHead>
                        <TableHead>Profit</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipes.map((recipe) => (
                        <TableRow key={recipe.id}>
                          <TableCell>
                            <div className="font-medium">{recipe.product_name}</div>
                            <div className="text-xs text-muted-foreground">{recipe.category}</div>
                          </TableCell>
                          <TableCell>{recipe.size}</TableCell>
                          <TableCell>{fmtMoney(recipe.selling_price)}</TableCell>
                          <TableCell>{fmtMoney(recipe.total_cost)}</TableCell>
                          <TableCell>{fmtMoney(recipe.profit)} <span className="text-xs text-muted-foreground">({recipe.margin}%)</span></TableCell>
                          <TableCell><Badge variant={recipe.status === "Active" ? "secondary" : "outline"}>{recipe.status}</Badge></TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => openRecipeForm(recipe)}>Edit</Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteRecipe(recipe.id)}>Delete</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Card className="rounded-3xl">
                  <CardHeader>
                    <CardTitle>Recipe Alerts</CardTitle>
                    <CardDescription>Recipes affected by low ingredients</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {dashboard?.unavailable_menu_items?.length ? dashboard.unavailable_menu_items.map((row: any) => (
                      <div key={row.id} className="rounded-2xl border p-3">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-muted-foreground">{row.reason}</div>
                      </div>
                    )) : <div className="text-muted-foreground">No alerts.</div>}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* <TabsContent value="stock-count" className="space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Stock Count</CardTitle>
              <CardDescription>Compare system stock with actual counted stock</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Count Date"><Input type="date" value={countDate} onChange={(e) => setCountDate(e.target.value)} /></Field>
                <Field label="Branch"><Input value={countBranch} onChange={(e) => setCountBranch(e.target.value)} /></Field>
                <Field label="Note"><Input value={countNote} onChange={(e) => setCountNote(e.target.value)} /></Field>
              </div>

              <div className="space-y-3">
                {countRows.map((row, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-4">
                    <select className="h-10 rounded-md border bg-background px-3 text-sm" value={row.inventory_item_id} onChange={(e) => updateCountRow(index, "inventory_item_id", Number(e.target.value))}>
                      <option value={0}>Select ingredient</option>
                      {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <Input placeholder="Actual count" type="number" step="0.001" value={row.actual_count} onChange={(e) => updateCountRow(index, "actual_count", e.target.value)} />
                    <Input placeholder="Reason" value={row.reason} onChange={(e) => updateCountRow(index, "reason", e.target.value)} />
                    <Button variant="outline" onClick={() => setCountRows((p) => [...p, { inventory_item_id: 0, actual_count: "", reason: "Counting correction" }])}>+ Add Item</Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={saveCount} disabled={savingCount}>{savingCount ? "Saving..." : "Submit Count"}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent> */}

        <TabsContent value="movements" className="space-y-6">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Stock Movements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <Field label="From">
                  <Input type="date" value={movementFromDate} onChange={(e) => setMovementFromDate(e.target.value)} />
                </Field>
                <Field label="To">
                  <Input type="date" value={movementToDate} onChange={(e) => setMovementToDate(e.target.value)} />
                </Field>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      setMovementFromDate(today);
                      setMovementToDate(today);
                    }}
                  >
                    Clear Filter
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementRecords.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.created_at ? new Date(m.created_at).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>{m.ingredient_name ?? ingredients.find((i) => i.id === m.inventory_item_id)?.name ?? "-"}</TableCell>
                      <TableCell><Badge variant={m.type === "waste" || m.type === "sale_usage" ? "destructive" : "secondary"}>{m.type}</Badge></TableCell>
                      <TableCell>{fmtQty(m.quantity)} {m.unit}</TableCell>
                      <TableCell>{fmtQty(m.before_stock)}</TableCell>
                      <TableCell>{fmtQty(m.after_stock)}</TableCell>
                      <TableCell>{m.note ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                  {movementRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        {movementLoading ? "Loading movement records..." : "No movement records for selected date range"}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <Card className="rounded-3xl">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-3xl font-semibold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
