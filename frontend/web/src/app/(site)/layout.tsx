import { Suspense } from "react";
import { IntroGate } from "@/components/intro-gate";
import { SiteFooter, SiteHeader, SiteHeaderFallback } from "@/components/site-header";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <IntroGate />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </>
  );
}
