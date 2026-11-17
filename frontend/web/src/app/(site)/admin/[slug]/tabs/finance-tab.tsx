"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, errorMessage, ErrorState, Field, Modal, Spinner, Stat } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { formatDateTime, formatInr } from "@/lib/format";
import type { SettlementInput, SettlementStatus } from "@/lib/types";
import { ADMIN, can, type TabProps } from "./shared";

export const SETTLEMENT_LABEL: Record<SettlementStatus, string> = {
  REQUESTED: "Awaiting host approval",
  HOST_APPROVED: "Awaiting compliance",
  APPROVED: "Approved • awaiting transfer",
  DISBURSED: "Disbursed",
  REJECTED: "Rejected",
};
export const SETTLEMENT_TONE = { REQUESTED: "warn", HOST_APPROVED: "gold", APPROVED: "gold", DISBURSED: "success", REJECTED: "danger" } as const;

function RequestForm({ slug, availablePaise, onDone }: { slug: string; availablePaise: number; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState<SettlementInput>({ amount: Math.floor(availablePaise / 100), destination: "BUILDER_ESCROW", beneficiaryName: "", accountNumber: "", ifsc: "" });
  const req = useMutation({
    mutationFn: () => endpoints.requestSettlement(slug, { ...f, ifsc: f.ifsc.toUpperCase() }),
    onSuccess: () => {
      toast("Settlement requested. The host and our compliance team will review it.");
      void qc.invalidateQueries({ queryKey: ["ledger", slug] });
      onDone();
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        req.mutate();
      }}
    >
      <p className="text-sm text-muted">Available to settle: {formatInr(availablePaise)}. Funds can only go to the builder&apos;s RERA escrow or the couple&apos;s home-loan account.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (₹)">
          <input className="input" type="number" min={1} max={Math.floor(availablePaise / 100)} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} required />
        </Field>
        <Field label="Destination">
          <select className="input" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value as SettlementInput["destination"] })}>
            <option value="BUILDER_ESCROW">Builder RERA escrow</option>
            <option value="HOME_LOAN">Home-loan account</option>
          </select>
        </Field>
      </div>
      <Field label="Beneficiary name">
        <input className="input" value={f.beneficiaryName} onChange={(e) => setF({ ...f, beneficiaryName: e.target.value })} required maxLength={120} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Account number">
          <input className="input" inputMode="numeric" pattern="\d{9,18}" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} required />
        </Field>
        <Field label="IFSC">
          <input className="input uppercase" value={f.ifsc} onChange={(e) => setF({ ...f, ifsc: e.target.value })} required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" />
        </Field>
      </div>
      {req.isError && <p className="text-sm text-maroon">{errorMessage(req.error)}</p>}
      <button className="btn-primary w-full" disabled={req.isPending}>
        {req.isPending ? "Submitting…" : "Request settlement"}
      </button>
    </form>
  );
}

