import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { DeedView } from "./deed-view";

export const metadata: Metadata = { title: "Thank you for your gift", robots: { index: false } };

export default function ThankYouPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DeedView />
    </Suspense>
  );
}
