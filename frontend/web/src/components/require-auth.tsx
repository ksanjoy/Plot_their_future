"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { PageLoader } from "./ui";

/** Sends signed-out visitors to the OTP login and brings them back afterwards. */
export function RequireAuth({ children, slug }: { children: ReactNode; slug?: string }) {
  const { ready, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (!ready || user) return;
    const next = `${pathname}${search.size ? `?${search.toString()}` : ""}`;
    const params = new URLSearchParams({ next });
    if (slug) params.set("slug", slug);
    const ref = search.get("ref_token");
    if (ref) params.set("ref_token", ref);
    router.replace(`/login?${params.toString()}`);
  }, [ready, user, pathname, search, router, slug]);

  if (!ready || !user) return <PageLoader />;
  return <>{children}</>;
}
