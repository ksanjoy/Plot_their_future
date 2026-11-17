import { Suspense } from "react";
import { SiteFooter, SiteHeader, SiteHeaderFallback } from "@/components/site-header";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </>
  );
}
