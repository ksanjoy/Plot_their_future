"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorState, PageLoader } from "@/components/ui";
import { endpoints } from "@/lib/api";
import { formatDateTime, formatInr } from "@/lib/format";

export function VerifyResult() {
  const { receiptNumber } = useParams<{ receiptNumber: string }>();
  const q = useQuery({ queryKey: ["verify", receiptNumber], queryFn: () => endpoints.verifyReceipt(receiptNumber) });
  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} action={<Link href="/verify" className="btn-ghost">Try another receipt</Link>} />;
  const r = q.data;
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-14">
      <div className={`card p-6 text-center ${r.valid ? "border-emerald-300" : "border-rose-300"}`}>
        {r.valid ? <BadgeCheck className="mx-auto text-emerald-600" size={48} /> : <ShieldAlert className="mx-auto text-rose-600" size={48} />}
        <h1 className="mt-3 font-display text-xl font-bold text-maroon">{r.valid ? "Genuine receipt" : "Receipt could not be verified"}</h1>
        <p className="mt-1 font-mono text-sm">{r.receiptNumber}</p>
        {r.valid ? (
          <dl className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
            <dt className="text-muted">Couple</dt>
            <dd className="font-semibold">{r.couple}</dd>
            <dt className="text-muted">Donor</dt>
            <dd className="font-semibold">{r.donorInitials}</dd>
            <dt className="text-muted">Gift</dt>
            <dd className="font-semibold">
              {r.units} sq.ft. • {r.room}
            </dd>
            <dt className="text-muted">Amount</dt>
            <dd className="font-semibold">{formatInr(r.amountPaise ?? 0)}</dd>
            <dt className="text-muted">Paid</dt>
            <dd className="font-semibold">{formatDateTime(r.paidAt)}</dd>
            <dt className="text-muted">Tax status</dt>
            <dd className="font-semibold">{r.taxExempt ? "Sec 56(2)(x) marriage gift" : "—"}</dd>
            <dt className="col-span-2 mt-2 text-muted">SHA-256</dt>
            <dd className="col-span-2 font-mono text-[11px] break-all">{r.hash}</dd>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted">No sealed receipt matches this number. Check for typos, or contact the couple&apos;s host.</p>
        )}
      </div>
    </div>
  );
}
