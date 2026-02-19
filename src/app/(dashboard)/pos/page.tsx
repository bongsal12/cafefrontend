"use client";

// import { useEffect, useMemo, useState } from "react";
// import type { Category, Product } from "@/app/types/entities";
// import { Button } from "@/components/ui/Button";
// import { Input } from "@/components/ui/Input";
// import { Select } from "@/components/ui/Select";
// import { Toast } from "@/components/ui/Toast";
// import { api } from "@/app/lib/api";

type CartItem = {
  key: string;          // unique per product+size+sugar
  product_id: number;
  name: string;
  size: string;
  sugar: string;
  qty: number;
  price: number;        // unit price
  image?: string | null;
};

const IMAGE_BASE = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || "";

const sugarOptions = [
  { label: "No sweet", value: "no sweet" },
  { label: "Less", value: "less" },
  { label: "Normal", value: "normal" },
  { label: "More", value: "more" },
];

// export default function POSPage() {
//   const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

//   const [loading, setLoading] = useState(true);
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [products, setProducts] = useState<Product[]>([]);

//   const [activeCat, setActiveCat] = useState<number | "all">("all");
//   const [search, setSearch] = useState("");

//   const [cart, setCart] = useState<CartItem[]>([]);
//   const [submitting, setSubmitting] = useState(false);

//   // Checkout fields
//   const [note, setNote] = useState("");
//   const [cashier, setCashier] = useState("Counter 1");

//   useEffect(() => {
//     (async () => {
//       setLoading(true);
//       try {
//         const [c, p] = await Promise.all([
//           api.get<Category[]>("/categories"),
//           api.get<any>("/products"),
//         ]);

//         setCategories(c);
//         setProducts(p.data ?? p);
//       } catch (e: any) {
//         setToast({ type: "error", message: e.message });
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, []);

//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     return products.filter((p) => {
//       if (activeCat !== "all" && p.category_id !== activeCat) return false;
//       if (!q) return true;
//       return p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
//     });
//   }, [products, activeCat, search]);

//   const totals = useMemo(() => {
//     const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0);
//     const items = cart.reduce((s, it) => s + it.qty, 0);
//     return { subtotal, items };
//   }, [cart]);

//   function addToCart(product: Product, size: string, sugar: string) {
//     const v = product.variants.find((x) => x.size === size);
//     if (!v) {
//       setToast({ type: "error", message: "This product has no price for that size." });
//       return;
//     }

//     const key = `${product.id}|${size}|${sugar}`;
//     setCart((prev) => {
//       const found = prev.find((x) => x.key === key);
//       if (found) {
//         return prev.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x));
//       }
//       return [
//         ...prev,
//         {
//           key,
//           product_id: product.id,
//           name: product.name,
//           size,
//           sugar,
//           qty: 1,
//           price: Number(v.price),
//           image: product.image ?? null,
//         },
//       ];
//     });

//     setToast({ type: "success", message: `Added: ${product.name} (${size})` });
//   }

//   function inc(itemKey: string) {
//     setCart((prev) => prev.map((x) => (x.key === itemKey ? { ...x, qty: x.qty + 1 } : x)));
//   }
//   function dec(itemKey: string) {
//     setCart((prev) =>
//       prev
//         .map((x) => (x.key === itemKey ? { ...x, qty: Math.max(1, x.qty - 1) } : x))
//         .filter((x) => x.qty > 0)
//     );
//   }
//   function remove(itemKey: string) {
//     setCart((prev) => prev.filter((x) => x.key !== itemKey));
//   }
//   function clearCart() {
//     setCart([]);
//   }

//   async function checkout() {
//     if (!cart.length) {
//       setToast({ type: "error", message: "Cart is empty." });
//       return;
//     }

//     setSubmitting(true);
//     try {
//       const payload = {
//         cashier,
//         note,
//         items: cart.map((it) => ({
//           product_id: it.product_id,
//           name: it.name,
//           size: it.size,
//           qty: it.qty,
//           sugar: it.sugar,
//           price: it.price,
//         })),
//       };

