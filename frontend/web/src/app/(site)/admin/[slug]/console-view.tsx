"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ComponentType } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Badge, ErrorState, PageLoader } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { coupleName, formatDate, ROLE_LABELS } from "@/lib/format";
import type { Role } from "@/lib/types";
import { BlessingsTab } from "./tabs/blessings-tab";
import { CeremoniesTab } from "./tabs/ceremonies-tab";
import { DispatchTab } from "./tabs/dispatch-tab";
import { FinanceTab } from "./tabs/finance-tab";
import { GiftsTab } from "./tabs/gifts-tab";
import { GuestsTab } from "./tabs/guests-tab";
import { OverviewTab } from "./tabs/overview-tab";
import { RsvpsTab } from "./tabs/rsvps-tab";
import { SettingsTab } from "./tabs/settings-tab";
import { ADMIN, STAFF, type TabProps } from "./tabs/shared";
import { StageTab } from "./tabs/stage-tab";

const TABS: { id: string; label: string; roles: Role[]; Component: ComponentType<TabProps> }[] = [
  { id: "overview", label: "Overview", roles: [...ADMIN, "PLATFORM"], Component: OverviewTab },
  { id: "guests", label: "Guests", roles: [...ADMIN, "LEAD"], Component: GuestsTab },
  { id: "ceremonies", label: "Ceremonies", roles: [...STAFF, "PLATFORM"], Component: CeremoniesTab },
  { id: "dispatch", label: "Invitations", roles: [...ADMIN, "LEAD"], Component: DispatchTab },
  { id: "rsvps", label: "RSVPs", roles: [...STAFF, "PLATFORM"], Component: RsvpsTab },
  { id: "gifts", label: "Gifts", roles: [...ADMIN, "PLATFORM"], Component: GiftsTab },
  { id: "blessings", label: "Blessings", roles: [...STAFF, "PLATFORM"], Component: BlessingsTab },
  { id: "finance", label: "Escrow & payouts", roles: [...ADMIN, "PLATFORM"], Component: FinanceTab },
  { id: "stage", label: "Stage & QR", roles: [...STAFF, "PLATFORM"], Component: StageTab },
  { id: "settings", label: "Settings", roles: ADMIN, Component: SettingsTab },
];

export function ConsoleView() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <RequireAuth>
      <Console slug={slug} />
    </RequireAuth>
  );
}

function Console({ slug }: { slug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const site = useQuery({ queryKey: ["microsite", slug], queryFn: () => endpoints.microsite(slug) });

  if (site.isPending) return <PageLoader />;
  if (site.isError) return <ErrorState error={site.error} action={<Link href="/admin" className="btn-ghost">Back to console</Link>} />;

  const { wedding, role } = site.data;
  const tabs = TABS.filter((t) => t.roles.includes(role));
  if (!tabs.length) {
    return (
      <ErrorState
        error={new Error("forbidden")}
        action={
          <Link href={`/w/${slug}`} className="btn-primary">
            Open the wedding page
          </Link>
        }
      />
    );
  }
  const active = tabs.find((t) => t.id === search.get("tab")) ?? tabs[0];
  const { Component } = active;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-gold uppercase">Host console</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-maroon md:text-3xl">{coupleName(wedding)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {wedding.weddingDate && formatDate(wedding.weddingDate, wedding.timezone)}
            {wedding.city && ` • ${wedding.city}`}
            <Badge tone="gold">{ROLE_LABELS[role]}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/w/${slug}`} className="btn-ghost !py-2">
            <ExternalLink size={16} /> Wedding page
          </Link>
          {STAFF.concat("PLATFORM").includes(role) && (
            <Link href={`/stage/${slug}`} target="_blank" className="btn-ghost !py-2">
              <MonitorPlay size={16} /> Stage
            </Link>
          )}
        </div>
      </div>

      <nav className="-mx-4 mt-6 overflow-x-auto px-4 print:hidden" aria-label="Console sections">
        <div className="flex min-w-max gap-1 border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => router.replace(`${pathname}?tab=${t.id}`, { scroll: false })}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                t.id === active.id ? "border-maroon text-maroon" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mt-6">
        <Component slug={slug} wedding={wedding} role={role} />
      </div>
    </div>
  );
}
