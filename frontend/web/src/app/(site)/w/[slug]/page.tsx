import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { MicrositeView } from "./microsite-view";

export const metadata: Metadata = { title: "Wedding invitation", robots: { index: false } };

export default function MicrositePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <MicrositeView />
    </Suspense>
  );
}
