"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Spinner, Stat, ErrorState, ProgressBar } from "@/components/ui";
import { FloorPlan } from "@/components/wedding/floor-plan";
import { endpoints } from "@/lib/api";
import { COHORT_LABELS, formatInr, percent } from "@/lib/format";
import { useLive } from "@/lib/live";
import type { TabProps } from "./shared";

export function OverviewTab({ slug }: TabProps) {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard", slug], queryFn: () => endpoints.dashboard(slug) });
  const registry = useQuery({ queryKey: ["registry", slug], queryFn: () => endpoints.registry(slug) });

  useLive(slug, "admin", {
    "contribution.funded": () => void qc.invalidateQueries({ queryKey: ["dashboard", slug] }),
    "rsvp.updated": () => void qc.invalidateQueries({ queryKey: ["dashboard", slug] }),
  });
  useLive(slug, "wedding", {
    "registry.updated": (state) => qc.setQueryData(["registry", slug], state),
  });

  if (dash.isPending) return <Spinner />;
  if (dash.isError) return <ErrorState error={dash.error} />;
  const d = dash.data;
  const attending = d.rsvp.byStatus.ATTENDING ?? 0;
  const headcount = d.rsvp.headcount.adults + d.rsvp.headcount.children;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Home gifted" value={`${d.registry.fundedSft} / ${d.registry.totalSft} sq.ft.`} sub={`${percent(d.registry.progress)} • ${d.gifts.contributors} gifts`} />
        <Stat label="Raised into escrow" value={formatInr(d.escrow.creditedPaise)} sub={`${formatInr(d.escrow.availablePaise)} available to settle`} />
        <Stat label="Guests invited" value={d.guests.total} sub={`${d.rsvp.responded} responded`} />
        <Stat label="Attending" value={attending} sub={`${headcount} people (${d.rsvp.headcount.infants} infants)`} />
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-lg font-bold">Registry progress</h3>
          <p className="text-sm text-muted">
            {formatInr(d.registry.raisedPaise)} of {formatInr(d.registry.targetPaise)}
            {d.registry.heldSft > 0 && ` • ${d.registry.heldSft} sq.ft. being paid for right now`}
          </p>
        </div>
        <ProgressBar value={d.registry.progress} className="mt-3 !h-3" />
        <div className="mt-5">{registry.data ? <FloorPlan rooms={registry.data.rooms} ratePaise={registry.data.ratePerSftPaise} compact /> : <Spinner />}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="font-serif text-lg font-bold">Guests by cohort</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {Object.entries(d.guests.byCohort).map(([k, n]) => (
              <li key={k} className="flex justify-between">
                <span>{COHORT_LABELS[k] ?? k}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
            {!Object.keys(d.guests.byCohort).length && <li className="text-muted">No guests yet</li>}
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="font-serif text-lg font-bold">RSVP</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li className="flex justify-between"><span>Attending</span><span className="font-semibold">{d.rsvp.byStatus.ATTENDING ?? 0}</span></li>
            <li className="flex justify-between"><span>Tentative</span><span className="font-semibold">{d.rsvp.byStatus.MAYBE ?? 0}</span></li>
            <li className="flex justify-between"><span>Declined</span><span className="font-semibold">{d.rsvp.byStatus.DECLINED ?? 0}</span></li>
            <li className="flex justify-between"><span>Awaiting reply</span><span className="font-semibold">{Math.max(0, d.guests.total - d.rsvp.responded)}</span></li>
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="font-serif text-lg font-bold">Invitations sent</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li className="flex justify-between"><span>Delivered</span><span className="font-semibold">{d.dispatch.SENT ?? 0}</span></li>
            <li className="flex justify-between"><span>Queued</span><span className="font-semibold">{d.dispatch.QUEUED ?? 0}</span></li>
            <li className="flex justify-between"><span>Failed</span><span className="font-semibold">{d.dispatch.FAILED ?? 0}</span></li>
            <li className="flex justify-between"><span>Skipped</span><span className="font-semibold">{d.dispatch.SKIPPED ?? 0}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
