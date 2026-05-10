import { Suspense } from "react";
import CustomerMenuPage from "./customer-menu";

export const metadata = {
  title: "Coffee Menu",
};

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#059669] flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CustomerMenuPage />
    </Suspense>
  );
}
