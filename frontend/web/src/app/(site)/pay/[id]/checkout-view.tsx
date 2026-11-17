"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, CreditCard, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, PageLoader } from "@/components/ui";
import { toPath } from "@/components/wedding/gift-sheet";
import { ApiError, endpoints } from "@/lib/api";
import { coupleName, formatInr } from "@/lib/format";
import type { Checkout, PaymentResult } from "@/lib/types";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (e: { error: { description?: string } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay checkout"));
    document.body.append(s);
  });
}

function useRemaining(until: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return until ? Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000)) : 0;
}

function Expired({ message, slug }: { message: string; slug?: string }) {
  return (
    <div className="card p-8 text-center">
      <Clock className="mx-auto text-gold" size={40} />
      <h1 className="mt-3 font-display text-xl font-bold text-maroon">Reservation expired</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {slug && (
        <Link href={`/w/${slug}?gift=1`} className="btn-primary mt-5">
          Choose square feet again
        </Link>
      )}
    </div>
  );
}

export function CheckoutView() {
  const { id } = useParams<{ id: string }>();
  const token = useSearchParams().get("t") ?? "";
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["checkout", id, token],
    queryFn: () => endpoints.checkout(id, token),
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const done = useCallback(
    (r: PaymentResult) => {
      if (r.status === "SUCCESS" && r.links.thankYouUrl) router.replace(toPath(r.links.thankYouUrl));
      else setFailure("The payment did not go through. Your square feet have been released.");
    },
    [router],
  );

  useEffect(() => {
    if (q.data?.status === "SUCCESS" && q.data.links.thankYouUrl) router.replace(toPath(q.data.links.thankYouUrl));
  }, [q.data, router]);

  const mock = useMutation({
    mutationFn: (outcome: "success" | "failure") => endpoints.completeMock(id, token, outcome),
    onSuccess: done,
  });
  const verify = useMutation({
    mutationFn: (r: RazorpayResponse) => endpoints.verifyPayment(id, token, { ...r }),
    onSuccess: done,
  });

  const payWithRazorpay = async (c: Checkout) => {
    if (c.payment?.provider !== "razorpay") return;
    const p = c.payment;
    try {
      await loadRazorpay();
    } catch (e) {
      setFailure((e as Error).message);
      return;
    }
    const RazorpayCtor = window.Razorpay;
    if (!RazorpayCtor) return;
    const rz = new RazorpayCtor({
      key: p.keyId,
      order_id: p.orderId,
      amount: p.amount,
      currency: p.currency,
      name: p.name,
      description: p.description,
      prefill: p.prefill,
      notes: p.notes,
      theme: { color: "#8b1e2d" },
      handler: (resp: RazorpayResponse) => verify.mutate(resp),
    });
    rz.on("payment.failed", (e) => setFailure(e.error.description ?? "Payment failed"));
    rz.open();
  };

  const remaining = useRemaining(q.data?.holdExpiresAt);

  let body: React.ReactNode;
  if (!token) body = <Expired message="This payment link is incomplete. Please open it again from the wedding page." />;
  else if (q.isPending) return <PageLoader />;
  else if (q.isError) {
    const err = q.error;
    if (err instanceof ApiError && err.status === 410) {
      const wedding = (err.body as { wedding?: { slug: string } } | undefined)?.wedding;
      body = <Expired message={err.message} slug={wedding?.slug} />;
    } else body = <Expired message={errorMessage(err)} />;
  } else {
    const c = q.data;
    const busy = mock.isPending || verify.isPending;
    const mutationError = mock.error ?? verify.error;
    if (c.status !== "PENDING" && c.status !== "SUCCESS") {
      body = <Expired message={c.status === "FAILED" ? "This payment failed and the square feet were released." : "This reservation is no longer active."} slug={c.wedding.slug} />;
    } else if (remaining === 0 && c.status === "PENDING") {
      body = <Expired message="Your reservation window has closed. Please pick your square feet again." slug={c.wedding.slug} />;
    } else if (mutationError instanceof ApiError && mutationError.status === 410) {
      body = <Expired message={mutationError.message} slug={c.wedding.slug} />;
    } else {
      body = (
        <div className="card overflow-hidden">
          <div className="maroon-gradient p-6 text-white">
            <p className="text-xs tracking-[0.25em] text-gold-light uppercase">Gift for {coupleName(c.wedding)}</p>
            <p className="mt-2 font-display text-4xl font-bold">{formatInr(c.amountPaise)}</p>
            <p className="mt-1 text-sm text-white/80">
              {c.units} sq.ft. in the {c.room.name} • {formatInr(c.ratePaise)}/sq.ft.
            </p>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="flex items-center gap-2">
                <Clock size={16} /> Square feet reserved for you
              </span>
              <span className="font-mono font-bold tabular-nums">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">Gift from</dt>
              <dd className="text-right font-semibold">{c.donorName}</dd>
              {c.blessing && (
                <>
                  <dt className="text-muted">Blessing</dt>
                  <dd className="text-right font-serif italic">&ldquo;{c.blessing}&rdquo;</dd>
                </>
              )}
            </dl>

            {failure ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <p className="flex items-center gap-2 font-semibold">
                  <XCircle size={16} /> {failure}
                </p>
                <Link href={`/w/${c.wedding.slug}?gift=1`} className="btn-primary mt-3 !py-2">
                  Try again
                </Link>
              </div>
            ) : c.payment?.provider === "razorpay" ? (
              <button className="btn-primary w-full" disabled={busy} onClick={() => void payWithRazorpay(c)}>
                <CreditCard size={16} /> {busy ? "Confirming…" : "Pay securely with UPI / Card / Netbanking"}
              </button>
            ) : c.payment?.provider === "mock" ? (
              <div className="rounded-xl border border-dashed border-gold p-4">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Test payment gateway</p>
                <p className="mt-1 text-sm text-muted">This environment uses a simulated gateway. No money will move.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn-primary" disabled={busy} onClick={() => mock.mutate("success")}>
                    {busy ? "Processing…" : "Simulate success"}
                  </button>
                  <button className="btn-ghost" disabled={busy} onClick={() => mock.mutate("failure")}>
                    Simulate failure
                  </button>
                </div>
              </div>
            ) : null}
            {mutationError && !(mutationError instanceof ApiError && mutationError.status === 410) && <p className="text-sm text-maroon">{errorMessage(mutationError)}</p>}
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck size={14} className="text-emerald-700" /> Funds go directly into the couple&apos;s RBI-regulated escrow account.
            </p>
          </div>
        </div>
      );
    }
  }

  return <div className="mx-auto w-full max-w-lg flex-1 px-4 py-12">{body}</div>;
}
