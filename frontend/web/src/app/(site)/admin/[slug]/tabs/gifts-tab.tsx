"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, errorMessage, ErrorState, Spinner } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { formatDateTime, formatInr } from "@/lib/format";
import { useLive } from "@/lib/live";
import type { ContributionStatus } from "@/lib/types";
import type { TabProps } from "./shared";

const TONE: Record<ContributionStatus, "success" | "warn" | "danger" | "neutral"> = {
  SUCCESS: "success",
  PENDING: "warn",
  FAILED: "danger",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  REFUND_REQUIRED: "danger",
};

export function GiftsTab({ slug, wedding }: TabProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState("SUCCESS");
  const q = useQuery({ queryKey: ["contributions", slug, status], queryFn: () => endpoints.contributions(slug, status || undefined) });
  useLive(slug, "admin", { "contribution.funded": () => void qc.invalidateQueries({ queryKey: ["contributions", slug] }) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          ["SUCCESS", "Received"],
          ["PENDING", "In checkout"],
          ["FAILED", "Failed"],
          ["EXPIRED", "Expired"],
          ["REFUND_REQUIRED", "Needs refund"],
          ["", "All"],
        ].map(([s, label]) => (
          <button key={s} className={`chip ${status === s ? "chip-active" : ""}`} onClick={() => setStatus(s)}>
            {label}
          </button>
        ))}
        <button className="btn-ghost ml-auto !py-2" onClick={() => endpoints.exportContributions(slug).catch((e) => toast(errorMessage(e), "error"))}>
          <Download size={16} /> Export CSV
        </button>
      </div>
      {q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : !q.data.length ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-line bg-ivory text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Gift</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((c) => (
                <tr key={c.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {c.donorName}
                      {c.anonymous && <span className="ml-1 text-xs font-normal text-muted">(anonymous on wall)</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {[c.relationship, c.donorPhone, c.tableNumber && `Table ${c.tableNumber}`, c.refLead].filter(Boolean).join(" • ")}
                    </p>
                    {c.blessing && <p className="mt-1 font-serif text-xs italic">&ldquo;{c.blessing}&rdquo;</p>}
                  </td>
                  <td className="px-4 py-3">
                    {c.units} sq.ft. • {c.room.name}
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatInr(c.amountPaise)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={TONE[c.status]}>{c.status.replace("_", " ").toLowerCase()}</Badge>
                    {c.failureReason && <p className="mt-1 text-xs text-maroon">{c.failureReason}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.receiptNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDateTime(c.paidAt ?? c.createdAt, wedding.timezone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