//       await api.post("/orders", payload);
//       setToast({ type: "success", message: "Order created ✅" });
//       setCart([]);
//       setNote("");
//     } catch (e: any) {
//       setToast({ type: "error", message: e.message });
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   const catOptions = [{ label: "All", value: "all" as const }].concat(
//     categories.map((c) => ({ label: c.name, value: c.id }))
//   );

//   return (
//     <div className="space-y-6">
//       {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

//       {/* Header */}
//       <div className="rounded-3xl bg-white p-6 shadow-sm border border-black/5">
//         <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
//           <div>
//             <h1 className="text-2xl font-extrabold text-[#4f2206]">POS Order</h1>
//             <p className="mt-1 text-sm text-gray-600">Select item → choose size → add to cart → checkout.</p>
//           </div>

//           <div className="grid gap-3 md:grid-cols-3">
//             <Select
//               label="Category"
//               value={activeCat}
//               onChange={(v) => setActiveCat(v === "all" ? "all" : Number(v))}
//               options={catOptions as any}
//             />
//             <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Iced latte..." />
//             <Select
//               label="Cashier"
//               value={cashier}
//               onChange={(v) => setCashier(v)}
//               options={[
//                 { label: "Counter 1", value: "Counter 1" },
//                 { label: "Counter 2", value: "Counter 2" },
//               ]}
//             />
//           </div>
//         </div>
//       </div>

//       <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
//         {/* Products */}
//         <div className="rounded-3xl bg-white p-6 shadow-sm border border-black/5">
//           <div className="mb-3 flex items-center justify-between">
//             <div className="font-bold text-[#4f2206]">Menu Items</div>
//             <div className="text-sm text-gray-600">{filtered.length} products</div>
//           </div>

//           {loading ? (
//             <div className="text-sm text-gray-600">Loading...</div>
//           ) : filtered.length === 0 ? (
//             <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-600">
//               No products found.
//             </div>
//           ) : (
//             <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
//               {filtered.map((p) => (
//                 <ProductCard key={p.id} product={p} onAdd={addToCart} />
//               ))}
//             </div>
//           )}
//         </div>

//         {/* Cart */}
//         <div className="rounded-3xl bg-white p-6 shadow-sm border border-black/5">
//           <div className="flex items-center justify-between">
//             <div>
//               <div className="text-lg font-extrabold text-[#4f2206]">Order Cart</div>
//               <div className="text-sm text-gray-600">{totals.items} items</div>
//             </div>
//             <Button variant="secondary" onClick={clearCart} disabled={!cart.length}>
//               Clear
//             </Button>
//           </div>

//           <div className="mt-4 space-y-3">
//             {cart.length === 0 ? (
//               <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-600">
//                 Cart is empty.
//               </div>
//             ) : (
//               cart.map((it) => (
//                 <div key={it.key} className="rounded-2xl border border-black/5 bg-[#f6efe8] p-4">
//                   <div className="flex gap-3">
//                     <div className="h-14 w-14 overflow-hidden rounded-xl bg-white border border-black/5">
//                       {it.image ? (
//                         // eslint-disable-next-line @next/next/no-img-element
//                         <img
//                           src={`${IMAGE_BASE}/${it.image}`}
//                           alt={it.name}
//                           className="h-full w-full object-cover"
//                         />
//                       ) : (
//                         <div className="h-full w-full bg-white" />
//                       )}
//                     </div>

//                     <div className="flex-1">
//                       <div className="font-bold text-[#4f2206]">{it.name}</div>
//                       <div className="text-xs text-gray-700">
//                         Size: <span className="font-semibold">{it.size}</span> • Sugar:{" "}
//                         <span className="font-semibold">{it.sugar}</span>
//                       </div>

//                       <div className="mt-2 flex items-center justify-between">
//                         <div className="text-sm font-bold text-[#4f2206]">
//                           ${Number(it.price).toFixed(2)}
//                         </div>

//                         <div className="flex items-center gap-2">
//                           <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => dec(it.key)}>-</Button>
//                           <div className="w-8 text-center font-bold">{it.qty}</div>
//                           <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => inc(it.key)}>+</Button>
//                           <Button variant="danger" className="h-9" onClick={() => remove(it.key)}>
//                             Remove
//                           </Button>
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               ))
//             )}
//           </div>

//           <div className="mt-4 rounded-2xl bg-white border border-black/5 p-4">
//             <div className="flex items-center justify-between text-sm">
//               <div className="text-gray-600">Subtotal</div>
//               <div className="font-bold text-[#4f2206]">${totals.subtotal.toFixed(2)}</div>
//             </div>

//             <div className="mt-3">
//               <Input
//                 label="Order Note (optional)"
//                 value={note}
//                 onChange={(e) => setNote(e.target.value)}
//                 placeholder="Example: less ice, no straw..."
//               />
//             </div>

//             <div className="mt-4 flex gap-2">
//               <Button className="w-full" onClick={checkout} disabled={submitting || !cart.length}>
//                 {submitting ? "Submitting..." : "Checkout"}
//               </Button>
//             </div>

//             <div className="mt-2 text-xs text-gray-500">
//               This sends POST <span className="font-mono">/api/orders</span> (same as Postman).
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function ProductCard({
//   product,
//   onAdd,
// }: {
//   product: Product;
//   onAdd: (p: Product, size: string, sugar: string) => void;
// }) {
//   const [size, setSize] = useState(product.variants?.[0]?.size || "regular");
//   const [sugar, setSugar] = useState("normal");

//   const sizeOptions = (product.variants || []).map((v) => ({ label: v.size, value: v.size }));
//   const price = product.variants?.find((v) => v.size === size)?.price ?? 0;

//   return (
//     <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
//       <div className="flex items-start gap-3">
//         <div className="h-16 w-16 overflow-hidden rounded-2xl bg-[#f3e7dd] border border-black/5">
//           {product.image ? (
//             // eslint-disable-next-line @next/next/no-img-element
//             <img
//               src={`${IMAGE_BASE}/${product.image}`}
//               alt={product.name}
//               className="h-full w-full object-cover"
//             />
//           ) : null}
//         </div>

//         <div className="flex-1">
//           <div className="font-extrabold text-[#4f2206]">{product.name}</div>
//           <div className="text-xs text-gray-600">{product.slug}</div>
//           <div className="mt-1 text-sm font-bold text-[#99613f]">${Number(price).toFixed(2)}</div>
//         </div>
//       </div>

//       <div className="mt-3 grid gap-2 md:grid-cols-2">
//         <Select
//           label="Size"
//           value={size}
//           onChange={(v) => setSize(v)}
//           options={sizeOptions.length ? sizeOptions : [{ label: "regular", value: "regular" }]}
//         />
//         <Select
//           label="Sugar"
//           value={sugar}
//           onChange={(v) => setSugar(v)}
//           options={sugarOptions}
//         />
//       </div>

//       <Button className="mt-3 w-full" onClick={() => onAdd(product, size, sugar)}>
//         + Add to Cart
//       </Button>
//     </div>
//   );
// }
