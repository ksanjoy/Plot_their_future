import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = { title: "Complete your gift", robots: { index: false } };

export default function PayPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CheckoutView />
    </Suspense>
  );
}
