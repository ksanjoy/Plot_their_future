import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { AdminHome } from "./admin-home";

export const metadata: Metadata = { title: "Host console", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminHome />
    </Suspense>
  );
}
