import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { ConsoleView } from "./console-view";

export const metadata: Metadata = { title: "Host console", robots: { index: false } };

export default function ConsolePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ConsoleView />
    </Suspense>
  );
}
