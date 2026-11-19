"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Download, Home } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ErrorState, PageLoader } from "@/components/ui";
import { endpoints, receiptPdfUrl } from "@/lib/api";
import { coupleName, formatDate, formatDateTime, formatInr } from "@/lib/format";

export function DeedView() {
  const { id } = useParams<{ id: string }>();
  const token = useSearchParams().get("t") ?? "";
  const q = useQuery({ queryKey: ["receipt", id, token], queryFn: () => endpoints.receipt(id, token), enabled: Boolean(token), retry: false });

  if (!token) return <ErrorState error={new Error("missing token")} />;
  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} />;
  const r = q.data;
  const verifyPath = new URL(r.verifyUrl).pathname;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <p className="text-center font-display text-sm tracking-[0.3em] text-maroon uppercase">Thank you</p>
      <h1 className="mt-2 text-center font-serif text-3xl font-bold text-maroon md:text-4xl">Your gift is now part of their home</h1>

      <article className="relative mt-8 overflow-hidden rounded-3xl border-4 border-double border-gold bg-white p-8 shadow-xl md:p-12">
        <div className="pointer-events-none absolute inset-3 rounded-2xl border border-gold/40" />
        <div className="relative text-center">
          <Home className="mx-auto text-maroon" size={36} />
          <p className="mt-3 font-display text-xs tracking-[0.35em] text-muted uppercase">Certificate of a home gift</p>
          <p className="mt-6 text-sm text-muted">This certifies that</p>
          <p className="mt-1 font-serif text-3xl font-bold text-ink italic">{r.donorName}</p>
          {r.relationship && <p className="text-sm text-muted">{r.relationship}</p>}
          <p className="mt-4 text-sm text-muted">has lovingly gifted</p>
          <p className="mt-1 font-display text-4xl font-bold text-maroon">{r.units} sq.ft.</p>
          <p className="text-sm text-muted">
            of the {r.room.name}
            {r.wedding.propertyName && ` at ${r.wedding.propertyName}`}
          </p>
          <p className="mt-4 text-sm text-muted">to</p>
          <p className="font-serif text-2xl font-bold text-ink">{coupleName(r.wedding)}</p>
          {r.wedding.weddingDate && <p className="text-xs text-muted">on their wedding, {formatDate(r.wedding.weddingDate)}</p>}
          {r.blessing && <blockquote className="mx-auto mt-6 max-w-md font-serif text-lg text-maroon italic">&ldquo;{r.blessing}&rdquo;</blockquote>}

          <dl className="mx-auto mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-6 text-left text-xs">
            <dt className="text-muted">Receipt no.</dt>
            <dd className="text-right font-mono font-semibold">{r.receiptNumber}</dd>
            <dt className="text-muted">Amount</dt>
            <dd className="text-right font-semibold">{formatInr(r.amountPaise)}</dd>
            <dt className="text-muted">Paid on</dt>
            <dd className="text-right">{formatDateTime(r.paidAt)}</dd>
            {r.paymentId && (
              <>
                <dt className="text-muted">Payment ref.</dt>
                <dd className="truncate text-right font-mono">{r.paymentId}</dd>
              </>
            )}
            {r.escrow.bank && (
              <>
                <dt className="text-muted">Escrow</dt>
                <dd className="text-right">
                  {r.escrow.bank}
                  {r.escrow.accountLast4 && ` ••${r.escrow.accountLast4}`}
                </dd>
              </>
            )}
            {r.escrow.rera && (
              <>
                <dt className="text-muted">RERA</dt>
                <dd className="text-right">{r.escrow.rera}</dd>
              </>
            )}
          </dl>
          {r.taxExempt && (
            <p className="mt-4 text-xs text-muted">Gift from a relative on the occasion of marriage — exempt under Section 56(2)(x) of the Income Tax Act.</p>
          )}
          {r.receiptHash && <p className="mt-3 font-mono text-[10px] break-all text-muted/70">SHA-256 {r.receiptHash}</p>}
        </div>
      </article>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href={receiptPdfUrl(r.id, token)} className="btn-primary" target="_blank" rel="noreferrer">
          <Download size={16} /> Download receipt PDF
        </a>
        <Link href={verifyPath} className="btn-ghost">
          <BadgeCheck size={16} /> Verify authenticity
        </Link>
        <Link href={`/w/${r.wedding.slug}`} className="btn-ghost">
          Back to the celebration
        </Link>
      </div>
    </div>
  );
}
