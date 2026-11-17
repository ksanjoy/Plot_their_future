import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { StageScreen } from "./stage-screen";

export const metadata: Metadata = { title: "Stage screen", robots: { index: false } };

export default function StagePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <StageScreen />
    </Suspense>
  );
}
