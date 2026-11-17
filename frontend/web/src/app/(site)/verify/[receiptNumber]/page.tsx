import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { VerifyResult } from "./verify-result";

export const metadata: Metadata = { title: "Receipt verification" };

export default function VerifyPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <VerifyResult />
    </Suspense>
  );
}
