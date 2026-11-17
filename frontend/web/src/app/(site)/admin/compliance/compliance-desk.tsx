"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, errorMessage, ErrorState, Spinner } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { coupleName, formatDateTime, formatInr } from "@/lib/format";
import type { SettlementStatus } from "@/lib/types";
import { SETTLEMENT_LABEL, SETTLEMENT_TONE } from "../[slug]/tabs/finance-tab";

export function ComplianceDesk() {
  return (
    <RequireAuth>
      <Desk />
    </RequireAuth>
  );
}

function Desk() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<SettlementStatus | "">("HOST_APPROVED");
  const q = useQuery({
    queryKey: ["compliance", status],
    queryFn: () => endpoints.complianceSettlements(status || undefined),
    enabled: Boolean(user?.isPlatformAdmin),
  });
  const done = (msg: string) => () => {
    toast(msg);
    void qc.invalidateQueries({ queryKey: ["compliance"] });
  };
  const onError = (e: unknown) => toast(errorMessage(e), "error");
  const approve = useMutation({ mutationFn: endpoints.complianceApprove, onSuccess: done("Settlement approved"), onError });
  const disburse = useMutation({
    mutationFn: ({ id, ref }: { id: string; ref: string }) => endpoints.complianceDisburse(id, ref),
    onSuccess: done("Marked as disbursed"),
    onError,
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => endpoints.complianceReject(id, reason),
    onSuccess: done("Settlement rejected"),
    onError,
  });

  if (!user?.isPlatformAdmin) {
    return (
      <ErrorState
        error={new Error("forbidden")}
        action={
          <Link href="/admin" className="btn-ghost">
            Back to console
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
        <ShieldCheck size={14} /> Platform compliance
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold text-maroon">Settlement approvals</h1>
      <p className="mt-2 text-sm text-muted">
        Second-level approval for escrow payouts. You cannot approve a settlement you requested or approved as host.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["HOST_APPROVED", "Awaiting compliance"],
            ["APPROVED", "Awaiting transfer"],
            ["REQUESTED", "Awaiting host"],
            ["DISBURSED", "Disbursed"],
            ["REJECTED", "Rejected"],
            ["", "All"],
          ] as [SettlementStatus | "", string][]
        ).map(([s, label]) => (
          <button key={s} className={`chip ${status === s ? "chip-active" : ""}`} onClick={() => setStatus(s)}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {q.isPending ? (
          <Spinner />
        ) : q.isError ? (
          <ErrorState error={q.error} />
        ) : !q.data.length ? (
          <EmptyState title="Nothing in this queue" />
        ) : (
          <div className="space-y-3">
            {q.data.map((s) => (
              <div key={s.id} className="card flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-60 flex-1">
                  <p className="font-serif text-lg font-bold">
                    {formatInr(s.amountPaise)} • {coupleName(s.wedding)}
                  </p>
                  <p className="text-sm">
                    To {s.beneficiaryName} ({s.destination === "BUILDER_ESCROW" ? "builder RERA escrow" : "home loan"}) • {s.accountNumber} • {s.ifsc}
                  </p>
                  <p className="text-xs text-muted">
                    From {s.wedding.escrowBankName ?? "escrow"} {s.wedding.escrowAccountNumber ?? ""} • requested {formatDateTime(s.createdAt)}
                    {s.hostApprovedAt && ` • host approved ${formatDateTime(s.hostApprovedAt)}`}
                  </p>
                  {s.rejectedReason && <p className="mt-1 text-xs text-maroon">Reason: {s.rejectedReason}</p>}
                  {s.bankReference && <p className="mt-1 text-xs text-emerald-800">UTR {s.bankReference}</p>}
                </div>
                <Badge tone={SETTLEMENT_TONE[s.status]}>{SETTLEMENT_LABEL[s.status]}</Badge>
                <div className="flex gap-2">
                  {s.status === "HOST_APPROVED" && (
                    <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={approve.isPending} onClick={() => approve.mutate(s.id)}>
                      Approve
                    </button>
                  )}
                  {s.status === "APPROVED" && (
                    <button
                      className="btn-gold !px-3 !py-1.5 text-xs"
                      onClick={() => {
                        const ref = prompt("Bank transfer reference (UTR)?");
                        if (ref && ref.trim().length >= 4) disburse.mutate({ id: s.id, ref: ref.trim() });
                      }}
                    >
                      Mark disbursed
                    </button>
                  )}
                  {(s.status === "REQUESTED" || s.status === "HOST_APPROVED" || s.status === "APPROVED") && (
                    <button
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                      onClick={() => {
                        const reason = prompt("Reason for rejecting?");
                        if (reason && reason.trim().length >= 3) reject.mutate({ id: s.id, reason: reason.trim() });
                      }}
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
