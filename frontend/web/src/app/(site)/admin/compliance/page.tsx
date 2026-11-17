import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { ComplianceDesk } from "./compliance-desk";

export const metadata: Metadata = { title: "Compliance desk", robots: { index: false } };

export default function CompliancePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ComplianceDesk />
    </Suspense>
  );
}
