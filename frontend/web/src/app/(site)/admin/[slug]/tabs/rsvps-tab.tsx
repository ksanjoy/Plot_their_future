"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, errorMessage, ErrorState, Spinner, Stat } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { COHORT_LABELS, DIETARY_LABELS, formatDate, formatDateTime } from "@/lib/format";
import { useLive } from "@/lib/live";
import type { TabProps } from "./shared";

const TONE = { ATTENDING: "success", DECLINED: "danger", MAYBE: "warn" } as const;

export function RsvpsTab({ slug, wedding }: TabProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const summary = useQuery({ queryKey: ["rsvp-summary", slug], queryFn: () => endpoints.rsvpSummary(slug) });
  const list = useQuery({ queryKey: ["rsvps", slug], queryFn: () => endpoints.rsvps(slug) });
  useLive(slug, "admin", {
    "rsvp.updated": () => {
      void qc.invalidateQueries({ queryKey: ["rsvp-summary", slug] });
      void qc.invalidateQueries({ queryKey: ["rsvps", slug] });
    },
  });

  if (summary.isPending) return <Spinner />;
  if (summary.isError) return <ErrorState error={summary.error} />;
  const s = summary.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Responded" value={`${s.responded} / ${s.invited}`} sub={`${s.pending} awaiting reply`} />
        <Stat label="Attending" value={s.attending} sub={`${s.maybe} tentative • ${s.declined} declined`} />
        <Stat label="Headcount" value={s.headcount.total} sub={`${s.headcount.adults} adults • ${s.headcount.children} children • ${s.headcount.infants} infants`} />
        <Stat label="Logistics" value={`${s.accommodation} rooms`} sub={`${s.shuttle} need the shuttle`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card overflow-x-auto p-5 lg:col-span-2">
          <h3 className="font-serif text-lg font-bold">Per ceremony</h3>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase">
              <tr>
                <th className="py-2">Ceremony</th>
                <th>Adults</th>
                <th>Children</th>
                <th>Infants</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {s.byCeremony.map((c) => (
                <tr key={c.id} className="border-t border-line/60">
                  <td className="py-2">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted">{formatDateTime(c.startsAt, wedding.timezone)}</p>
                  </td>
                  <td>{c.adults}</td>
                  <td>{c.children}</td>
                  <td>{c.infants}</td>
                  <td className="font-bold">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h3 className="font-serif text-lg font-bold">Catering</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {Object.entries(s.dietary).map(([k, n]) => (
              <li key={k} className="flex justify-between">
                <span>{DIETARY_LABELS[k] ?? k}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
            {!Object.keys(s.dietary).length && <li className="text-muted">No preferences yet</li>}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold">Responses</h3>
        <button className="btn-ghost !py-2" onClick={() => endpoints.exportRsvps(slug).catch((e) => toast(errorMessage(e), "error"))}>
          <Download size={16} /> Export CSV
        </button>
      </div>
      {list.isPending ? (
        <Spinner />
      ) : !list.data?.length ? (
        <EmptyState title="No responses yet" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line bg-ivory text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3">Dietary</th>
                <th className="px-4 py-3">Travel & stay</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.invitation.guestName}</p>
                    <p className="text-xs text-muted">
                      {COHORT_LABELS[r.invitation.cohort]}
                      {r.invitation.phone && ` • ${r.invitation.phone}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={TONE[r.status]}>{r.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.adults}A {r.children}C {r.infants}I
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.dietary.map((d) => DIETARY_LABELS[d] ?? d).join(", ") || "—"}
                    {r.allergies && <p className="text-maroon">{r.allergies}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.arrivalMode ? `${r.arrivalMode.toLowerCase()}${r.arrivalDetails ? ` ${r.arrivalDetails}` : ""}` : "—"}
                    {r.needsAccommodation && (
                      <p>
                        Stay {formatDate(r.checkInDate)} → {formatDate(r.checkOutDate)}
                      </p>
                    )}
                    {r.needsShuttle && <p>Shuttle</p>}
                  </td>
                  <td className="max-w-48 px-4 py-3 text-xs text-muted">{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
