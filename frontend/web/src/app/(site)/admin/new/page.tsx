import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { CreateWedding } from "./create-wedding";

export const metadata: Metadata = { title: "Create your wedding microsite" };

export default function NewWeddingPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CreateWedding />
    </Suspense>
  );
}