export function FinanceTab({ slug, wedding, role }: TabProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [requesting, setRequesting] = useState(false);
  const q = useQuery({ queryKey: ["ledger", slug], queryFn: () => endpoints.ledger(slug) });
  const onDone = (msg: string) => () => {
    toast(msg);
    void qc.invalidateQueries({ queryKey: ["ledger", slug] });
  };
  const onError = (e: unknown) => toast(errorMessage(e), "error");
  const approve = useMutation({ mutationFn: (id: string) => endpoints.hostApproveSettlement(slug, id), onSuccess: onDone("Approved — sent to compliance"), onError });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => endpoints.hostRejectSettlement(slug, id, reason),
    onSuccess: onDone("Settlement rejected"),
    onError,
  });

  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const { balances: b, escrow, entries, settlements } = q.data;
  const isHost = role === "HOST";
  const canRequest = can(role, ADMIN);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Received" value={formatInr(b.creditsPaise)} sub={b.refundsPaise ? `${formatInr(b.refundsPaise)} refunded` : undefined} />
        <Stat label="Disbursed" value={formatInr(b.debitsPaise)} />
        <Stat label="In escrow" value={formatInr(b.balancePaise)} sub={b.reservedPaise ? `${formatInr(b.reservedPaise)} reserved for pending settlements` : undefined} />
        <Stat label="Available" value={formatInr(b.availablePaise)} />
      </div>

      <div className="card flex flex-wrap items-center gap-4 p-5">
        <Landmark className="text-gold" size={28} />
        <div className="flex-1 text-sm">
          <p className="font-semibold">{escrow.bankName ?? "Escrow bank not configured"}</p>
          <p className="text-muted">
            {escrow.accountNumber && `A/C ${escrow.accountNumber}`}
            {escrow.ifsc && ` • ${escrow.ifsc}`}
            {escrow.reraRegId && ` • RERA ${escrow.reraRegId}`}
          </p>
        </div>
        {canRequest && (
          <button className="btn-primary" disabled={b.availablePaise <= 0} onClick={() => setRequesting(true)}>
            Request settlement
          </button>
        )}
      </div>

      <div>
        <h3 className="flex items-center gap-2 font-serif text-lg font-bold">
          <ShieldCheck size={18} className="text-emerald-700" /> Settlements (dual control)
        </h3>
        <p className="text-xs text-muted">Every payout needs the host&apos;s approval and then an independent compliance officer&apos;s approval.</p>
        {!settlements.length ? (
          <div className="mt-3">
            <EmptyState title="No settlements yet" />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {settlements.map((s) => (
              <div key={s.id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="flex-1">
                  <p className="font-semibold">
                    {formatInr(s.amountPaise)} → {s.beneficiaryName}
                  </p>
                  <p className="text-xs text-muted">
                    {s.destination === "BUILDER_ESCROW" ? "Builder escrow" : "Home loan"} • {s.accountNumber} • {s.ifsc} • {formatDateTime(s.createdAt, wedding.timezone)}
                  </p>
                  {s.rejectedReason && <p className="mt-1 text-xs text-maroon">Reason: {s.rejectedReason}</p>}
                  {s.bankReference && <p className="mt-1 text-xs text-emerald-800">UTR {s.bankReference}</p>}
                </div>
                <Badge tone={SETTLEMENT_TONE[s.status]}>{SETTLEMENT_LABEL[s.status]}</Badge>
                {s.status === "REQUESTED" && (
                  <div className="flex gap-2">
                    {isHost && (
                      <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={approve.isPending} onClick={() => approve.mutate(s.id)}>
                        Approve
                      </button>
                    )}
                    {canRequest && (
                      <button
                        className="btn-ghost !px-3 !py-1.5 text-xs"
                        onClick={() => {
                          const reason = prompt("Reason for rejecting this settlement?");
                          if (reason && reason.trim().length >= 3) reject.mutate({ id: s.id, reason: reason.trim() });
                        }}
                      >
                        Reject
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-serif text-lg font-bold">Escrow ledger</h3>
        {!entries.length ? (
          <div className="mt-3">
            <EmptyState title="No ledger entries yet" />
          </div>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line bg-ivory text-left text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-muted">{formatDateTime(e.createdAt, wedding.timezone)}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={e.type === "CREDIT" ? "success" : e.type === "DEBIT" ? "gold" : "danger"}>{e.type.toLowerCase()}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {e.contribution ? `${e.contribution.donorName} • ${e.contribution.units} sq.ft. • ${e.contribution.receiptNumber ?? ""}` : e.reference}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${e.type === "CREDIT" ? "text-emerald-800" : "text-maroon"}`}>
                      {e.type === "CREDIT" ? "+" : "−"}
                      {formatInr(e.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={requesting} onClose={() => setRequesting(false)} title="Request a settlement">
        {requesting && <RequestForm slug={slug} availablePaise={b.availablePaise} onDone={() => setRequesting(false)} />}
      </Modal>
    </div>
  );
}
